/* eslint-disable no-case-declarations */
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import crypto from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import { connection } from './js/proxy/proxyhandler'
import { checkProxy } from './js/proxy/proxycheck'
import { scrapeProxy } from './js/proxy/proxyscrape'
import {
  salt,
  delay,
  genName,
  botMode,
  sendEvent as sendRendererEvent,
  proxyEvent as sendRendererProxyEvent,
  notify as sendRendererNotify,
  cleanText,
  resolveMinecraftVersion,
  isSuspendedMinecraftVersion
} from './js/misc/utils'
import { easyMcAuth } from './js/misc/customAuth'
import EventEmitter from 'node:events'
const Store = require('electron-store')
const mineflayer = require('mineflayer')
const { Vec3 } = require('vec3')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
import { antiafk } from './js/misc/antiafk'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const botApi = new EventEmitter()
botApi.setMaxListeners(0)
const store = new Store()
const suspendedBotControls = new Set(['interact', 'nuker', 'pathfinder'])
const UPDATE_REPO = 'Cmmdx/TrafficerTR'
const UPDATE_API_URL = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`
const UPDATE_RELEASES_URL = `https://github.com/${UPDATE_REPO}/releases/latest`

let stopBot = false
let stopScript = false
let stopProxyTest = false
let currentProxy = 0
let proxyUsed = 0

function storeinfo() {
  return store.get('config')
}

let clientVersion = app.getVersion().replace(/\.0$/, '')

let playerList = []
let connectedBots = new Set()
let webhookSending = false
const webhookQueue = []

const webhookColors = {
  success: 0x3fbf73,
  warning: 0xf0b84f,
  error: 0xe05252,
  info: 0xd95045,
  chat: 0xffffff,
  action: 0xf4bf45,
  proxy: 0xd48b38,
  auth: 0x5865f2
}

const webhookLogToggles = {
  action: 'actionLogWebhook',
  proxy: 'proxyLogWebhook',
  chat: 'chatLogWebhook',
  feedback: 'feedbackLogWebhook',
  join: 'joinLogWebhook',
  kick: 'kickLogWebhook',
  auth: 'authLogWebhook'
}

function formatKickReason(reason) {
  if (!reason) return ''
  const normalize = (value) => {
    if (typeof value === 'string') return value
    return cleanText(value) || JSON.stringify(value)
  }
  if (typeof reason === 'object') return normalize(reason)
  try {
    return normalize(JSON.parse(reason))
  } catch {
    return String(reason)
  }
}

function appendVersionHint(message) {
  if (!isSuspendedMinecraftVersion(storeinfo()?.value?.version)) return message
  const text = String(message || '')
  if (!/outdated client|differentVersionError|please use 26\.1/i.test(text)) return text
  return `${text} - 26.1.x is disabled until native protocol support is available.`
}

function getWebhookUrl() {
  const url = storeinfo()?.value?.webhookLink?.trim()
  if (!url) return
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+/i.test(url)) return
  return url
}

function canSendWebhook(type, force = false) {
  if (!getWebhookUrl()) return false
  if (force) return true
  if (storeinfo()?.boolean?.enableWebhook === false) return false

  const toggle = webhookLogToggles[type]
  if (!toggle) return true
  return storeinfo()?.boolean?.[toggle] !== false
}

function limitWebhookText(value, max = 1000) {
  const text = String(value ?? '')
    .replaceAll('\u0000', '')
    .trim()
  if (text.length <= max) return text || '-'
  return `${text.slice(0, max - 3)}...`
}

function sendWebhook(type, title, description, fields = [], options = {}) {
  const url = getWebhookUrl()
  if (!url || !canSendWebhook(type, options.force)) return

  const embedFields = fields
    .filter((field) => field?.name && field?.value !== undefined)
    .slice(0, 12)
    .map((field) => ({
      name: limitWebhookText(field.name, 256),
      value: limitWebhookText(field.value, 1000),
      inline: Boolean(field.inline)
    }))

  webhookQueue.push({
    url,
    payload: {
      username: 'TrafficerTR',
      embeds: [
        {
          title: limitWebhookText(title, 256),
          description: limitWebhookText(description, 3900),
          color: options.color ?? webhookColors[type] ?? webhookColors.info,
          timestamp: new Date().toISOString(),
          footer: {
            text: `TrafficerTR v${clientVersion}`
          },
          fields: embedFields
        }
      ]
    }
  })

  processWebhookQueue()
}

async function processWebhookQueue() {
  if (webhookSending) return
  webhookSending = true

  while (webhookQueue.length > 0) {
    const item = webhookQueue.shift()
    try {
      const response = await fetch(item.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(item.payload)
      })
      if (response.status === 429) {
        const retryInfo = await response.json().catch(() => ({}))
        webhookQueue.unshift(item)
        await delay(Math.ceil((retryInfo.retry_after || 1) * 1000))
        continue
      }
      if (!response.ok) {
        console.log(`Webhook failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.log('Webhook error:', error.message)
    }
    await delay(350)
  }

  webhookSending = false
}

function sendEvent(username, event, message) {
  sendRendererEvent(username, event, message)

  switch (event) {
    case 'login':
      sendWebhook(
        'join',
        'Bot Joined',
        `${username} connected to the server.`,
        [{ name: 'Bot', value: username, inline: true }],
        { color: webhookColors.success }
      )
      break
    case 'chat':
      sendWebhook('chat', 'Chat', message, [{ name: 'Bot', value: username, inline: true }], {
        color: webhookColors.chat
      })
      break
    case 'kicked':
      sendWebhook('kick', 'Bot Kicked', message, [{ name: 'Bot', value: username, inline: true }], {
        color: webhookColors.error
      })
      break
    case 'end':
      sendWebhook('kick', 'Connection Ended', message || 'Connection closed.', [
        { name: 'Bot', value: username, inline: true }
      ])
      break
    case 'authmsg':
    case 'easymcAuth':
      sendWebhook(
        'auth',
        'Authentication',
        message || event,
        [{ name: 'Account', value: username, inline: true }],
        { color: webhookColors.auth }
      )
      break
    default:
      sendWebhook('action', `Bot Event: ${event}`, message || '-', [
        { name: 'Bot', value: username, inline: true }
      ])
      break
  }
}

function readChatText(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value.replace(/\n/g, ' ')
  return cleanText(value) || String(value)
}

function normalizeChatLine(value) {
  return readChatText(value).replace(/\s+/g, ' ').trim().toLowerCase()
}

function isRecentServerChat(rawMessage, recentChats) {
  const normalizedMessage = normalizeChatLine(rawMessage)
  const now = Date.now()

  return recentChats.some((chat) => {
    if (now - chat.at > 1500) return false
    return normalizedMessage.includes(chat.sender) && normalizedMessage.includes(chat.message)
  })
}

function sendServerChat(botName, sender, message, recentChats) {
  const cleanSender = readChatText(sender || 'Unknown') || 'Unknown'
  const cleanMessage = readChatText(message)
  if (!cleanMessage) return

  recentChats.push({
    sender: normalizeChatLine(cleanSender),
    message: normalizeChatLine(cleanMessage),
    at: Date.now()
  })
  if (recentChats.length > 12) recentChats.shift()

  sendRendererEvent(cleanSender, 'serverchat', cleanMessage)
  sendWebhook(
    'chat',
    'Server Chat',
    cleanMessage,
    [
      { name: 'Bot', value: botName || 'unknown', inline: true },
      { name: 'Sender', value: cleanSender, inline: true },
      { name: 'Server', value: storeinfo()?.value?.server || 'not set', inline: true }
    ],
    { color: webhookColors.chat }
  )
}

function proxyEvent(proxy, event, message, count) {
  sendRendererProxyEvent(proxy, event, message, count)

  if (event === 'scraped') {
    const total = String(message || '')
      .split(/\r?\n/)
      .filter((line) => line.trim()).length
    sendWebhook('proxy', 'Proxy Scraped', `${total} proxies scraped.`, [
      { name: 'Proxy type', value: storeinfo()?.value?.proxyType || 'unknown', inline: true }
    ])
    return
  }

  if (event === 'start' || event === 'stop') {
    sendWebhook('proxy', `Proxy Test ${event === 'start' ? 'Started' : 'Stopped'}`, count || '-')
    return
  }

  if (event === 'success' || event === 'fail' || event === 'timeout') {
    sendWebhook(
      'proxy',
      `Proxy ${event}`,
      message || '-',
      [
        { name: 'Proxy', value: proxy || '-', inline: false },
        { name: 'Progress', value: count || '-', inline: true }
      ],
      { color: event === 'success' ? webhookColors.success : webhookColors.error }
    )
  }
}

function notify(title, body, type, img, keep) {
  sendRendererNotify(title, body, type, img, keep)
  sendWebhook('feedback', title, body || '-', [], {
    color: webhookColors[type] || webhookColors.info
  })
}

function canUseSelectedVersion() {
  const selectedVersion = storeinfo()?.value?.version
  if (!isSuspendedMinecraftVersion(selectedVersion)) return true
  notify(
    'Version disabled',
    '26.1.x support is paused until Mineflayer/minecraft-protocol adds native support.',
    'error',
    undefined,
    true
  )
  return false
}

function toBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 1
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(number, min), max)
}

function parseBlockNames(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((block) =>
        block
          .trim()
          .toLowerCase()
          .replace(/^minecraft:/, '')
      )
      .filter(Boolean)
  )
}

function formatPosition(position) {
  return `${Math.floor(position.x)} ${Math.floor(position.y)} ${Math.floor(position.z)}`
}

function parsePositionArgs(args, origin, defaultY = origin?.y) {
  const values = Array.isArray(args)
    ? args
    : String(args || '')
        .trim()
        .split(/\s+/)
  const filtered = values.filter(Boolean)
  if (filtered.length !== 2 && filtered.length < 3) return

  const parseCoord = (value, axisValue) => {
    const text = String(value)
    if (text.startsWith('~')) {
      const offset = text.length === 1 ? 0 : Number(text.slice(1))
      return axisValue + (Number.isFinite(offset) ? offset : 0)
    }
    const number = Number(text)
    return Number.isFinite(number) ? number : undefined
  }

  const x = parseCoord(filtered[0], origin.x)
  const y = filtered.length === 2 ? defaultY : parseCoord(filtered[1], origin.y)
  const z = parseCoord(filtered.length === 2 ? filtered[1] : filtered[2], origin.z)
  if (![x, y, z].every(Number.isFinite)) return

  return new Vec3(x, y, z)
}

function normalizeVersionNumber(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split(/[+-]/)[0]
}

function compareVersions(left, right) {
  const leftParts = normalizeVersionNumber(left).split('.').map(Number)
  const rightParts = normalizeVersionNumber(right).split('.').map(Number)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index++) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0
    if (leftValue > rightValue) return 1
    if (leftValue < rightValue) return -1
  }

  return 0
}

async function checkForUpdates(window) {
  try {
    const response = await fetch(UPDATE_API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `TrafficerTR/${clientVersion}`
      }
    })
    if (!response.ok) return

    const release = await response.json()
    const latestVersion = normalizeVersionNumber(release.tag_name || release.name)
    if (!latestVersion || compareVersions(latestVersion, clientVersion) <= 0) return

    window.webContents.send('updateAvailable', {
      currentVersion: clientVersion,
      latestVersion,
      url: release.html_url || UPDATE_RELEASES_URL
    })
  } catch (error) {
    console.log(`Update check failed: ${error.message}`)
  }
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 620,
    minWidth: 900,
    minHeight: 540,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    resizable: true,
    maximizable: true,
    webPreferences: {
      devTools: is.dev,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  ipcMain.on('loaded', () => {
    store.set('version', {
      current: clientVersion
    })
    mainWindow.webContents.send('setConfig', store.get('config'), store.get('version'))
    if (!storeinfo()) {
      mainWindow.webContents.send('initConfig')
    }
    if (store.get('config.namefile')) {
      mainWindow.webContents.send('fileSelected', 'nameFileLabel', store.get('config.namefile'))
    }
    mainWindow.show()
    checkForUpdates(mainWindow)
  })

  ipcMain.on('playerList', (event, list) => {
    playerList = list
  })

  ipcMain.on('open', (event, id, name) => {
    dialog
      .showOpenDialog(mainWindow, {
        title: name,
        filters: [{ name: 'Text File', extensions: ['txt'] }],
        properties: ['openFile', 'multiSelections']
      })
      .then((result) => {
        if (!result.canceled) {
          store.set('config.namefile', result.filePaths[0])
          mainWindow.webContents.send('fileSelected', id, result.filePaths[0])
        }
      })
      .catch((error) => {
        console.log(error)
        return
      })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/index.html`)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.cmmdx.trafficertr')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    optimizer.registerFramelessWindowIpc(window)
  })

  createMainWindow()
})

ipcMain.on('setConfig', (event, type, id, value) => {
  store.set(`config.${type}.${id}`, value)
})

ipcMain.on('deleteConfig', () => {
  store.delete('config')
})

ipcMain.on('checkboxClick', (event, id, state) => {
  switch (id) {
    case 'test':
      console.log(state)
      break
    default:
  }
})

ipcMain.on('openExternal', (event, url) => {
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases/i.test(String(url)))
    return
  shell.openExternal(url)
})

ipcMain.on('btnClick', (event, btn) => {
  if (btn !== 'webhookTest') {
    sendWebhook('action', 'UI Action', `Button pressed: ${btn}`)
  }

  switch (btn) {
    case 'btnStart':
      connectBot()
      break
    case 'btnStop':
      stopBot = true
      notify('Info', 'Stopped sending bots.', 'success')
      break
    case 'btnChat':
      exeAll('chat ' + storeinfo().value.chatMsg)
      break
    case 'btnDisconnect':
      exeAll('disconnect')
      break
    case 'btnSetHotbar':
      exeAll('sethotbar ' + storeinfo().value.hotbarSlot)
      break
    case 'btnUseheld':
      exeAll('useheld')
      break
    case 'btnWinClickRight':
      exeAll('winclick ' + storeinfo().value.invSlot + ' 1')
      break
    case 'btnWinClickLeft':
      exeAll('winclick ' + storeinfo().value.invSlot + ' 0')
      break
    case 'btnDropSlot':
      exeAll('drop ' + storeinfo().value.invSlot)
      break
    case 'btnDropAll':
      exeAll('dropall')
      break
    case 'btnCloseWindow':
      exeAll('closewindow')
      break
    case 'btnStartMove':
      exeAll('startmove ' + storeinfo().value.moveType)
      break
    case 'btnStopMove':
      exeAll('stopmove ' + storeinfo().value.moveType)
      break
    case 'btnResetMove':
      exeAll('resetmove')
      break
    case 'btnLook':
      exeAll('look ' + storeinfo().value.lookDirection)
      break
    case 'btnAfkOn':
      exeAll('afkon')
      break
    case 'btnAfkOff':
      exeAll('afkoff')
      break
    case 'btnInteractLeft':
      exeAll('interact left ' + (storeinfo().value.interactCoords || ''))
      break
    case 'btnInteractRight':
      exeAll('interact right ' + (storeinfo().value.interactCoords || ''))
      break
    case 'btnKillauraOnce':
      exeAll(
        [
          'hit',
          storeinfo().boolean.targetPlayer,
          storeinfo().boolean.targetVehicle,
          storeinfo().boolean.targetMob,
          storeinfo().boolean.targetAnimal,
          storeinfo().value.killauraRange,
          storeinfo().boolean.killauraRotate,
          storeinfo().value.killauraPriority,
          storeinfo().value.killauraMaxTargets,
          storeinfo().boolean.killauraOnlyVisible
        ].join(' ')
      )
      break
    case 'btnNukerStart':
      exeAll('nuker start')
      break
    case 'btnNukerStop':
      exeAll('nuker stop')
      break
    case 'btnPathfinderRun':
      exeAll('pathfinder ' + (storeinfo().value.pathFinderCommand || ''))
      break
    case 'btnPathfinderStop':
      exeAll('pathfinder stop')
      break
    case 'runScript':
      runScriptForPlayers(playerList)
      break
    case 'stopScript':
      stopScript = true
      notify('Info', 'Stopped running scripts.', 'success')
      break
    case 'proxyTestStart':
      testProxy(storeinfo().value.proxyList)
      break
    case 'proxyTestStop':
      stopProxyTest = true
      proxyEvent('', 'stop', '', '')
      break
    case 'proxyScrape':
      if (storeinfo().value.proxyType === 'none')
        return notify('Error', 'Select proxy type', 'error')
      notify('Info', 'Scraping proxies...', 'success')
      setProxy()
      break
    case 'webhookTest':
      if (!getWebhookUrl()) {
        return notify(
          'Error',
          'Please enter a valid Discord webhook URL.',
          'error',
          undefined,
          true
        )
      }
      sendWebhook(
        'feedback',
        'TrafficerTR Webhook Test',
        'Webhook is working. Future app, bot, proxy, chat, kick, and auth events will be sent here.',
        [
          { name: 'Server', value: storeinfo()?.value?.server || 'not set', inline: true },
          { name: 'Version', value: clientVersion, inline: true }
        ],
        { force: true, color: webhookColors.success }
      )
      sendRendererNotify('Info', 'Webhook test sent.', 'success')
      break
    default:
      break
  }
})

function setProxy() {
  scrapeProxy(storeinfo().value.proxyType)
    .then((result) => {
      proxyEvent('', 'scraped', result, '')
    })
    .catch((err) => {
      console.log(err)
      notify('Error', 'Failed to scrape proxies', 'error')
    })
}

async function testProxy(list) {
  stopProxyTest = false
  if (!canUseSelectedVersion()) return
  const server = storeinfo().value.server
  const [serverHost, serverPort] = server.split(':')
  if (!serverHost) return notify('Error', 'Invalid server address', 'error')
  if (!list) return notify('Error', 'Please enter proxy list', 'error')
  if (storeinfo().value.proxyType === 'none') return notify('Error', 'Select proxy type', 'error')
  notify('Info', 'Testing proxies...', 'success')
  proxyEvent('', 'start', '', '')
  const lines = list.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (stopProxyTest) break
    const count = `${i + 1}/${lines.length}`
    const [host, port, username, password] = lines[i].split(':')
    checkProxy(
      storeinfo().value.proxyType,
      host,
      port,
      username,
      password,
      serverHost,
      serverPort || 25565,
      storeinfo().value.proxyCheckTimeout || 5000,
      storeinfo().value.version
    )
      .then((result) => {
        proxyEvent(result.proxy, 'success', '', count)
      })
      .catch((error) => {
        proxyEvent(error.proxy, 'fail', error.reason, count)
      })
    if (lines.length == i + 1) {
      proxyEvent('', 'stop', '', '')
    }
    await delay(storeinfo().value.proxyCheckDelay || 100)
  }
}

function runScriptForPlayers(usernames) {
  if (usernames.length === 0) return notify('Error', 'No bots selected', 'error')
  const commands = prepareScript()
  if (!commands) return
  stopScript = false
  usernames.forEach((username) => {
    startScript(username, commands)
  })
}

function prepareScript() {
  const scriptText = storeinfo()?.value?.scriptText
  if (!scriptText?.trim()) {
    notify('Error', 'Please enter script text', 'error')
    return
  }

  try {
    return parseScript(scriptText)
  } catch (error) {
    notify('Script Error', error.message, 'error', undefined, true)
    return
  }
}

function parseScript(scriptText) {
  const lines = scriptText.split(/\r?\n/)
  const cursor = { index: 0 }
  const commands = parseScriptBlock(lines, cursor)

  if (cursor.index < lines.length) {
    throw new Error(`Line ${cursor.index + 1}: unexpected script content`)
  }

  return commands
}

function parseScriptBlock(lines, cursor, stopAtEnd = false) {
  const commands = []

  while (cursor.index < lines.length) {
    const lineNumber = cursor.index + 1
    const rawLine = lines[cursor.index]
    cursor.index++

    let tokens
    try {
      tokens = tokenizeScriptLine(rawLine)
    } catch (error) {
      throw new Error(`Line ${lineNumber}: ${error.message}`)
    }

    if (!tokens) continue

    const command = normalizeScriptCommand(tokens[0])
    const args = tokens.slice(1)

    if (command === 'end') {
      if (!stopAtEnd) throw new Error(`Line ${lineNumber}: unexpected end`)
      return commands
    }

    if (command === 'repeat') {
      const count = parseRepeatCount(args[0], lineNumber)
      const body = parseScriptBlock(lines, cursor, true)
      commands.push({ type: 'repeat', count, body, lineNumber })
      continue
    }

    commands.push({ type: 'command', command, args, lineNumber })
  }

  if (stopAtEnd) throw new Error('Missing end for repeat block')

  return commands
}

function tokenizeScriptLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return

  const tokens = []
  let token = ''
  let quote = ''
  let escaped = false

  for (const char of trimmed) {
    if (escaped) {
      token += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = ''
      } else {
        token += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (token) {
        tokens.push(token)
        token = ''
      }
      continue
    }

    token += char
  }

  if (quote) throw new Error('unclosed quote')
  if (escaped) token += '\\'
  if (token) tokens.push(token)

  return tokens.length ? tokens : undefined
}

function normalizeScriptCommand(command) {
  const commandName = String(command || '').toLowerCase()
  const aliases = {
    say: 'chat',
    wait: 'delay',
    sleep: 'delay',
    useheld: 'useheld',
    sethotbar: 'sethotbar',
    winclick: 'winclick',
    closewindow: 'closewindow',
    startmove: 'startmove',
    stopmove: 'stopmove',
    resetmove: 'resetmove',
    afkon: 'afkon',
    afkoff: 'afkoff'
  }

  return aliases[commandName] || commandName
}

function parseRepeatCount(value, lineNumber) {
  const count = parseInt(value, 10)
  if (!Number.isFinite(count) || count < 1) {
    throw new Error(`Line ${lineNumber}: repeat needs a number greater than 0`)
  }
  return Math.min(count, 1000)
}

async function startScript(username, commands = prepareScript()) {
  if (!commands) return

  try {
    await runScriptCommands(username, commands)
  } catch (error) {
    sendEvent(username, 'chat', `Script error: ${error.message}`)
    notify('Script Error', `${username}: ${error.message}`, 'error', undefined, true)
  }
}

async function runScriptCommands(username, commands) {
  for (const command of commands) {
    if (stopScript) return

    if (command.type === 'repeat') {
      for (let i = 0; i < command.count; i++) {
        if (stopScript) return
        await runScriptCommands(username, command.body)
      }
      continue
    }

    await runScriptCommand(username, command)
  }
}

async function runScriptCommand(username, command) {
  const args = command.args.map((arg) => renderScriptText(arg, username, command.lineNumber))

  switch (command.command) {
    case 'delay':
      await interruptibleDelay(getScriptDelay(args, command.lineNumber))
      break
    case 'log':
    case 'print':
      sendEvent(username, 'chat', `Script: ${args.join(' ')}`)
      break
    case 'select':
    case 'target':
      emitTargetedScriptCommand(username, args, command.lineNumber)
      break
    default:
      botApi.emit('botEvent', username, command.command, args)
      break
  }
}

function emitTargetedScriptCommand(username, args, lineNumber) {
  const selector = args[0]
  const command = normalizeScriptCommand(args[1])
  const commandArgs = args.slice(2)

  if (!selector || !command) {
    throw new Error(`Line ${lineNumber}: select needs a target and command`)
  }

  const targets = resolveScriptTargets(selector, username)
  if (targets.length === 0) throw new Error(`Line ${lineNumber}: no bots matched ${selector}`)

  targets.forEach((target) => {
    botApi.emit('botEvent', target, command, commandArgs)
  })
}

function resolveScriptTargets(selector, username) {
  const normalizedSelector = selector.toLowerCase()
  const onlineBots = Array.from(connectedBots)
  const selectedBots = playerList.filter((player) => connectedBots.has(player))

  switch (normalizedSelector) {
    case 'me':
    case 'self':
      return [username]
    case 'all':
    case 'online':
      return onlineBots
    case 'selected':
      return selectedBots
    case 'others':
      return onlineBots.filter((player) => player !== username)
    case 'random':
      const pool = selectedBots.length > 0 ? selectedBots : onlineBots
      if (pool.length === 0) return []
      return [pool[crypto.randomInt(0, pool.length)]]
    default:
      return onlineBots.filter((player) => player.toLowerCase() === normalizedSelector)
  }
}

function renderScriptText(value, username, lineNumber) {
  return String(value ?? '')
    .replaceAll('{player}', username)
    .replaceAll('{username}', username)
    .replaceAll('{line}', String(lineNumber))
    .replaceAll('{time}', new Date().toLocaleTimeString())
    .replace(/\{random(?::(\d+))?\}/g, (match, length) => {
      const size = Math.min(Math.max(parseInt(length || '4', 10), 1), 32)
      return salt(size)
    })
}

function getScriptDelay(args, lineNumber) {
  const values = args[0]?.toLowerCase() === 'random' ? args.slice(1) : args
  const first = parseInt(values[0] || '1000', 10)
  const second = parseInt(values[1], 10)

  if (!Number.isFinite(first) || first < 0) {
    throw new Error(`Line ${lineNumber}: delay needs a positive number`)
  }

  if (!Number.isFinite(second)) return first
  if (second < 0) throw new Error(`Line ${lineNumber}: delay range must be positive`)

  const min = Math.min(first, second)
  const max = Math.max(first, second)

  if (min === max) return min
  return crypto.randomInt(min, max + 1)
}

async function interruptibleDelay(ms) {
  const endAt = Date.now() + ms
  while (!stopScript && Date.now() < endAt) {
    await delay(Math.min(250, endAt - Date.now()))
  }
}

async function exeAll(command) {
  if (!command) return
  const list = playerList
  const cmd = command.split(' ')
  if (list.length == 0) return notify('Error', 'No bots selected', 'error')
  for (let i = 0; i < list.length; i++) {
    botApi.emit('botEvent', list[i], cmd[0], cmd.slice(1))
    if (storeinfo().boolean.isLinear) {
      await delay(storeinfo().value.linearDelay || 100)
    }
  }
  sendEvent('Executed', 'chat', 'Script: ' + command)
}

async function startFile() {
  BrowserWindow.getAllWindows()[0].webContents.send('showBottab')
  const filePath = storeinfo().namefile
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)
  const count = storeinfo().value.botMax || lines.length

  for (let i = 0; i < count; i++) {
    if (stopBot) break
    newBot(getBotInfo(lines[i]))
    await delay(storeinfo().value.joinDelay || 1000)
  }
}

async function connectBot() {
  stopBot = false
  currentProxy = 0
  proxyUsed = 0
  const count = storeinfo().value.botMax || 1
  if (!(await canUseSelectedVersion())) return

  if (storeinfo().value.nameType === 'file' && storeinfo().namefile) {
    BrowserWindow.getAllWindows()[0].webContents.send('showBottab')
  } else if (storeinfo().value.nameType !== 'file' && storeinfo().value.nameType !== 'default') {
    BrowserWindow.getAllWindows()[0].webContents.send('showBottab')
  }

  for (let i = 0; i < count; i++) {
    if (stopBot) break

    let botInfo

    switch (storeinfo().value.nameType) {
      case 'random':
        botInfo = getBotInfo(salt(10))
        break
      case 'legit':
        botInfo = getBotInfo(genName())
        break
      case 'file':
        if (!storeinfo().namefile) {
          notify('Error', 'Please select name file', 'error')
        } else {
          startFile()
        }
        return
      default:
        if (!storeinfo().value.username) return notify('Error', 'Please insert username', 'error')
        const username =
          count == 1 ? storeinfo().value.username : storeinfo().value.username + '_' + i
        botInfo = getBotInfo(username)
        if (i == 0) BrowserWindow.getAllWindows()[0].webContents.send('showBottab')
    }

    newBot(botInfo)
    await delay(storeinfo().value.joinDelay || 1000)
  }
}

function getBotInfo(botName) {
  const server = storeinfo().value.server || 'localhost:25565'
  const [serverHost, serverPort] = server.split(':')
  const parsedPort = parseInt(serverPort) || 25565

  const selectedVersion = resolveMinecraftVersion(storeinfo().value.version)

  const options = {
    host: serverHost,
    port: parsedPort,
    username: botName,
    version: selectedVersion,
    auth: storeinfo().value.authType,
    hideErrors: true,
    joinMessage: storeinfo().value.joinMessage,
    ...botMode(storeinfo().value.botMode),
    ...getProxy(storeinfo().value.proxyType)
  }

  if (options.auth === 'easymc') {
    options.auth = easyMcAuth
    options.sessionServer = 'https://sessionserver.easymc.io'
  }

  return options
}

function getProxy(proxyType) {
  if (proxyType === 'none' || !storeinfo().value.proxyList) return

  const proxyList = storeinfo().value.proxyList.split(/\r?\n/)
  const randomIndex = crypto.randomInt(0, proxyList.length)

  const proxyPerBot = storeinfo().value.proxyPerBot

  if (proxyUsed >= proxyPerBot) {
    proxyUsed = 0
    currentProxy++
    if (currentProxy >= proxyList.length) {
      currentProxy = 0
    }
  }

  proxyUsed++

  const index = storeinfo().boolean.randomizeOrder ? randomIndex : currentProxy
  const [host, port, username, password] = proxyList[index].split(':')
  return {
    protocol: proxyType,
    proxyHost: host,
    proxyPort: port,
    proxyUsername: username,
    proxyPassword: password
  }
}

function newBot(options) {
  let bot

  if (options.auth === 'easymc') {
    if (options.easyMcToken?.length !== 20) {
      return sendEvent(options.username, 'easymcAuth')
    }
    options.auth = easyMcAuth
    options.sessionServer ||= 'https://sessionserver.easymc.io'
  }

  const connectProxy = async (client) => {
    try {
      const socket = await connection(
        storeinfo().value.proxyType,
        options.proxyHost,
        options.proxyPort,
        options.proxyUsername,
        options.proxyPassword,
        options.host,
        options.port
      )
      client.setSocket(socket)
      client.emit('connect')
    } catch (error) {
      if (storeinfo().boolean.proxyLogChat) {
        sendEvent(
          client.username,
          'chat',
          options.proxyHost + ':' + options.proxyPort + ' ' + error
        )
      }
      sendWebhook(
        'proxy',
        'Proxy Connection Error',
        String(error),
        [
          { name: 'Bot', value: client.username || options.username || '-', inline: true },
          { name: 'Proxy', value: `${options.proxyHost}:${options.proxyPort}`, inline: true }
        ],
        { color: webhookColors.error }
      )
      return
    }
  }

  if (storeinfo().value.proxyType !== 'none') {
    options.connect = connectProxy
  }

  const disabledPlugins = {
    anvil: false,
    book: false,
    boss_bar: false,
    breath: false,
    chest: false,
    command_block: false,
    craft: false,
    creative: false,
    enchantment_table: false,
    experience: false,
    explosion: false,
    fishing: false,
    furnace: false,
    generic_place: false,
    painting: false,
    particle: false,
    place_block: false,
    place_entity: false,
    rain: false,
    ray_trace: false,
    scoreboard: false,
    sound: false,
    spawn_point: false,
    tablist: false,
    team: false,
    time: false,
    title: false,
    villager: false
  }

  bot = mineflayer.createBot({
    ...options,
    plugins: {
      ...disabledPlugins,
      ...(options.plugins || {})
    },
    onMsaCode: (data) => {
      sendEvent(options.username, 'authmsg', data.user_code)
    }
  })
  bot.loadPlugin(pathfinder)

  let hitTimer = 0
  let auraBusy = false
  let nukerActive = false
  let nukerBusy = false
  let nukerCooldown = 0
  let pathfinderReady = false
  const recentServerChats = []

  bot.once('login', () => {
    connectedBots.add(bot._client.username)
    sendEvent(bot._client.username, 'login')
    if (storeinfo().boolean.runOnConnect) {
      stopScript = false
      startScript(bot._client.username)
    }
    if (storeinfo().value.joinMessage) {
      bot.chat(storeinfo().value.joinMessage)
    }
  })
  bot.once('spawn', () => {
    bot.loadPlugin(antiafk)
    setupPathfinder()
  })
  bot.on('spawn', () => {
    setupPathfinder()
    if (storeinfo().boolean.runOnSpawn) {
      stopScript = false
      startScript(bot._client.username)
    }
  })
  bot.on('chat', (username, message) => {
    sendServerChat(bot._client.username, username, message, recentServerChats)
  })
  bot.on('messagestr', (msg) => {
    setTimeout(() => {
      if (!isRecentServerChat(msg, recentServerChats)) {
        sendEvent(bot._client.username, 'chat', msg)
      }
    }, 120)
  })
  bot.on('windowOpen', (window) => {
    sendEvent(
      bot._client.username,
      'chat',
      `Window Opened ' ${window.title ? ':' + window.title : ''}`
    )
  })
  bot.on('windowClose', (window) => {
    sendEvent(
      bot._client.username,
      'chat',
      `Window Closed ' ${window.title ? ':' + window.title : ''}`
    )
  })
  bot.once('kicked', (reason) => {
    connectedBots.delete(bot._client.username)
    sendEvent(bot._client.username, 'kicked', appendVersionHint(formatKickReason(reason)))
  })
  bot.once('end', (reason) => {
    connectedBots.delete(bot._client.username)
    sendEvent(bot._client.username, 'end', appendVersionHint(reason))
    if (storeinfo().boolean.autoReconnect) {
      setTimeout(() => {
        newBot(options)
      }, storeinfo().value.reconnectDelay || 1000)
    }
  })

  bot.on('physicTick', () => {
    const isSelected = playerList.includes(bot._client.username)
    if (storeinfo().boolean.killauraToggle && isSelected) {
      killaura()
    }
    if (
      (storeinfo().boolean.nukerToggle || nukerActive) &&
      isSelected &&
      !suspendedBotControls.has('nuker')
    ) {
      runNuker()
    }
  })

  function setupPathfinder() {
    if (pathfinderReady || !bot.pathfinder) return
    try {
      const movements = new Movements(bot)
      movements.canDig = true
      movements.allow1by1towers = false
      bot.pathfinder.setMovements(movements)
      pathfinderReady = true
    } catch (error) {
      sendEvent(bot._client.username, 'chat', `Pathfinder setup error: ${error.message}`)
    }
  }

  function killaura() {
    if (hitTimer <= 0) {
      hit(
        storeinfo().boolean.targetPlayer,
        storeinfo().boolean.targetVehicle,
        storeinfo().boolean.targetMob,
        storeinfo().boolean.targetAnimal,
        storeinfo().value.killauraRange,
        storeinfo().boolean.killauraRotate,
        storeinfo().value.killauraPriority,
        storeinfo().value.killauraMaxTargets,
        storeinfo().boolean.killauraOnlyVisible
      )
      hitTimer = clampNumber(storeinfo().value.killauraDelay, 1, 60, 10)
    } else {
      hitTimer--
    }
  }

  function hit(
    player,
    vehicle,
    mob,
    animal,
    maxDistance,
    rotate,
    priority = 'nearest',
    maxTargets = 1,
    onlyVisible = false
  ) {
    const targetEntities = []
    const entities = Object.values(bot.entities)
    const range = clampNumber(maxDistance, 1, 8, 3)
    entities.forEach((entity) => {
      if (!entity?.position || entity === bot.entity || entity.isValid === false) return
      const distance = bot.entity.position.distanceTo(entity.position)
      if (distance > range || distance < 0.2) return
      if (
        toBoolean(onlyVisible) &&
        typeof bot.canSeeEntity === 'function' &&
        !bot.canSeeEntity(entity)
      ) {
        return
      }
      if (entity.type === 'player' && entity.username !== bot.username && toBoolean(player)) {
        targetEntities.push(entity)
      }
      if (entity.kind === 'Vehicles' && toBoolean(vehicle)) {
        targetEntities.push(entity)
      }
      if (entity.kind === 'Hostile mobs' && toBoolean(mob)) {
        targetEntities.push(entity)
      }
      if (entity.kind === 'Passive mobs' && toBoolean(animal)) {
        targetEntities.push(entity)
      }
    })

    const selectedTargets = sortTargets(targetEntities, priority).slice(
      0,
      clampNumber(maxTargets, 1, 6, 1)
    )
    attackTargets(selectedTargets, rotate)
  }

  function sortTargets(entities, priority) {
    const sorted = [...entities]
    switch (priority) {
      case 'health':
        sorted.sort((a, b) => (a.health ?? 999) - (b.health ?? 999))
        break
      case 'random':
        sorted.sort(() => Math.random() - 0.5)
        break
      default:
        sorted.sort((a, b) => {
          return (
            bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
          )
        })
        break
    }
    return sorted
  }

  async function attackTargets(entities, rotate) {
    if (auraBusy || entities.length === 0) return
    auraBusy = true
    try {
      for (const entity of entities) {
        if (!entity?.position || entity.isValid === false) continue
        if (toBoolean(rotate)) {
          await bot.lookAt(entity.position.offset(0, entity.height || 1, 0), true)
        }
        bot.attack(entity)
        await delay(80)
      }
    } catch (error) {
      sendEvent(bot._client.username, 'chat', `KillAura error: ${error.message}`)
    } finally {
      auraBusy = false
    }
  }

  async function interactBlock(action, args) {
    const position = parsePositionArgs(args, bot.entity.position, Math.floor(bot.entity.position.y))
    if (!position) {
      sendEvent(bot._client.username, 'chat', 'Interact needs coords: x y z or x z')
      return
    }

    const block = bot.blockAt(position.floored())
    if (!block || block.name === 'air') {
      sendEvent(bot._client.username, 'chat', `Interact: no block at ${formatPosition(position)}`)
      return
    }

    try {
      await bot.lookAt(block.position.offset(0.5, 0.5, 0.5), true)
      if (action === 'left') {
        if (typeof bot.canDigBlock === 'function' && !bot.canDigBlock(block)) {
          bot.swingArm('right')
          sendEvent(bot._client.username, 'chat', `Interact: cannot dig ${block.name}`)
          return
        }
        await bot.dig(block, true)
      } else {
        await bot.activateBlock(block)
      }
      sendEvent(
        bot._client.username,
        'chat',
        `Interact ${action}: ${block.name} @ ${formatPosition(block.position)}`
      )
    } catch (error) {
      sendEvent(bot._client.username, 'chat', `Interact error: ${error.message}`)
    }
  }

  function getNukerRanges() {
    const value = storeinfo().value
    return {
      up: clampNumber(value.nukerRangeUp, 0, 6, 0),
      down: clampNumber(value.nukerRangeDown, 0, 6, 0),
      left: clampNumber(value.nukerRangeLeft, 0, 6, 0),
      right: clampNumber(value.nukerRangeRight, 0, 6, 0),
      forward: clampNumber(value.nukerRangeForward, 0, 6, 0),
      back: clampNumber(value.nukerRangeBack, 0, 6, 0)
    }
  }

  function getFacingBasis() {
    const yaw = bot.entity.yaw || 0
    return {
      forwardX: Math.round(-Math.sin(yaw)),
      forwardZ: Math.round(-Math.cos(yaw)),
      rightX: Math.round(Math.cos(yaw)),
      rightZ: Math.round(-Math.sin(yaw))
    }
  }

  function localOffsetToWorld(side, vertical, forward) {
    const basis = getFacingBasis()
    return new Vec3(
      basis.rightX * side + basis.forwardX * forward,
      vertical,
      basis.rightZ * side + basis.forwardZ * forward
    )
  }

  function shouldNukeBlock(block, blockList, targetMode) {
    if (!block || block.name === 'air' || block.boundingBox === 'empty') return false
    if (block.name.includes('water') || block.name.includes('lava')) return false
    if (typeof bot.canDigBlock === 'function' && !bot.canDigBlock(block)) return false

    const defaultBlacklist = new Set([
      'bedrock',
      'barrier',
      'command_block',
      'chain_command_block',
      'repeating_command_block',
      'structure_block',
      'jigsaw',
      'end_portal',
      'end_portal_frame',
      'nether_portal'
    ])
    const blockName = block.name.toLowerCase()
    const listed = blockList.has(blockName)

    if (targetMode === 'whitelist') return listed
    return !defaultBlacklist.has(blockName) && !listed
  }

  function collectNukerBlocks() {
    const ranges = getNukerRanges()
    const blockList = parseBlockNames(storeinfo().value.nukerBlocks)
    const targetMode = storeinfo().value.nukerTargetMode || 'blacklist'
    const origin = bot.entity.position.floored()
    const seen = new Set()
    const blocks = []

    for (let side = -ranges.left; side <= ranges.right; side++) {
      for (let vertical = -ranges.down; vertical <= ranges.up; vertical++) {
        for (let forward = -ranges.back; forward <= ranges.forward; forward++) {
          if (side === 0 && vertical === 0 && forward === 0) continue
          const offset = localOffsetToWorld(side, vertical, forward)
          const position = origin.offset(offset.x, offset.y, offset.z)
          const key = `${position.x}:${position.y}:${position.z}`
          if (seen.has(key)) continue
          seen.add(key)

          const block = bot.blockAt(position)
          if (shouldNukeBlock(block, blockList, targetMode)) blocks.push(block)
        }
      }
    }

    return blocks.sort((a, b) => {
      return bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
    })
  }

  async function runNuker() {
    if (nukerBusy) return
    if (nukerCooldown > 0) {
      nukerCooldown--
      return
    }

    const blocksPerTick = clampNumber(storeinfo().value.nukerBlocksPerTick, 1, 8, 1)
    const blocks = collectNukerBlocks().slice(0, blocksPerTick)
    if (blocks.length === 0) {
      nukerCooldown = 8
      return
    }

    nukerBusy = true
    try {
      for (const block of blocks) {
        if (toBoolean(storeinfo().boolean.nukerRotate)) {
          await bot.lookAt(block.position.offset(0.5, 0.5, 0.5), true)
        }
        await bot.dig(block, true)
        await delay(35)
      }
    } catch (error) {
      sendEvent(bot._client.username, 'chat', `Nuker error: ${error.message}`)
      nukerCooldown = 10
    } finally {
      nukerBusy = false
    }
  }

  function ensurePathfinder() {
    setupPathfinder()
    if (bot.pathfinder && pathfinderReady) return true
    sendEvent(
      bot._client.username,
      'chat',
      'Pathfinder is not ready yet. Use Normal mode and wait for spawn.'
    )
    return false
  }

  function findPlayerEntity(name) {
    const playerName = String(name || '')
    return bot.players[playerName]?.entity
  }

  function runPathfinderCommand(args) {
    if (!ensurePathfinder()) return
    const command = String(args[0] || '').toLowerCase()

    switch (command) {
      case 'goto': {
        const position = parsePositionArgs(
          args.slice(1),
          bot.entity.position,
          bot.entity.position.y
        )
        if (!position) {
          sendEvent(bot._client.username, 'chat', 'Pathfinder goto needs: goto x y z or goto x z')
          return
        }
        bot.pathfinder.setGoal(new goals.GoalNear(position.x, position.y, position.z, 1))
        sendEvent(bot._client.username, 'chat', `Pathfinder: goto ${formatPosition(position)}`)
        break
      }
      case 'follow': {
        const entity = findPlayerEntity(args[1])
        if (!entity) {
          sendEvent(bot._client.username, 'chat', `Pathfinder: player not found ${args[1] || ''}`)
          return
        }
        bot.pathfinder.setGoal(new goals.GoalFollow(entity, clampNumber(args[2], 1, 8, 2)), true)
        sendEvent(bot._client.username, 'chat', `Pathfinder: following ${args[1]}`)
        break
      }
      case 'followline': {
        const entity = findPlayerEntity(args[1])
        if (!entity) {
          sendEvent(bot._client.username, 'chat', `Pathfinder: player not found ${args[1] || ''}`)
          return
        }
        const spacing = clampNumber(args[2], 1, 6, 2)
        const order = Math.max(playerList.indexOf(bot._client.username), 0) + 1
        const x = entity.position.x + Math.sin(entity.yaw || 0) * spacing * order
        const z = entity.position.z + Math.cos(entity.yaw || 0) * spacing * order
        bot.pathfinder.setGoal(new goals.GoalNear(x, entity.position.y, z, 1))
        sendEvent(bot._client.username, 'chat', `Pathfinder: line behind ${args[1]}`)
        break
      }
      case 'stop':
        bot.pathfinder.stop()
        bot.clearControlStates()
        sendEvent(bot._client.username, 'chat', 'Pathfinder: stopped')
        break
      default:
        sendEvent(
          bot._client.username,
          'chat',
          'Pathfinder commands: goto, follow, followLine, stop'
        )
        break
    }
  }

  botApi.on('botEvent', (target, event, ...options) => {
    if (target !== bot._client.username) return
    const optionsArray = options[0]
    if (suspendedBotControls.has(event)) {
      if (event === 'nuker') nukerActive = false
      sendEvent(
        bot._client.username,
        'chat',
        `${event}: temporarily under maintenance. This feature will return in future versions.`
      )
      return
    }
    if (event !== 'chat') {
      sendWebhook('action', 'Bot Command', `${event} ${optionsArray?.join(' ') || ''}`, [
        { name: 'Bot', value: bot._client.username, inline: true }
      ])
    }
    switch (event) {
      case 'disconnect':
        bot.quit()
        break
      case 'chat':
        const bypass = storeinfo().boolean.bypassChat ? ' ' + salt(crypto.randomInt(2, 6)) : ''
        const chatMessage =
          optionsArray
            .join(' ')
            .replaceAll('{random}', salt(4))
            .replaceAll('{player}', bot._client.username) + bypass
        bot.chat(chatMessage)
        sendWebhook('chat', 'Outgoing Chat', chatMessage, [
          { name: 'Bot', value: bot._client.username, inline: true }
        ])
        break
      case 'notify':
        notify(
          'Bot',
          bot._client.username +
            ': ' +
            optionsArray
              .join(' ')
              .replaceAll('{random}', salt(4))
              .replaceAll('{player}', bot._client.username),
          'success'
        )
        break
      case 'sethotbar':
        bot.setQuickBarSlot(parseInt(optionsArray[0] ? optionsArray[0] : 0))
        break
      case 'useheld':
        bot.activateItem()
        break
      case 'winclick':
        bot.clickWindow(parseInt(optionsArray[0]), parseInt(optionsArray[1]), 0)
        break
      case 'drop':
        bot.clickWindow(-999, 0, 0)
        bot.clickWindow(parseInt(optionsArray[0]), 0, 0)
        bot.clickWindow(-999, 0, 0)
        break
      case 'dropall':
        ;(async () => {
          const itemCount = bot.inventory.items().length
          for (var i = 0; i < itemCount; i++) {
            if (bot.inventory.items().length === 0) return
            const item = bot.inventory.items()[0]
            bot.tossStack(item)
            await delay(10)
          }
        })()
        break
      case 'closewindow':
        bot.closeWindow(bot.currentWindow || '')
        break
      case 'startmove':
        bot.setControlState(optionsArray[0], true)
        break
      case 'stopmove':
        bot.setControlState(optionsArray[0], false)
        break
      case 'resetmove':
        bot.clearControlStates()
        break
      case 'look':
        bot.look(parseFloat(optionsArray[0]), 0, true)
        break
      case 'afkon':
        bot.afk.start()
        break
      case 'afkoff':
        bot.afk.stop()
        break
      case 'interact':
        interactBlock(optionsArray[0], optionsArray.slice(1))
        break
      case 'nuker':
        if (optionsArray[0] === 'start') {
          nukerActive = true
          sendEvent(bot._client.username, 'chat', 'Nuker: started')
        } else if (optionsArray[0] === 'stop') {
          nukerActive = false
          sendEvent(bot._client.username, 'chat', 'Nuker: stopped')
        }
        break
      case 'pathfinder':
        runPathfinderCommand(optionsArray)
        break
      case 'hit':
        const player = optionsArray[0]
        const vehicle = optionsArray[1]
        const mob = optionsArray[2]
        const animal = optionsArray[3]
        const maxDistance = parseFloat(optionsArray[4])
        const rotate = optionsArray[5]
        const priority = optionsArray[6]
        const maxTargets = optionsArray[7]
        const onlyVisible = optionsArray[8]
        hit(player, vehicle, mob, animal, maxDistance, rotate, priority, maxTargets, onlyVisible)
        break
      default:
    }
  })
}

process.on('uncaughtException', (err) => {
  console.log(err)
})
process.on('UnhandledPromiseRejectionWarning', (err) => {
  console.log(err)
})
