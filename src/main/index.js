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
import { applyElyByAuth } from './js/misc/customAuth'
import { createGeminiMinecraftController } from './js/geminiController'
import { createMobilityEngine } from './js/mobilityEngine'
import EventEmitter from 'node:events'
const Store = require('electron-store')
const mineflayer = require('mineflayer')
const { Vec3 } = require('vec3')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
import { antiafk } from './js/misc/antiafk'

const botApi = new EventEmitter()
botApi.setMaxListeners(0)
const store = new Store()
const suspendedBotControls = new Set(['interact', 'nuker'])
const UPDATE_REPO = 'Cmmdx256/TrafficerTR'
const UPDATE_API_URL = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`
const UPDATE_RELEASES_URL = `https://github.com/${UPDATE_REPO}/releases/latest`

let stopBot = false
let stopScript = false
let stopProxyTest = false
let currentProxy = 0
let proxyUsed = 0

function configureElectronStorage() {
  const appData = app.getPath('appData')
  const safeUserData = join(appData, 'TrafficerTR')
  const safeSessionData = join(safeUserData, 'Session')
  fs.mkdirSync(safeSessionData, { recursive: true })
  app.setPath('userData', safeUserData)
  app.setPath('sessionData', safeSessionData)
  app.commandLine.appendSwitch('disk-cache-dir', join(safeSessionData, 'Cache'))
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
}

configureElectronStorage()

function storeinfo() {
  return store.get('config')
}

function getConfiguredAiModel() {
  const configured = storeinfo()?.value?.aiModel
  if (!configured || !String(configured).startsWith('gemini-')) {
    return process.env.GEMINI_MODEL || 'gemini-flash-latest'
  }
  return configured
}

function getConfiguredAiProvider() {
  return 'gemini'
}

function getConfiguredGeminiApiKey() {
  return (
    String(storeinfo()?.value?.geminiApiKey || '').trim() ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY
  )
}

const BACKGROUND_MIME_TYPES = {
  gif: 'image/gif',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
}

function getBackgroundPayload(filePath) {
  const cleanPath = typeof filePath === 'string' ? filePath : ''
  if (!cleanPath) return { path: '', url: '', error: '' }

  try {
    if (!fs.existsSync(cleanPath)) {
      return { path: cleanPath, url: '', error: 'File not found' }
    }

    const extension = cleanPath.match(/\.([^.]+)$/)?.[1]?.toLowerCase() || 'gif'
    const mimeType = BACKGROUND_MIME_TYPES[extension] || 'image/gif'
    const fileData = fs.readFileSync(cleanPath).toString('base64')
    return {
      path: cleanPath,
      url: `data:${mimeType};base64,${fileData}`,
      error: ''
    }
  } catch (error) {
    console.log(error)
    return {
      path: cleanPath,
      url: '',
      error: error?.message || 'Could not read background file'
    }
  }
}

function rememberRecent(map, key, ttlMs) {
  const now = Date.now()
  for (const [entryKey, at] of map.entries()) {
    if (now - at > ttlMs) map.delete(entryKey)
  }
  if (map.has(key)) return false
  map.set(key, now)
  return true
}

let clientVersion = app.getVersion().replace(/\.0$/, '')

let playerList = []
let connectedBots = new Set()
let webhookSending = false
const webhookQueue = []
const recentGlobalServerChats = []
const SERVER_CHAT_DEDUPE_MS = 1800
const recentGeminiChatInputs = new Map()
const recentGeminiChatReplies = new Map()
const GEMINI_CHAT_DEDUPE_MS = 3500

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
    type,
    force: Boolean(options.force),
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
    const currentUrl = getWebhookUrl()
    if (!currentUrl || currentUrl !== item.url || !canSendWebhook(item.type, item.force)) {
      continue
    }
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

function rememberRecentServerChat(sender, message, recentChats) {
  recentChats.push({
    sender: normalizeChatLine(sender),
    message: normalizeChatLine(message),
    at: Date.now()
  })
  if (recentChats.length > 12) recentChats.shift()
}

function claimServerChatLog(sender, message) {
  const now = Date.now()
  const key = `${normalizeChatLine(sender)}:${normalizeChatLine(message)}`

  for (let i = recentGlobalServerChats.length - 1; i >= 0; i--) {
    if (now - recentGlobalServerChats[i].at > SERVER_CHAT_DEDUPE_MS) {
      recentGlobalServerChats.splice(i, 1)
    }
  }

  if (recentGlobalServerChats.some((chat) => chat.key === key)) return false

  recentGlobalServerChats.push({ key, at: now })
  if (recentGlobalServerChats.length > 150) recentGlobalServerChats.shift()
  return true
}

function shouldLogMessageString(position) {
  // Mineflayer marks actionbar/status UI as "game_info" and server UI text as "system".
  // Keep the console focused on real player chat; bot lifecycle/events are logged separately.
  return position === 'chat'
}

function publishServerChat(botName, sender, message) {
  sendRendererEvent(sender, 'serverchat', message)
  sendWebhook(
    'chat',
    'Server Chat',
    message,
    [
      { name: 'Bot', value: botName || 'unknown', inline: true },
      { name: 'Sender', value: sender, inline: true },
      { name: 'Server', value: storeinfo()?.value?.server || 'not set', inline: true }
    ],
    { color: webhookColors.chat }
  )
}

function sendServerChat(botName, sender, message, recentChats) {
  const cleanSender = readChatText(sender || 'Unknown') || 'Unknown'
  const cleanMessage = readChatText(message)
  if (!cleanMessage) return

  rememberRecentServerChat(cleanSender, cleanMessage, recentChats)
  if (!claimServerChatLog(cleanSender, cleanMessage)) return

  publishServerChat(botName, cleanSender, cleanMessage)
}

function sendUnparsedServerChat(botName, message) {
  const cleanMessage = readChatText(message)
  if (!cleanMessage) return
  if (!claimServerChatLog('Server', cleanMessage)) return

  publishServerChat(botName, 'Server', cleanMessage)
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
  const selectedVersion = configValue('version', '')
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

function configValue(key, fallback = undefined) {
  const value = storeinfo()?.value?.[key]
  return value === undefined || value === null ? fallback : value
}

function configBoolean(key, fallback = false) {
  const value = storeinfo()?.boolean?.[key]
  return value === undefined || value === null ? fallback : toBoolean(value)
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(number, min), max)
}

function stringifyDisconnectReason(reason) {
  if (!reason) return ''
  if (typeof reason === 'string') return reason
  return cleanText(reason) || JSON.stringify(reason)
}

function stringifyConnectionError(error) {
  const message =
    error?.message ||
    error?.code ||
    error?.name ||
    stringifyDisconnectReason(error) ||
    'Connection closed'
  const code =
    error?.code && !String(message).includes(String(error.code)) ? ` (${error.code})` : ''
  return `${message}${code}`
}

function isPermanentKickReason(reason) {
  return /ban|banned|blacklist|not whitelisted|whitelist|yasakland|kara.?liste|izinli.?liste/i.test(
    stringifyDisconnectReason(reason)
  )
}

function randomizeBannedUsername(username) {
  const name = String(username || '')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, 16)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_'
  if (!name) return salt(10)

  for (let attempt = 0; attempt < 8; attempt++) {
    const character = chars.charAt(crypto.randomInt(0, chars.length))
    const index = crypto.randomInt(0, Math.min(name.length, 15) + 1)
    const variant = `${name.slice(0, index)}${character}${name.slice(index)}`.slice(0, 16)
    if (variant !== name) return variant
  }

  const index = crypto.randomInt(0, name.length)
  const character = chars.charAt(crypto.randomInt(0, chars.length))
  return `${name.slice(0, index)}${character}${name.slice(index + 1)}` || salt(10)
}

function scheduleReconnect(options, reason) {
  if (options._manualDisconnect || stopBot) return

  const delayMs = 5000

  if (isPermanentKickReason(reason)) {
    if (options.auth === 'offline') {
      const oldUsername = options.username
      options.username = randomizeBannedUsername(options.username)
      options._reconnectAttempts = 0
      sendEvent(oldUsername, 'chat', `Name rejected by server. Retrying as ${options.username}`)
      setTimeout(() => {
        if (options._manualDisconnect || stopBot) return
        newBot(options)
      }, delayMs)
      return
    }
  }

  options._reconnectAttempts = Number(options._reconnectAttempts || 0) + 1
  const seconds = Math.ceil(delayMs / 1000)

  sendEvent(
    options.username,
    'chat',
    `Reconnect: retry ${options._reconnectAttempts} in ${seconds}s`
  )

  setTimeout(() => {
    if (options._manualDisconnect || stopBot) return
    newBot(options)
  }, delayMs)
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
    if (store.get('config.value.customBackground')) {
      mainWindow.webContents.send(
        'fileSelected',
        'customBackgroundLabel',
        getBackgroundPayload(store.get('config.value.customBackground'))
      )
    }
    mainWindow.show()
    checkForUpdates(mainWindow)
  })

  ipcMain.on('playerList', (event, list) => {
    playerList = list
  })

  ipcMain.on('open', (event, id, name) => {
    const isBackground = id === 'customBackgroundLabel'
    dialog
      .showOpenDialog(mainWindow, {
        title: name,
        filters: isBackground
          ? [{ name: 'Background image', extensions: ['gif', 'png', 'jpg', 'jpeg', 'webp'] }]
          : [{ name: 'Text File', extensions: ['txt'] }],
        properties: isBackground ? ['openFile'] : ['openFile', 'multiSelections']
      })
      .then((result) => {
        if (!result.canceled) {
          if (isBackground) {
            store.set('config.value.customBackground', result.filePaths[0])
          } else {
            store.set('config.namefile', result.filePaths[0])
          }
          mainWindow.webContents.send(
            'fileSelected',
            id,
            isBackground ? getBackgroundPayload(result.filePaths[0]) : result.filePaths[0]
          )
        }
      })
      .catch((error) => {
        console.log(error)
        return
      })
  })

  ipcMain.on('clearCustomBackground', () => {
    store.delete('config.value.customBackground')
    mainWindow.webContents.send('fileSelected', 'customBackgroundLabel', '')
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
  if (type === 'value' && id === 'aiModel') {
    exeAll(`pathfinder ai model ${value}`)
  }
  if (type === 'value' && id === 'geminiApiKey') {
    const targets = playerList.length > 0 ? playerList : Array.from(connectedBots)
    for (const player of targets) {
      botApi.emit('botEvent', player, 'pathfinder', ['ai', 'key', value])
    }
  }
})

ipcMain.on('deleteConfig', () => {
  store.delete('config')
})

ipcMain.on('checkboxClick', (event, id, state) => {
  switch (id) {
    case 'aiMode':
      exeAll(`pathfinder ai ${state ? 'on' : 'off'}`)
      break
    case 'test':
      console.log(state)
      break
    default:
  }
})

ipcMain.on('openExternal', (event, url) => {
  if (
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/releases(\/latest)?)?\/?$/i.test(
      String(url)
    )
  )
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
      exeAll('chat ' + configValue('chatMsg', ''))
      break
    case 'btnDisconnect':
      exeAll('disconnect')
      break
    case 'btnSetHotbar':
      exeAll('sethotbar ' + configValue('hotbarSlot', 0))
      break
    case 'btnUseheld':
      exeAll('useheld')
      break
    case 'btnWinClickRight':
      exeAll('winclick ' + configValue('invSlot', 0) + ' 1')
      break
    case 'btnWinClickLeft':
      exeAll('winclick ' + configValue('invSlot', 0) + ' 0')
      break
    case 'btnDropSlot':
      exeAll('drop ' + configValue('invSlot', 0))
      break
    case 'btnDropAll':
      exeAll('dropall')
      break
    case 'btnCloseWindow':
      exeAll('closewindow')
      break
    case 'btnStartMove':
      exeAll('startmove ' + configValue('moveType', 'forward'))
      break
    case 'btnStopMove':
      exeAll('stopmove ' + configValue('moveType', 'forward'))
      break
    case 'btnResetMove':
      exeAll('resetmove')
      break
    case 'btnLook':
      exeAll('look ' + configValue('lookDirection', 'north'))
      break
    case 'btnAfkOn':
      exeAll('afkon')
      break
    case 'btnAfkOff':
      exeAll('afkoff')
      break
    case 'btnInteractLeft':
      exeAll('interact left ' + configValue('interactCoords', ''))
      break
    case 'btnInteractRight':
      exeAll('interact right ' + configValue('interactCoords', ''))
      break
    case 'btnKillauraOnce':
      exeAll(
        [
          'hit',
          configBoolean('targetPlayer'),
          configBoolean('targetVehicle'),
          configBoolean('targetMob'),
          configBoolean('targetAnimal'),
          configValue('killauraRange', 3),
          configBoolean('killauraRotate'),
          configValue('killauraPriority', 'nearest'),
          configValue('killauraMaxTargets', 1),
          configBoolean('killauraOnlyVisible')
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
      exeAll('pathfinder ' + configValue('pathFinderCommand', ''))
      break
    case 'btnPathfinderStop':
      exeAll('pathfinder stop')
      break
    case 'btnAiModeToggle':
      exeAll('pathfinder ai ' + (configBoolean('aiMode') ? 'on' : 'off'))
      break
    case 'runScript':
      runScriptForPlayers(playerList)
      break
    case 'stopScript':
      stopScript = true
      notify('Info', 'Stopped running scripts.', 'success')
      break
    case 'proxyTestStart':
      testProxy(configValue('proxyList', ''))
      break
    case 'proxyTestStop':
      stopProxyTest = true
      proxyEvent('', 'stop', '', '')
      break
    case 'proxyScrape':
      if (configValue('proxyType', 'none') === 'none')
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
  scrapeProxy(configValue('proxyType', 'none'))
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
  const server = configValue('server', '')
  const [serverHost, serverPort] = server.split(':')
  if (!serverHost) return notify('Error', 'Invalid server address', 'error')
  if (!list) return notify('Error', 'Please enter proxy list', 'error')
  if (configValue('proxyType', 'none') === 'none')
    return notify('Error', 'Select proxy type', 'error')
  notify('Info', 'Testing proxies...', 'success')
  proxyEvent('', 'start', '', '')
  const lines = list.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (stopProxyTest) break
    const count = `${i + 1}/${lines.length}`
    const [host, port, username, password] = lines[i].split(':')
    checkProxy(
      configValue('proxyType', 'none'),
      host,
      port,
      username,
      password,
      serverHost,
      serverPort || 25565,
      configValue('proxyCheckTimeout', 5000),
      configValue('version', '')
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
    await delay(configValue('proxyCheckDelay', 100))
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
    if (configBoolean('isLinear')) {
      await delay(configValue('linearDelay', 100))
    }
  }
  sendEvent('Executed', 'chat', 'Script: ' + command)
}

async function startFile() {
  BrowserWindow.getAllWindows()[0].webContents.send('showBottab')
  const filePath = storeinfo().namefile
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)
  const count = configValue('botMax', lines.length) || lines.length

  for (let i = 0; i < count; i++) {
    if (stopBot) break
    newBot(getBotInfo(lines[i]))
    await delay(configValue('joinDelay', 1000))
  }
}

async function connectBot() {
  stopBot = false
  currentProxy = 0
  proxyUsed = 0
  const count = configValue('botMax', 1) || 1
  if (!(await canUseSelectedVersion())) return

  const nameType = configValue('nameType', 'default')
  if (nameType === 'file' && storeinfo()?.namefile) {
    BrowserWindow.getAllWindows()[0].webContents.send('showBottab')
  } else if (nameType !== 'file' && nameType !== 'default') {
    BrowserWindow.getAllWindows()[0].webContents.send('showBottab')
  }

  for (let i = 0; i < count; i++) {
    if (stopBot) break

    let botInfo

    switch (nameType) {
      case 'random':
        botInfo = getBotInfo(salt(10))
        break
      case 'legit':
        botInfo = getBotInfo(genName())
        break
      case 'file':
        if (!storeinfo()?.namefile) {
          notify('Error', 'Please select name file', 'error')
        } else {
          startFile()
        }
        return
      default:
        if (!configValue('username', '')) return notify('Error', 'Please insert username', 'error')
        const username =
          count == 1 ? configValue('username', '') : configValue('username', '') + '_' + i
        botInfo = getBotInfo(username)
        if (i == 0) BrowserWindow.getAllWindows()[0].webContents.send('showBottab')
    }

    newBot(botInfo)
    await delay(configValue('joinDelay', 1000))
  }
}

function getBotInfo(botName) {
  const server = configValue('server', 'localhost:25565')
  const [serverHost, serverPort] = server.split(':')
  const parsedPort = parseInt(serverPort) || 25565

  const selectedVersion = resolveMinecraftVersion(configValue('version', ''))
  const savedAuthType = configValue('authType', 'offline')
  const authType = ['offline', 'microsoft', 'elyby'].includes(savedAuthType)
    ? savedAuthType
    : 'offline'

  const options = {
    host: serverHost,
    port: parsedPort,
    username: botName,
    version: selectedVersion,
    auth: authType,
    hideErrors: true,
    joinMessage: configValue('joinMessage', ''),
    ...botMode(configValue('botMode', '')),
    ...getProxy(configValue('proxyType', 'none'))
  }

  if (options.auth === 'elyby') {
    applyElyByAuth(options)
  }

  if (storeinfo()?.boolean?.aiMode) options.physicsEnabled = true

  return options
}

function getProxy(proxyType) {
  const proxyListValue = configValue('proxyList', '')
  if (proxyType === 'none' || !proxyListValue) return

  const proxyList = proxyListValue.split(/\r?\n/)
  const randomIndex = crypto.randomInt(0, proxyList.length)

  const proxyPerBot = configValue('proxyPerBot', 1)

  if (proxyUsed >= proxyPerBot) {
    proxyUsed = 0
    currentProxy++
    if (currentProxy >= proxyList.length) {
      currentProxy = 0
    }
  }

  proxyUsed++

  const index = configBoolean('randomizeOrder') ? randomIndex : currentProxy
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
  let lastKickReason = ''

  options._manualDisconnect = Boolean(options._manualDisconnect)
  options._reconnectAttempts = Number(options._reconnectAttempts || 0)

  if (options.auth === 'elyby') {
    applyElyByAuth(options)
  }

  const connectProxy = async (client) => {
    try {
      const socket = await connection(
        configValue('proxyType', 'none'),
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
      if (configBoolean('proxyLogChat')) {
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

  if (configValue('proxyType', 'none') !== 'none') {
    options.connect = connectProxy
  }

  const disabledPlugins = {
    anvil: false,
    book: false,
    boss_bar: false,
    breath: false,
    chest: false,
    command_block: false,
    creative: false,
    enchantment_table: false,
    experience: false,
    explosion: false,
    fishing: false,
    furnace: false,
    painting: false,
    particle: false,
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

  const pluginOptions = {
    ...disabledPlugins,
    ...(options.plugins || {})
  }

  if (storeinfo()?.boolean?.aiMode) {
    ;[
      'blocks',
      'block_actions',
      'craft',
      'digging',
      'furnace',
      'generic_place',
      'health',
      'inventory',
      'place_block',
      'simple_inventory'
    ].forEach((plugin) => {
      delete pluginOptions[plugin]
    })
  }

  bot = mineflayer.createBot({
    ...options,
    plugins: pluginOptions,
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
  let pathfinderBusy = false
  let playerGotoTimer
  let aiModeAnnounced = false
  let aiThinkBusy = false
  let aiLastThink = 0
  let aiSpawnReady = false
  let aiRuntimeEnabled = false
  const aiCore = createGeminiMinecraftController({
    botName: options.username,
    llmModel: getConfiguredAiModel(),
    model: getConfiguredAiModel(),
    apiKey: getConfiguredGeminiApiKey(),
    store,
    sendEvent: (message) => sendEvent(bot?._client?.username || options.username, 'chat', message)
  })
  const mobility = createMobilityEngine({
    bot,
    goals,
    memory: aiCore.memory,
    eventBus: aiCore.eventBus,
    sendEvent: (message) => sendEvent(bot?._client?.username || options.username, 'chat', message),
    helpers: {
      placeBlock: (...args) => placeBlockAutonomously(...args),
      digBlock: (...args) => digBlockAutonomously(...args)
    }
  })
  aiCore.setMobility(mobility)
  const aiMemory = {
    owner: undefined,
    currentTask: 'idle',
    goal: 'beat_game',
    lastBodyActionAt: 0,
    lastPositionCheckAt: 0,
    lastKnownPosition: undefined,
    stuckTicks: 0,
    lastStatusAt: 0,
    lastThreatAt: 0,
    lastEatAt: 0,
    lastResourceAt: 0,
    lastPlanAt: 0,
    lastExploreAt: 0,
    lastHumanActionAt: 0,
    lastInventoryAt: 0,
    lastSmeltAt: 0,
    lastPlanMessage: '',
    lastDeterministicActionAt: 0,
    failedTargets: new Map(),
    reportedBlocks: new Set(),
    actionHistory: []
  }
  const recentServerChats = []

  async function waitForBotReady(timeoutMs = 10000) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      if (
        bot.entity &&
        bot.world &&
        Number.isFinite(Number(bot.health)) &&
        Number.isFinite(Number(bot.food))
      ) {
        return true
      }
      await delay(100)
    }
    return false
  }

  bot.once('login', () => {
    const loginName = bot._client?.username || bot.username || options.username
    if (loginName) {
      connectedBots.add(loginName)
      aiCore.botName = loginName
    }
    sendEvent(loginName, 'login')
    aiCore.emit('bot.login', { username: loginName, server: options.host })
    if (configBoolean('runOnConnect')) {
      stopScript = false
      startScript(loginName)
    }
    const joinMessage = configValue('joinMessage', '')
    if (joinMessage) {
      bot.chat(joinMessage)
    }
  })
  bot.once('spawn', async () => {
    const ready = await waitForBotReady()
    aiSpawnReady = ready
    console.log('[MINEFLAYER] spawn event fired', {
      entity: Boolean(bot.entity),
      health: bot.health,
      food: bot.food,
      worldLoaded: Boolean(bot.world),
      ready
    })
    options._reconnectAttempts = 0
    bot.loadPlugin(antiafk)
    setupPathfinder()
    if (ready) aiCore.emit('bot.spawn', { position: formatPosition(bot.entity.position) })
  })
  bot.on('spawn', async () => {
    const ready = await waitForBotReady()
    aiSpawnReady = ready
    console.log('[MINEFLAYER] spawn event fired', {
      entity: Boolean(bot.entity),
      health: bot.health,
      food: bot.food,
      worldLoaded: Boolean(bot.world),
      ready
    })
    setupPathfinder()
    if (ready) aiCore.emit('bot.respawn_or_spawn', { position: formatPosition(bot.entity.position) })
    if (ready && configBoolean('runOnSpawn')) {
      stopScript = false
      startScript(bot._client.username)
    }
  })
  bot.on('chat', (username, message) => {
    sendServerChat(bot._client.username, username, message, recentServerChats)
    aiCore.memory.rememberPlayer(username, {
      interactions: (aiCore.memory.state.players[username]?.interactions || 0) + 1
    })
    aiCore.emit('social.chat', { username, message })
    handleAiChat(username, message)
  })
  bot.on('messagestr', (msg, position) => {
    if (!shouldLogMessageString(position)) return
    if (configBoolean('aiMode') && !isRecentServerChat(msg, recentServerChats)) {
      handleAiMessageString(msg)
    }
    setTimeout(() => {
      if (!isRecentServerChat(msg, recentServerChats)) {
        sendUnparsedServerChat(bot._client.username, msg)
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
  bot.on('death', () => {
    aiCore.emit('bot.death', {
      position: bot.entity?.position && formatPosition(bot.entity.position)
    })
    aiCore.memory.rememberFailure('death', {
      position: bot.entity?.position && formatPosition(bot.entity.position)
    })
    aiCore.recordMetric('deaths')
    aiCore.recordMetric('failures')
    aiCore.reflect('death occurred; review threat, food, armor and escape strategy')
  })
  bot.once('kicked', (reason) => {
    lastKickReason = formatKickReason(reason)
    const botName = bot._client?.username || options.username
    connectedBots.delete(botName)
    aiCore.emit('bot.kicked', { reason: lastKickReason })
    aiCore.reflect('kicked from server', { reason: lastKickReason })
    sendEvent(botName, 'kicked', appendVersionHint(lastKickReason))
  })
  bot.on('error', (error) => {
    const botName = bot._client?.username || options.username
    const message = appendVersionHint(stringifyConnectionError(error))
    aiCore.emit('bot.error', { message })
    sendEvent(botName, 'error', message)
  })
  bot.once('end', (reason) => {
    const botName = bot._client?.username || options.username
    connectedBots.delete(botName)
    botApi.removeListener('botEvent', handleBotEvent)
    clearInterval(playerGotoTimer)

    const finalReason = appendVersionHint(lastKickReason || stringifyDisconnectReason(reason))
    aiCore.emit('bot.end', { reason: finalReason })
    sendEvent(botName, 'end', finalReason)
    scheduleReconnect(options, finalReason)
  })

  bot.on('physicTick', () => {
    const isSelected = playerList.includes(bot._client.username)
    const aiMode = configBoolean('aiMode')
    if (aiMode && !aiRuntimeEnabled) {
      setAiMode(true)
    }
    if (aiMode && !aiModeAnnounced) {
      aiModeAnnounced = true
      console.log('[GEMINI] Chat Control Mode Activated')
      sendEvent(
        bot._client.username,
        'chat',
        'Gemini mode: chat control online. Write commands in chat; Gemini will decide bot actions.'
      )
    } else if (!aiMode) {
      if (aiModeAnnounced) stopPathfinderTask('AI mode: off')
      aiModeAnnounced = false
    }
    if (aiMode) {
      handleAiBodyDuringMovement()
    }
    if (!aiMode && configBoolean('killauraToggle') && isSelected) {
      killaura()
    }
    if (
      !aiMode &&
      (configBoolean('nukerToggle') || nukerActive) &&
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
      console.log('[MOBILITY] Pathfinder loaded', {
        pathfinderExists: Boolean(bot.pathfinder),
        movementsConfigured: true
      })
    } catch (error) {
      sendEvent(bot._client.username, 'chat', `Pathfinder setup error: ${error.message}`)
    }
  }

  function killaura() {
    if (hitTimer <= 0) {
      hit(
        configBoolean('targetPlayer'),
        configBoolean('targetVehicle'),
        configBoolean('targetMob'),
        configBoolean('targetAnimal'),
        configValue('killauraRange', 3),
        configBoolean('killauraRotate'),
        configValue('killauraPriority', 'nearest'),
        configValue('killauraMaxTargets', 1),
        configBoolean('killauraOnlyVisible')
      )
      hitTimer = clampNumber(configValue('killauraDelay', 10), 1, 60, 10)
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
    return {
      up: clampNumber(configValue('nukerRangeUp', 0), 0, 6, 0),
      down: clampNumber(configValue('nukerRangeDown', 0), 0, 6, 0),
      left: clampNumber(configValue('nukerRangeLeft', 0), 0, 6, 0),
      right: clampNumber(configValue('nukerRangeRight', 0), 0, 6, 0),
      forward: clampNumber(configValue('nukerRangeForward', 0), 0, 6, 0),
      back: clampNumber(configValue('nukerRangeBack', 0), 0, 6, 0)
    }
  }

  function getFacingBasis() {
    const yaw = bot.entity.yaw || 0
    return {
      forwardX: Math.round(-Math.sin(yaw)),
      forwardZ: Math.round(Math.cos(yaw)),
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
    const blockList = parseBlockNames(configValue('nukerBlocks', ''))
    const targetMode = configValue('nukerTargetMode', 'blacklist')
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

    const blocksPerTick = clampNumber(configValue('nukerBlocksPerTick', 1), 1, 8, 1)
    const blocks = collectNukerBlocks().slice(0, blocksPerTick)
    if (blocks.length === 0) {
      nukerCooldown = 8
      return
    }

    nukerBusy = true
    try {
      for (const block of blocks) {
        if (configBoolean('nukerRotate')) {
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

  function normalizeMoveControl(control) {
    const aliases = {
      ileri: 'forward',
      forward: 'forward',
      fwd: 'forward',
      geri: 'back',
      back: 'back',
      backward: 'back',
      sol: 'left',
      left: 'left',
      sag: 'right',
      sağ: 'right',
      right: 'right',
      zipla: 'jump',
      zıpla: 'jump',
      jump: 'jump',
      kos: 'sprint',
      koş: 'sprint',
      sprint: 'sprint',
      egil: 'sneak',
      eğil: 'sneak',
      sneak: 'sneak'
    }
    return aliases[String(control || '').toLowerCase()]
  }

  function setAiControl(control, state = true) {
    return mobility.input(normalizeMoveControl(control) || control, state)
  }

  async function pulseAiControl(control, duration = 450, options = {}) {
    return mobility.pulse(normalizeMoveControl(control) || control, duration, options)
  }

  function resetAiBody() {
    mobility.reset()
  }

  function resolveLookYaw(direction) {
    const text = String(direction || '').toLowerCase()
    const aliases = {
      north: 0,
      kuzey: 0,
      south: Math.PI,
      guney: Math.PI,
      güney: Math.PI,
      east: -Math.PI / 2,
      dogu: -Math.PI / 2,
      doğu: -Math.PI / 2,
      west: Math.PI / 2,
      bati: Math.PI / 2,
      batı: Math.PI / 2,
      up: undefined,
      yukari: undefined,
      yukarı: undefined,
      down: undefined,
      asagi: undefined,
      aşağı: undefined
    }
    if (Object.prototype.hasOwnProperty.call(aliases, text)) return aliases[text]
    const number = Number(direction)
    return Number.isFinite(number) ? number : undefined
  }

  async function aiLook(direction, pitch = 0) {
    const text = String(direction || '').toLowerCase()
    if (['up', 'yukari', 'yukarı'].includes(text)) {
      await bot.look(bot.entity.yaw, -Math.PI / 2, true)
      return true
    }
    if (['down', 'asagi', 'aşağı'].includes(text)) {
      await bot.look(bot.entity.yaw, Math.PI / 2, true)
      return true
    }

    const yaw = resolveLookYaw(direction)
    if (yaw === undefined) return false
    await bot.look(yaw, Number.isFinite(Number(pitch)) ? Number(pitch) : 0, true)
    return true
  }

  async function aiLookAtTarget(targetName) {
    const targetText = normalizeCommandText(targetName)
    if (!targetText || ['unknown', 'nearest', 'nearby', 'around', 'cevre', 'çevre'].includes(targetText)) {
      return aiLookAtNearestVisible()
    }

    const player = findPlayerEntity(targetName)
    if (player?.position) {
      await bot.lookAt(player.position.offset(0, player.height || 1.6, 0), true)
      return true
    }

    const entity = Object.values(bot.entities).find((candidate) => {
      return (
        candidate?.position &&
        normalizeCommandText(candidate.username || candidate.name || candidate.type) === targetText
      )
    })
    if (entity?.position) {
      await bot.lookAt(entity.position.offset(0, entity.height || 1, 0), true)
      return true
    }
    return false
  }

  async function aiLookAtEntity(entity) {
    if (!entity?.position) return false
    await bot.lookAt(entity.position.offset(0, entity.height || 1, 0), true)
    return true
  }

  async function aiLookAtNearestPlayer() {
    return aiLookAtEntity(findNearestPlayerEntity())
  }

  async function aiLookAtNearestVisible() {
    const entity = Object.values(bot.entities || {})
      .filter((candidate) => candidate?.position && candidate !== bot.entity)
      .sort(
        (a, b) =>
          bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
      )[0]
    if (entity?.position) {
      await bot.lookAt(entity.position.offset(0, entity.height || 1, 0), true)
      return true
    }

    const block =
      buildLocal3DModel(8, 4)?.blocks?.find((entry) => entry.category !== 'block') ||
      buildLocal3DModel(5, 3)?.blocks?.[0]
    if (block?.pos) {
      await bot.lookAt(new Vec3(block.pos.x + 0.5, block.pos.y + 0.5, block.pos.z + 0.5), true)
      return true
    }
    return false
  }

  function handleAiBodyDuringMovement() {
    if (!configBoolean('aiMode') || !bot.entity) return

    const now = Date.now()
    const moving = Boolean(bot.pathfinder?.isMoving?.())
    const movementAnalysis = mobility.analyzeEnvironment()
    bot.setControlState(
      'sprint',
      moving && bot.food !== undefined && bot.food > 6 && !movementAnalysis.hazard
    )

    if (now - aiMemory.lastPositionCheckAt < 1000) return
    aiMemory.lastPositionCheckAt = now

    if (!moving) {
      aiMemory.stuckTicks = 0
      aiMemory.lastKnownPosition = bot.entity.position.clone()
      return
    }

    if (
      aiMemory.lastKnownPosition &&
      bot.entity.position.distanceTo(aiMemory.lastKnownPosition) < 0.25
    ) {
      aiMemory.stuckTicks++
    } else {
      aiMemory.stuckTicks = 0
    }
    aiMemory.lastKnownPosition = bot.entity.position.clone()

    if (aiMemory.stuckTicks >= 2 && now - aiMemory.lastBodyActionAt > 1200) {
      aiMemory.lastBodyActionAt = now
      mobility.recoverFromStuck(movementAnalysis).catch(() => {})
    }
  }

  function findPlayerEntity(name) {
    const playerName = String(name || '').trim()
    if (bot.players[playerName]?.entity) return bot.players[playerName].entity
    const normalized = normalizeCommandText(playerName)
    const playerEntity = Object.values(bot.players || {})
      .map((player) => player?.entity)
      .find((entity) => entity?.position && normalizeCommandText(entity.username) === normalized)
    if (playerEntity) return playerEntity
    return Object.values(bot.entities || {}).find((entity) => {
      return (
        entity?.position &&
        normalizeCommandText(entity.username || entity.name) === normalized
      )
    })
  }

  function findNearestPlayerEntity() {
    return Object.values(bot.players)
      .map((player) => player?.entity)
      .filter((entity) => entity?.username && entity.username !== bot.username && entity.position)
      .sort(
        (a, b) =>
          bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
      )[0]
  }

  function resolvePlayerName(name) {
    const text = String(name || '').trim()
    if (text && bot.players[text]?.entity) return text
    const selected = playerList.find(
      (player) => player !== bot.username && player !== bot._client?.username && bot.players[player]?.entity
    )
    if (selected) return selected
    return findNearestPlayerEntity()?.username
  }

  function resolveSpeakerTarget(value, username) {
    const text = normalizeCommandText(value)
    if (!text || ['speaker', 'user', 'player', 'me', 'ben', 'bana', 'owner'].includes(text)) {
      return username
    }
    if (text === normalizeCommandText(bot.username) || text === normalizeCommandText(bot._client?.username)) {
      return username
    }
    return value
  }

  function normalizeBlockName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/^minecraft:/, '')
      .replace(/[-\s]+/g, '_')
  }

  function getOreBlockNames() {
    return [
      'coal_ore',
      'deepslate_coal_ore',
      'copper_ore',
      'deepslate_copper_ore',
      'iron_ore',
      'deepslate_iron_ore',
      'gold_ore',
      'deepslate_gold_ore',
      'redstone_ore',
      'deepslate_redstone_ore',
      'lapis_ore',
      'deepslate_lapis_ore',
      'diamond_ore',
      'deepslate_diamond_ore',
      'emerald_ore',
      'deepslate_emerald_ore',
      'nether_gold_ore',
      'nether_quartz_ore',
      'ancient_debris'
    ]
  }

  function getValuableBlockNames() {
    return ['diamond', 'ancient', 'emerald', 'gold', 'iron', 'redstone', 'lapis', 'coal']
  }

  function resolveBlockNames(target) {
    const normalizedName = normalizeBlockName(target)
    const aliases = {
      ore: getOreBlockNames(),
      ores: getOreBlockNames(),
      maden: getOreBlockNames(),
      diamond: ['diamond_ore', 'deepslate_diamond_ore'],
      elmas: ['diamond_ore', 'deepslate_diamond_ore'],
      coal: ['coal_ore', 'deepslate_coal_ore'],
      komur: ['coal_ore', 'deepslate_coal_ore'],
      copper: ['copper_ore', 'deepslate_copper_ore'],
      bakir: ['copper_ore', 'deepslate_copper_ore'],
      iron: ['iron_ore', 'deepslate_iron_ore'],
      demir: ['iron_ore', 'deepslate_iron_ore'],
      gold: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
      altin: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
      redstone: ['redstone_ore', 'deepslate_redstone_ore'],
      lapis: ['lapis_ore', 'deepslate_lapis_ore'],
      emerald: ['emerald_ore', 'deepslate_emerald_ore'],
      zumrut: ['emerald_ore', 'deepslate_emerald_ore'],
      quartz: ['nether_quartz_ore'],
      kuvars: ['nether_quartz_ore'],
      ancient: ['ancient_debris'],
      netherite: ['ancient_debris'],
      obsidian: ['obsidian'],
      stone: ['stone'],
      tas: ['stone'],
      cobble: ['cobblestone'],
      cobblestone: ['cobblestone'],
      log: [
        'oak_log',
        'spruce_log',
        'birch_log',
        'jungle_log',
        'acacia_log',
        'dark_oak_log',
        'mangrove_log',
        'cherry_log'
      ],
      tree: [
        'oak_log',
        'spruce_log',
        'birch_log',
        'jungle_log',
        'acacia_log',
        'dark_oak_log',
        'mangrove_log',
        'cherry_log'
      ],
      wood: [
        'oak_log',
        'spruce_log',
        'birch_log',
        'jungle_log',
        'acacia_log',
        'dark_oak_log',
        'mangrove_log',
        'cherry_log'
      ],
      odun: [
        'oak_log',
        'spruce_log',
        'birch_log',
        'jungle_log',
        'acacia_log',
        'dark_oak_log',
        'mangrove_log',
        'cherry_log'
      ],
      agac: [
        'oak_log',
        'spruce_log',
        'birch_log',
        'jungle_log',
        'acacia_log',
        'dark_oak_log',
        'mangrove_log',
        'cherry_log'
      ]
    }

    return aliases[normalizedName] || [normalizedName]
  }

  function getBlockTypes(target) {
    const names = resolveBlockNames(target)
    const types = names
      .map((name) => bot.registry.blocksByName[name]?.id)
      .filter((id) => Number.isFinite(id))
    return { names, types }
  }

  function positionKey(position) {
    return `${position.x}:${position.y}:${position.z}`
  }

  function findNearestBlocks(blockName, maxDistance = 64, count = 1, ignoredKeys = new Set()) {
    const { names, types } = getBlockTypes(blockName)
    if (types.length === 0) return { error: `Pathfinder: unknown block ${blockName || ''}` }
    const typeSet = new Set(types)

    const positions = bot.findBlocks({
      point: bot.entity.position,
      matching: (block) => typeSet.has(block.type),
      maxDistance: clampNumber(maxDistance, 4, 128, 64),
      count: clampNumber(count * 6, 1, 96, 12)
    })

    const blocks = positions
      .map((position) => bot.blockAt(position))
      .filter(
        (block) => block && block.name !== 'air' && !ignoredKeys.has(positionKey(block.position))
      )
      .sort(
        (a, b) =>
          bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
      )
      .slice(0, clampNumber(count, 1, 8, 1))

    return { names, blocks }
  }

  function categorizeBlockForGemini(name) {
    if (/_log$|_stem$|_wood$|hyphae$/.test(name)) return 'tree_trunk'
    if (/_leaves$|wart_block$/.test(name)) return 'tree_leaves'
    if (/_ore$|ancient_debris/.test(name)) return 'ore'
    if (/stone|deepslate|tuff|andesite|granite|diorite|cobblestone/.test(name)) return 'stone'
    if (/grass_block|dirt|podzol|mycelium|mud|sand|gravel|clay/.test(name)) return 'ground'
    if (/water|lava/.test(name)) return 'fluid'
    if (/crafting_table|furnace|chest|barrel|bed$/.test(name)) return 'utility'
    if (/crop|wheat|carrot|potato|beetroot|melon|pumpkin|cocoa/.test(name)) return 'food_or_crop'
    if (/flower|grass|fern|sapling|mushroom/.test(name)) return 'plant'
    return 'block'
  }

  function buildLocal3DModel(radius = 10, vertical = 7) {
    if (!bot.entity?.position) return undefined
    const origin = bot.entity.position.floored()
    const blocks = []
    const categoryCounts = {}
    const nearestByCategory = {}

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dy = -vertical; dy <= vertical; dy++) {
          const position = origin.offset(dx, dy, dz)
          const block = bot.blockAt(position)
          if (
            !block ||
            block.name === 'air' ||
            block.name === 'cave_air' ||
            block.name === 'void_air'
          )
            continue

          const category = categorizeBlockForGemini(block.name)
          const distance = Number(bot.entity.position.distanceTo(block.position).toFixed(1))
          categoryCounts[category] = (categoryCounts[category] || 0) + 1

          const entry = {
            name: block.name,
            category,
            rel: { x: dx, y: dy, z: dz },
            pos: { x: block.position.x, y: block.position.y, z: block.position.z },
            distance
          }

          if (!nearestByCategory[category] || distance < nearestByCategory[category].distance) {
            nearestByCategory[category] = entry
          }

          const important =
            category !== 'block' ||
            distance <= 4 ||
            /planks|glass|door|torch|ladder|rail/.test(block.name)
          if (important) blocks.push(entry)
        }
      }
    }

    blocks.sort((a, b) => a.distance - b.distance)
    const treeBlocks = blocks.filter(
      (block) => block.category === 'tree_trunk' || block.category === 'tree_leaves'
    )
    const ores = blocks.filter((block) => block.category === 'ore')

    return {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      radius,
      vertical,
      note: 'Compact 3D model of loaded blocks around the bot. Use categories and coordinates to interpret natural objects like trees instead of literal name matching.',
      categoryCounts,
      nearestByCategory,
      likelyTrees: treeBlocks.slice(0, 24),
      visibleOres: ores.slice(0, 20),
      blocks: blocks.slice(0, 220)
    }
  }

  function describePlayerPosition(playerName) {
    const entity = findPlayerEntity(playerName)
    if (!entity?.position) {
      sendEvent(bot._client.username, 'chat', `Pathfinder: player not visible ${playerName || ''}`)
      return
    }

    sendEvent(
      bot._client.username,
      'chat',
      `Pathfinder: ${playerName} @ ${formatPosition(entity.position)}`
    )
  }

  function goToNearestBlock(blockName, maxDistance) {
    const result = findNearestBlocks(blockName, maxDistance, 1)
    if (result.error) {
      sendEvent(bot._client.username, 'chat', result.error)
      return
    }
    if (result.blocks.length === 0) {
      sendEvent(
        bot._client.username,
        'chat',
        `Pathfinder: no loaded ${normalizeBlockName(blockName)} nearby`
      )
      return
    }

    const block = result.blocks[0]
    mobility.reach(block.position, { near: 1, timeoutMs: 28000 }).catch((error) => {
      sendEvent(bot._client.username, 'chat', `Mobility find error: ${error.message}`)
    })
    sendEvent(
      bot._client.username,
      'chat',
      `Mobility: nearest ${block.name} @ ${formatPosition(block.position)}`
    )
  }

  function stopPathfinderTask(message = 'Pathfinder: stopped') {
    clearInterval(playerGotoTimer)
    playerGotoTimer = undefined
    pathfinderBusy = false
    bot.pathfinder?.stop()
    resetAiBody()
    sendEvent(bot._client.username, 'chat', message)
  }

  function goToMovingPlayer(playerName, distance = 2) {
    if (!ensurePathfinder()) return
    const resolvedName = resolvePlayerName(playerName)
    const entity = findPlayerEntity(resolvedName)
    if (!entity) {
      sendEvent(bot._client.username, 'chat', `Pathfinder: player not found ${playerName || ''}`)
      return
    }

    clearInterval(playerGotoTimer)
    let lastPosition = entity.position.clone()
    let stillSince = Date.now()
    const nearDistance = clampNumber(distance, 1, 6, 2)

    bot.pathfinder.setGoal(
      new goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, nearDistance),
      true
    )
    sendEvent(bot._client.username, 'chat', `Pathfinder: going to ${resolvedName}`)

    playerGotoTimer = setInterval(() => {
      const target = findPlayerEntity(resolvedName)
      if (!target?.position) {
        stopPathfinderTask(`Pathfinder: player lost ${resolvedName}`)
        return
      }

      const moved = target.position.distanceTo(lastPosition) > 0.35
      if (moved) {
        lastPosition = target.position.clone()
        stillSince = Date.now()
        bot.pathfinder.setGoal(
          new goals.GoalNear(target.position.x, target.position.y, target.position.z, nearDistance),
          true
        )
        return
      }

      const distanceToTarget = bot.entity.position.distanceTo(target.position)
      if (distanceToTarget <= nearDistance + 0.75 && Date.now() - stillSince > 1200) {
        stopPathfinderTask(`Pathfinder: reached ${resolvedName}`)
      }
    }, 500)
  }

  async function comeToPlayerIntent(playerName, distance = 2, options = {}) {
    if (!ensurePathfinder()) return { ok: false, reason: 'pathfinder_not_ready' }
    const resolvedName = resolvePlayerName(playerName)
    const nearDistance = clampNumber(distance, 1, 8, 2)
    const timeoutMs = clampNumber(options.timeoutMs, 3000, 120000, 45000)
    const startedAt = Date.now()
    let lastTargetPosition
    let lastGoalAt = 0

    clearInterval(playerGotoTimer)
    pathfinderBusy = true
    aiMemory.currentTask = `come_to_player:${resolvedName}`
    sendEvent(bot._client.username, 'chat', `Skill: coming to ${resolvedName}`)

    try {
      while (Date.now() - startedAt < timeoutMs) {
        const entity = findPlayerEntity(resolvedName)
        if (!entity?.position) {
          return { ok: false, reason: `player_not_visible:${resolvedName}`, player: resolvedName }
        }

        const distanceToPlayer = bot.entity.position.distanceTo(entity.position)
        if (distanceToPlayer <= nearDistance + 0.8) {
          stopPathfinderTask(`Skill: reached ${resolvedName}`)
          return { ok: true, player: resolvedName, distance: distanceToPlayer }
        }

        const targetMoved =
          !lastTargetPosition || entity.position.distanceTo(lastTargetPosition) > 1.2
        if (targetMoved || Date.now() - lastGoalAt > 2500) {
          lastTargetPosition = entity.position.clone()
          lastGoalAt = Date.now()
          bot.pathfinder.setGoal(
            new goals.GoalFollow(entity, nearDistance),
            true
          )
        }

        await delay(350)
      }
      return { ok: false, reason: 'come_to_player_timeout', player: resolvedName }
    } finally {
      pathfinderBusy = false
      aiMemory.currentTask = 'idle'
    }
  }

  async function protectPlayerIntent(playerName) {
    const resolvedName = resolvePlayerName(playerName)
    const player = findPlayerEntity(resolvedName)
    if (!player?.position) return { ok: false, reason: `player_not_visible:${resolvedName}` }

    const threat = Object.values(bot.entities || {})
      .filter((entity) => entity?.position && entity !== bot.entity)
      .filter((entity) => {
        const hostile = ['zombie', 'skeleton', 'creeper', 'spider', 'drowned', 'husk', 'witch']
        return hostile.includes(entity.name) && entity.position.distanceTo(player.position) < 10
      })
      .sort((a, b) => a.position.distanceTo(player.position) - b.position.distanceTo(player.position))[0]

    if (threat) return huntEntity(threat.name)
    return comeToPlayerIntent(resolvedName, 3, { timeoutMs: 20000 })
  }

  async function equipBestToolForBlock(block) {
    if (!block) return
    const blockName = block.name || ''
    const toolHints = []
    if (/ore|stone|deepslate|cobblestone|ancient_debris/.test(blockName)) toolHints.push('pickaxe')
    if (/log|wood|stem|hyphae/.test(blockName)) toolHints.push('axe')
    if (/dirt|sand|gravel|clay/.test(blockName)) toolHints.push('shovel')
    if (toolHints.length === 0) return

    const tool = bot.inventory
      .items()
      .find((item) => toolHints.some((hint) => item.name.includes(hint)))
    if (!tool) return
    await bot.equip(tool, 'hand').catch(() => {})
  }

  function resolveCountAndRange(firstNumber, secondNumber) {
    const first = Number(firstNumber)
    const second = Number(secondNumber)
    const count = Number.isFinite(first) ? clampNumber(first, 1, 64, 1) : 1
    const range = Number.isFinite(second) ? clampNumber(second, 4, 128, 64) : 64
    return { count, range }
  }

  async function moveToDiggableBlock(block) {
    const position = block.position.clone()
    const reached = await mobility.reach(position, { near: 2, timeoutMs: 18000 })
    if (reached?.ok) return bot.blockAt(position)

    const goalsToTry = [
      new goals.GoalNear(position.x, position.y, position.z, 2),
      new goals.GoalGetToBlock(position.x, position.y, position.z)
    ]

    for (const goal of goalsToTry) {
      try {
        bot.pathfinder.setGoal(null)
        await bot.pathfinder.goto(goal)
        break
      } catch {
        bot.pathfinder.setGoal(null)
      }
    }

    return bot.blockAt(position)
  }

  async function digBlockAutonomously(block) {
    const position = block.position.clone()
    let target = await moveToDiggableBlock(block)
    if (!target || target.name === 'air') {
      return { mined: false, reason: 'block changed' }
    }

    await equipBestToolForBlock(target)

    if (typeof bot.canDigBlock === 'function' && !bot.canDigBlock(target)) {
      await bot.pathfinder
        .goto(new goals.GoalNear(position.x, position.y, position.z, 2))
        .catch(() => {})
      target = bot.blockAt(position)
      if (!target || target.name === 'air') return { mined: false, reason: 'block changed' }
      if (typeof bot.canDigBlock === 'function' && !bot.canDigBlock(target)) {
        return { mined: false, reason: 'not reachable' }
      }
    }

    bot.pathfinder?.setGoal?.(null)
    bot.pathfinder?.stop?.()
    resetAiBody()
    await delay(180)

    for (let attempt = 1; attempt <= 2; attempt++) {
      target = bot.blockAt(position)
      if (!target || target.name === 'air') return { mined: false, reason: 'block changed' }
      if (typeof bot.canDigBlock === 'function' && !bot.canDigBlock(target)) {
        return { mined: false, reason: 'not reachable before dig' }
      }
      try {
        await bot.lookAt(target.position.offset(0.5, 0.5, 0.5), true)
        await bot.dig(target, true)
        break
      } catch (error) {
        bot.stopDigging?.()
        resetAiBody()
        if (attempt >= 2) return { mined: false, reason: error.message }
        await delay(350)
      }
    }
    aiCore.emit('block.broken', {
      block: target.name,
      position: formatPosition(target.position)
    })
    aiCore.rememberDiscovery('resource', target.name, {
      position: formatPosition(target.position)
    })
    aiCore.recordMetric('minedBlocks')
    return { mined: true, block: target }
  }

  function isReplaceableBlock(block) {
    return !block || block.name === 'air' || block.boundingBox === 'empty'
  }

  function getBuildBlockItem(preferredName) {
    const preferred = normalizeBlockName(preferredName)
    const items = bot.inventory.items()
    if (preferred) {
      const item = items.find((candidate) => {
        return candidate.name === preferred || candidate.name.includes(preferred)
      })
      if (item) return item
    }

    return items.find((item) => {
      if (!bot.registry.blocksByName[item.name]) return false
      return !/sand|gravel|tnt|bedrock|barrier|chest|furnace|crafting_table/.test(item.name)
    })
  }

  function getPlacePosition(args) {
    const firstArg = String(args[0] || '').toLowerCase()
    if (['under', 'alt', 'below'].includes(firstArg)) {
      return bot.entity.position.offset(0, -1, 0).floored()
    }
    if (['front', 'on', 'ileri', 'ön', 'Ã¶n'].includes(firstArg)) {
      const yaw = bot.entity.yaw || 0
      return bot.entity.position.offset(-Math.sin(yaw), 0, Math.cos(yaw)).floored()
    }
    if (['back', 'geri'].includes(firstArg)) {
      const yaw = bot.entity.yaw || 0
      return bot.entity.position.offset(Math.sin(yaw), 0, -Math.cos(yaw)).floored()
    }

    return parsePositionArgs(
      args,
      bot.entity.position,
      Math.floor(bot.entity.position.y)
    )?.floored()
  }

  function findPlacementReference(targetPosition) {
    const targetBlock = bot.blockAt(targetPosition)
    if (!isReplaceableBlock(targetBlock)) return

    const faces = [
      new Vec3(0, -1, 0),
      new Vec3(0, 1, 0),
      new Vec3(1, 0, 0),
      new Vec3(-1, 0, 0),
      new Vec3(0, 0, 1),
      new Vec3(0, 0, -1)
    ]

    for (const face of faces) {
      const referencePosition = targetPosition.minus(face)
      const reference = bot.blockAt(referencePosition)
      if (reference && reference.name !== 'air' && reference.boundingBox !== 'empty') {
        return { reference, face }
      }
    }
  }

  function findNearbyPlaceTarget(origin = bot.entity.position.floored(), radius = 5) {
    for (let y = -1; y <= 2; y++) {
      for (let r = 1; r <= radius; r++) {
        for (let x = -r; x <= r; x++) {
          for (let z = -r; z <= r; z++) {
            if (Math.abs(x) !== r && Math.abs(z) !== r) continue
            const position = origin.offset(x, y, z)
            const placement = findPlacementReference(position)
            if (placement) return { position, placement }
          }
        }
      }
    }
  }

  async function placeBlockAutonomously(itemName, args = ['front']) {
    const item = getBuildBlockItem(itemName)
    if (!item) {
      sendEvent(bot._client.username, 'chat', `AI place: no block item found`)
      return false
    }

    const targetPosition = getPlacePosition(args)
    if (!targetPosition) {
      sendEvent(bot._client.username, 'chat', 'AI place needs: place [block] front|under|x y z')
      return false
    }

    let finalPosition = targetPosition
    let placement = findPlacementReference(targetPosition)
    if (!placement) {
      const nearby = findNearbyPlaceTarget(targetPosition, 6) || findNearbyPlaceTarget()
      if (!nearby) {
        sendEvent(
          bot._client.username,
          'chat',
          `AI place: no support near ${formatPosition(targetPosition)}`
        )
        return false
      }
      finalPosition = nearby.position
      placement = nearby.placement
    }

    let beforeCount = 0
    try {
      await mobility.reach(placement.reference.position, { near: 4, timeoutMs: 15000 })
      beforeCount = inventoryCountByNames([item.name])
      await bot.equip(item, 'hand')
      await bot.lookAt(placement.reference.position.offset(0.5, 0.5, 0.5), true)
      await bot.placeBlock(placement.reference, placement.face)
      aiCore.recordMetric('placedBlocks')
      sendEvent(
        bot._client.username,
        'chat',
        `AI place: ${item.name} @ ${formatPosition(finalPosition)}`
      )
      return true
    } catch (error) {
      if (/blockUpdate.*timeout|did not fire within timeout/i.test(error.message)) {
        await delay(250)
        const placedBlock = bot.blockAt(finalPosition)
        const afterCount = inventoryCountByNames([item.name])
        if (!isReplaceableBlock(placedBlock) || afterCount < beforeCount) {
          sendEvent(
            bot._client.username,
            'chat',
            `AI place: ${item.name} @ ${formatPosition(finalPosition)} confirmed after timeout`
          )
          aiCore.emit('block.placed_timeout_confirmed', {
            item: item.name,
            position: formatPosition(finalPosition)
          })
          aiCore.recordMetric('placedBlocks')
          return true
        }
      }
      sendEvent(bot._client.username, 'chat', `AI place error: ${error.message}`)
      return false
    }
  }

  async function breakBlockCommand(args) {
    const position = parsePositionArgs(args, bot.entity.position, Math.floor(bot.entity.position.y))
    let block
    if (position) {
      block = bot.blockAt(position.floored())
    } else {
      const result = findNearestBlocks(args[0], args[1] || 64, 1)
      if (result.error || result.blocks.length === 0) {
        sendEvent(bot._client.username, 'chat', `AI break: block not found ${args[0] || ''}`)
        return
      }
      block = result.blocks[0]
    }

    if (!block || block.name === 'air') {
      sendEvent(bot._client.username, 'chat', 'AI break: no block there')
      return
    }

    const result = await digBlockAutonomously(block)
    sendEvent(
      bot._client.username,
      'chat',
      result.mined ? `AI break: ${result.block.name}` : `AI break failed: ${result.reason}`
    )
  }

  async function mineNearestBlocks(blockName, count = 1, maxDistance = 64, deliveryTarget) {
    if (pathfinderBusy) {
      sendEvent(bot._client.username, 'chat', 'Pathfinder: already running a task')
      return { ok: false, reason: 'pathfinder_busy' }
    }

    pathfinderBusy = true
    const wantedCount = clampNumber(count, 1, 64, 1)
    let minedCount = 0
    const skippedBlocks = new Set()
    let lastFailure = 'not_started'

    try {
      while (minedCount < wantedCount && skippedBlocks.size < wantedCount * 12 + 16) {
        if (String(aiMemory.currentTask || '').startsWith('gemini') && !isAiModeActive()) {
          sendEvent(bot._client.username, 'chat', 'AI mine: stopped because AI mode is off')
          return { ok: false, reason: 'ai_mode_off', minedCount }
        }
        const result = findNearestBlocks(blockName, maxDistance, 6, skippedBlocks)
        if (result.error) {
          sendEvent(bot._client.username, 'chat', result.error)
          return { ok: false, reason: result.error, minedCount }
        }
        if (result.blocks.length === 0) {
          sendEvent(
            bot._client.username,
            'chat',
            `Pathfinder: no loaded ${normalizeBlockName(blockName)} nearby`
          )
          return {
            ok: false,
            reason: `no_loaded_${normalizeBlockName(blockName)}_nearby`,
            minedCount
          }
        }

        let minedThisRound = false
        for (const block of result.blocks) {
          skippedBlocks.add(positionKey(block.position))
          const digResult = await digBlockAutonomously(block)
          if (!digResult.mined) {
            lastFailure = digResult.reason || 'dig_failed'
            console.log('[MINEFLAYER] Mine attempt failed', {
              block: block.name,
              position: formatPosition(block.position),
              reason: lastFailure
            })
            continue
          }

          minedCount++
          minedThisRound = true
          await delay(250)
          sendEvent(
            bot._client.username,
            'chat',
            `Pathfinder: mined ${minedCount}/${wantedCount} ${digResult.block.name}`
          )
          break
        }

        if (!minedThisRound) {
          console.log('[EXECUTOR] Mining round failed', {
            target: blockName,
            skipped: skippedBlocks.size,
            lastFailure
          })
          await delay(250)
        }
      }

      if (deliveryTarget) {
        await tossInventoryToPlayer(deliveryTarget, blockName)
      }

      if (minedCount === 0) {
        sendEvent(
          bot._client.username,
          'chat',
          `Pathfinder: no reachable ${normalizeBlockName(blockName)} found`
        )
        return { ok: false, reason: lastFailure || 'no_reachable_block', minedCount }
      }
      return {
        ok: true,
        minedCount,
        wantedCount,
        target: normalizeBlockName(blockName)
      }
    } catch (error) {
      sendEvent(bot._client.username, 'chat', `Pathfinder mine error: ${error.message}`)
      return { ok: false, reason: error.message, minedCount }
    } finally {
      pathfinderBusy = false
    }
  }

  async function mineBlockAtPosition(x, y, z) {
    const position = new Vec3(Number(x), Number(y), Number(z))
    if (![position.x, position.y, position.z].every(Number.isFinite)) {
      return { ok: false, reason: 'invalid_block_position' }
    }
    const block = bot.blockAt(position)
    if (
      !block ||
      block.name === 'air' ||
      block.name === 'cave_air' ||
      block.name === 'void_air'
    ) {
      return { ok: false, reason: 'target_block_not_loaded' }
    }
    const result = await digBlockAutonomously(block)
    return {
      ok: Boolean(result?.mined),
      reason: result?.reason,
      block: result?.block?.name || block.name,
      position: formatPosition(block.position)
    }
  }

  function isGiveAllTarget(target) {
    const normalizedTarget = normalizeBlockName(target)
    return [
      'all',
      'everything',
      'hepsi',
      'hepsini',
      'tum',
      'tumu',
      'tüm',
      'tümü',
      'hersey',
      'herseyi',
      'herşey',
      'herşeyi'
    ].includes(normalizedTarget)
  }

  function addItemAliases(names, normalizedTarget) {
    const swordNames = [
      'wooden_sword',
      'stone_sword',
      'iron_sword',
      'golden_sword',
      'diamond_sword',
      'netherite_sword'
    ]
    const dirtNames = ['dirt', 'coarse_dirt', 'rooted_dirt', 'grass_block']
    const aliases = {
      sword: swordNames,
      kilic: swordNames,
      kilici: swordNames,
      kılıç: swordNames,
      kılıcı: swordNames,
      dirt: dirtNames,
      ground: dirtNames,
      soil: dirtNames,
      toprak: dirtNames,
      topragi: dirtNames,
      toprağı: dirtNames,
      craftingtable: ['crafting_table'],
      crafttable: ['crafting_table'],
      masa: ['crafting_table'],
      kazma: ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'golden_pickaxe', 'diamond_pickaxe', 'netherite_pickaxe'],
      pickaxe: ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'golden_pickaxe', 'diamond_pickaxe', 'netherite_pickaxe']
    }
    ;(aliases[normalizedTarget] || []).forEach((name) => names.add(name))
  }

  function normalizeSearchKey(value) {
    return normalizeBlockName(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  function searchTokens(value) {
    return normalizeSearchKey(value).split('_').filter(Boolean)
  }

  function trimTurkishItemSuffixes(value) {
    const key = normalizeSearchKey(value)
    const suffixes = ['leri', 'lari', 'sini', 'sını', 'ini', 'ını', 'unu', 'ünü', 'yi', 'yı', 'yu', 'yü', 'i', 'ı', 'u', 'ü']
    for (const suffix of suffixes) {
      if (key.length > suffix.length + 2 && key.endsWith(normalizeSearchKey(suffix))) {
        return key.slice(0, -normalizeSearchKey(suffix).length)
      }
    }
    return key
  }

  function registryItemEntries() {
    const byName = bot.registry?.itemsByName || {}
    return Object.values(byName)
  }

  function registryBlockEntries() {
    const byName = bot.registry?.blocksByName || {}
    return Object.values(byName)
  }

  function registryEntryMatchesQuery(entry, query) {
    if (!entry) return false
    const queryKeys = Array.from(new Set([normalizeSearchKey(query), trimTurkishItemSuffixes(query)]))
      .filter(Boolean)
    const queryTokenSets = queryKeys.map((key) => key.split('_').filter(Boolean))
    const candidateKeys = [
      entry.name,
      entry.displayName,
      entry.translationKey,
      entry.type
    ]
      .map(normalizeSearchKey)
      .filter(Boolean)

    return candidateKeys.some((candidateKey) => {
      const candidateTokens = candidateKey.split('_').filter(Boolean)
      return queryKeys.some((queryKey, index) => {
        if (candidateKey === queryKey) return true
        const queryTokens = queryTokenSets[index] || []
        if (queryTokens.length === 1) return candidateTokens.includes(queryTokens[0])
        return queryTokens.every((token) => candidateTokens.includes(token))
      })
    })
  }

  function addRegistryItemAliases(names, normalizedTarget) {
    for (const item of registryItemEntries()) {
      if (registryEntryMatchesQuery(item, normalizedTarget)) names.add(item.name)
    }
    for (const block of registryBlockEntries()) {
      if (registryEntryMatchesQuery(block, normalizedTarget)) names.add(block.name)
    }
  }

  function itemNameMatchesAny(itemName, names) {
    const itemKey = normalizeSearchKey(itemName)
    const itemTokens = searchTokens(itemName)
    return Array.from(names).some((name) => {
      const targetKey = normalizeSearchKey(name)
      if (!targetKey) return false
      if (itemKey === targetKey) return true
      const targetTokens = targetKey.split('_').filter(Boolean)
      if (targetTokens.length === 1) return itemTokens.includes(targetTokens[0])
      return targetTokens.every((token) => itemTokens.includes(token))
    })
  }

  function itemTargetPriority(itemName, target) {
    const itemKey = normalizeSearchKey(itemName)
    const targetKey = normalizeSearchKey(target)
    const trimmedTargetKey = trimTurkishItemSuffixes(target)
    if (itemKey === targetKey || itemKey === trimmedTargetKey) return 0
    if (resolveBlockNames(target).map(normalizeSearchKey).includes(itemKey)) return 1
    if (registryItemEntries().some((item) => item.name === itemName && registryEntryMatchesQuery(item, target))) {
      return 2
    }
    if (itemKey.endsWith(`_${targetKey}`) || itemKey.endsWith(`_${trimmedTargetKey}`)) return 3
    return 4
  }

  function itemMatchesTarget(itemName, target) {
    const normalizedTarget = normalizeBlockName(target)
    if (!normalizedTarget) return false
    if (isGiveAllTarget(normalizedTarget)) return true
    const names = new Set(resolveBlockNames(normalizedTarget))
    names.add(normalizedTarget)
    addItemAliases(names, normalizedTarget)
    addRegistryItemAliases(names, normalizedTarget)
    if (normalizedTarget === 'wood' || normalizedTarget === 'agac') {
      ;[
        'oak_log',
        'spruce_log',
        'birch_log',
        'jungle_log',
        'acacia_log',
        'dark_oak_log',
        'mangrove_log',
        'cherry_log'
      ].forEach((name) => names.add(name))
    }
    if (normalizedTarget === 'planks' || normalizedTarget === 'plank') {
      ;[
        'oak_planks',
        'spruce_planks',
        'birch_planks',
        'jungle_planks',
        'acacia_planks',
        'dark_oak_planks',
        'mangrove_planks',
        'cherry_planks'
      ].forEach((name) => names.add(name))
    }
    if (normalizedTarget === 'stone' || normalizedTarget === 'tas') names.add('cobblestone')
    if (normalizedTarget === 'diamond' || normalizedTarget === 'elmas') names.add('diamond')
    if (normalizedTarget === 'iron' || normalizedTarget === 'demir') names.add('raw_iron')
    if (normalizedTarget === 'iron' || normalizedTarget === 'demir') names.add('iron_ingot')
    if (normalizedTarget === 'gold' || normalizedTarget === 'altin') names.add('raw_gold')
    if (normalizedTarget === 'gold' || normalizedTarget === 'altin') names.add('gold_ingot')
    if (normalizedTarget === 'copper' || normalizedTarget === 'bakir') names.add('raw_copper')
    if (normalizedTarget === 'copper' || normalizedTarget === 'bakir') names.add('copper_ingot')
    if (normalizedTarget === 'coal' || normalizedTarget === 'komur') names.add('coal')
    if (normalizedTarget === 'emerald' || normalizedTarget === 'zumrut') names.add('emerald')
    if (normalizedTarget === 'ancient' || normalizedTarget === 'netherite') {
      names.add('ancient_debris')
    }
    return itemNameMatchesAny(itemName, names)
  }

  function inventoryCount(target) {
    return bot.inventory
      .items()
      .filter((item) => itemMatchesTarget(item.name, target))
      .reduce((total, item) => total + item.count, 0)
  }

  function inventoryCountByNames(names) {
    const wanted = new Set(names)
    return bot.inventory
      .items()
      .filter((item) => wanted.has(item.name))
      .reduce((total, item) => total + item.count, 0)
  }

  function getLogItemNames() {
    return [
      'oak_log',
      'spruce_log',
      'birch_log',
      'jungle_log',
      'acacia_log',
      'dark_oak_log',
      'mangrove_log',
      'cherry_log'
    ]
  }

  function getPlankItemNames() {
    return [
      'oak_planks',
      'spruce_planks',
      'birch_planks',
      'jungle_planks',
      'acacia_planks',
      'dark_oak_planks',
      'mangrove_planks',
      'cherry_planks'
    ]
  }

  function getStickCount() {
    return inventoryCountByNames(['stick'])
  }

  function getWoodProgress() {
    const logs = inventoryCountByNames(getLogItemNames())
    const planks = inventoryCountByNames(getPlankItemNames())
    return {
      logs,
      planks,
      plankEquivalent: logs * 4 + planks
    }
  }

  function getStoneProgress() {
    return inventoryCountByNames(['stone', 'cobblestone', 'cobbled_deepslate'])
  }

  function getIronProgress() {
    return inventoryCountByNames(['iron_ore', 'deepslate_iron_ore', 'raw_iron', 'iron_ingot'])
  }

  function getGoldProgress() {
    return inventoryCountByNames([
      'gold_ore',
      'deepslate_gold_ore',
      'nether_gold_ore',
      'raw_gold',
      'gold_ingot'
    ])
  }

  function getCopperProgress() {
    return inventoryCountByNames([
      'copper_ore',
      'deepslate_copper_ore',
      'raw_copper',
      'copper_ingot'
    ])
  }

  function getDiamondProgress() {
    return inventoryCountByNames(['diamond_ore', 'deepslate_diamond_ore', 'diamond'])
  }

  function getObsidianProgress() {
    return inventoryCountByNames(['obsidian'])
  }

  function getIronIngotCount() {
    return inventoryCountByNames(['iron_ingot'])
  }

  function getRawSmeltItems() {
    return [
      'raw_iron',
      'raw_gold',
      'raw_copper',
      'iron_ore',
      'deepslate_iron_ore',
      'gold_ore',
      'deepslate_gold_ore',
      'copper_ore',
      'deepslate_copper_ore'
    ]
  }

  function getCookableFoodItems() {
    return ['beef', 'porkchop', 'chicken', 'mutton', 'rabbit', 'cod', 'salmon', 'potato', 'kelp']
  }

  function getFuelItem() {
    return getInventoryItemByNames([
      'coal',
      'charcoal',
      ...getLogItemNames(),
      ...getPlankItemNames(),
      'stick',
      'bamboo'
    ])
  }

  function hasAnyItem(names) {
    return bot.inventory.items().some((item) => names.includes(item.name))
  }

  function getInventoryItem(name) {
    return bot.inventory.items().find((item) => item.name === name)
  }

  function getInventoryItemByNames(names) {
    return bot.inventory.items().find((item) => names.includes(item.name))
  }

  function getHotbarSlots() {
    const start = bot.inventory.hotbarStart || 36
    return Array.from({ length: 9 }, (_, index) => start + index)
  }

  async function moveItemToHotbar(item, preferredSlot = 0) {
    if (!item || typeof bot.moveSlotItem !== 'function') return false
    const hotbarSlots = getHotbarSlots()
    if (hotbarSlots.includes(item.slot)) {
      bot.setQuickBarSlot(item.slot - hotbarSlots[0])
      return true
    }

    const preferred = hotbarSlots[clampNumber(preferredSlot, 0, 8, 0)]
    const empty = hotbarSlots.find((slot) => !bot.inventory.slots[slot])
    const destination = empty || preferred
    await bot.moveSlotItem(item.slot, destination)
    bot.setQuickBarSlot(destination - hotbarSlots[0])
    return true
  }

  async function selectItem(names, preferredSlot = 0) {
    const item = getInventoryItemByNames(names)
    if (!item) return false
    await moveItemToHotbar(item, preferredSlot)
    await bot.equip(item, 'hand').catch(() => {})
    return true
  }

  function getArmorRank(itemName) {
    const materialRanks = {
      leather: 1,
      golden: 2,
      chainmail: 3,
      iron: 4,
      diamond: 5,
      netherite: 6
    }
    const material = Object.keys(materialRanks).find((name) => itemName.startsWith(name))
    return materialRanks[material] || 0
  }

  async function equipBestArmor() {
    const armorSlots = [
      { suffix: 'helmet', dest: 'head' },
      { suffix: 'chestplate', dest: 'torso' },
      { suffix: 'leggings', dest: 'legs' },
      { suffix: 'boots', dest: 'feet' }
    ]

    for (const armor of armorSlots) {
      const candidates = bot.inventory
        .items()
        .filter((item) => item.name.endsWith(armor.suffix))
        .sort((a, b) => getArmorRank(b.name) - getArmorRank(a.name))
      const best = candidates[0]
      if (!best) continue

      const equippedSlot = bot.getEquipmentDestSlot?.(armor.dest)
      const equipped = equippedSlot !== undefined ? bot.inventory.slots[equippedSlot] : undefined
      if (equipped && getArmorRank(equipped.name) >= getArmorRank(best.name)) continue

      await bot.equip(best, armor.dest).catch(() => {})
      sendEvent(bot._client.username, 'chat', `AI equip: ${best.name}`)
      await delay(120)
    }
  }

  async function equipShieldOffhand() {
    const shield = getInventoryItem('shield')
    if (!shield) return false
    const offhandSlot = bot.getEquipmentDestSlot?.('off-hand') ?? 45
    if (bot.inventory.slots[offhandSlot]?.name === 'shield') return true
    await bot.equip(shield, 'off-hand').catch(() => {})
    sendEvent(bot._client.username, 'chat', 'AI equip: shield off-hand')
    return true
  }

  async function organizeHotbar() {
    await selectItem(['diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'], 0)
    await selectItem(
      [
        'diamond_sword',
        'iron_sword',
        'stone_sword',
        'wooden_sword',
        'diamond_axe',
        'iron_axe',
        'stone_axe',
        'wooden_axe'
      ],
      1
    )
    await moveItemToHotbar(getFoodItem(), 2).catch(() => {})
    await moveItemToHotbar(getInventoryItemByNames(['torch']), 3).catch(() => {})
    await moveItemToHotbar(getBuildBlockItem(), 4).catch(() => {})
  }

  async function manageInventoryAndEquipment() {
    if (Date.now() - aiMemory.lastInventoryAt < 5000) return false
    aiMemory.lastInventoryAt = Date.now()
    await equipBestArmor()
    await equipShieldOffhand()
    await organizeHotbar()
    return true
  }

  function getCraftingTableBlock(maxDistance = 5) {
    const table = bot.registry.blocksByName.crafting_table
    if (!table) return
    return bot.findBlock({
      point: bot.entity.position,
      matching: table.id,
      maxDistance
    })
  }

  async function craftItemByNames(itemNames, count = 1, options = {}) {
    if (typeof bot.recipesFor !== 'function' || typeof bot.craft !== 'function') {
      sendEvent(
        bot._client.username,
        'chat',
        'AI craft blocked: crafting plugin is not active. Restart the bot with AI mode enabled.'
      )
      return { ok: false, reason: 'crafting_plugin_inactive' }
    }

    const beforeItems = new Map(bot.inventory.items().map((item) => [item.name, item.count]))
    const beforeTargetCount =
      options.target === 'planks' ? inventoryCountByNames(getPlankItemNames()) : 0
    if (options.target === 'planks' && inventoryCountByNames(getLogItemNames()) === 0) {
      sendEvent(bot._client.username, 'chat', 'AI craft blocked: planks need logs first')
      return { ok: false, reason: 'missing_logs_for_planks' }
    }
    let lastFailure = 'no_recipe'
    for (const itemName of itemNames) {
      const item = bot.registry.itemsByName[itemName]
      if (!item) {
        lastFailure = `unknown_item_${itemName}`
        continue
      }

      let table = getCraftingTableBlock()
      let recipes = bot.recipesFor(item.id, null, 1, table)

      if (recipes.length === 0 && !table) {
        recipes = bot.recipesFor(item.id, null, 1, null)
      }
      if (recipes.length === 0 && table) {
        recipes = bot.recipesFor(item.id, null, 1, null)
      }
      if (recipes.length === 0 && !table && itemName !== 'crafting_table') {
        table = await ensureCraftingTable()
        if (table) {
          recipes = bot.recipesFor(item.id, null, 1, table)
        }
      }
      if (recipes.length === 0) {
        lastFailure = `no_recipe_${itemName}`
        console.log('[EXECUTOR] Craft recipe missing', {
          itemName,
          hasTable: Boolean(table),
          inventory: getInventorySnapshot()
        })
        continue
      }

      const recipe = recipes[0]
      if (recipe.requiresTable) {
        table = await ensureCraftingTable()
        if (!table) continue
      }

      const resultCount = Math.max(recipe.result?.count || 1, 1)
      const craftTimes = Math.max(Math.ceil(count / resultCount), 1)
      try {
        await bot.craft(recipe, craftTimes, recipe.requiresTable ? table : null)
      } catch (error) {
        lastFailure = error.message
        sendEvent(bot._client.username, 'chat', `AI craft blocked: ${itemName} ${error.message}`)
        continue
      }
      const afterCount = inventoryCountByNames([itemName])
      const beforeCount = beforeItems.get(itemName) || 0
      const gained =
        options.target === 'planks'
          ? inventoryCountByNames(getPlankItemNames()) - beforeTargetCount
          : afterCount - beforeCount
      if (gained <= 0) {
        lastFailure = `craft_no_output_${itemName}`
        continue
      }
      sendEvent(
        bot._client.username,
        'chat',
        `AI craft: ${itemName} +${Math.max(gained, resultCount)}`
      )
      aiCore.emit('item.crafted', {
        item: itemName,
        count: Math.max(gained, resultCount)
      })
      aiCore.memory.rememberSuccess('craft', { item: itemName })
      aiCore.recordMetric('craftedItems')
      return { ok: true, item: itemName, count: Math.max(gained, resultCount) }
    }

    return { ok: false, reason: lastFailure }
  }

  async function ensureCraftingTable() {
    let table = getCraftingTableBlock()
    if (table) return table

    if (!getInventoryItem('crafting_table')) {
      await craftItemByNames(['crafting_table'], 1)
    }

    const tableItem = getInventoryItem('crafting_table')
    if (!tableItem) return

    await placeBlockAutonomously('crafting_table', ['front'])
    table = getCraftingTableBlock(5)
    if (table) return table

    await bot.equip(tableItem, 'hand')
    const reference = bot.blockAt(bot.entity.position.offset(0, -1, 0))
    const faces = [new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1)]

    for (const face of faces) {
      try {
        await bot.placeBlock(reference, face)
        await delay(250)
        table = getCraftingTableBlock(3)
        if (table) return table
      } catch {
        // Try another side of the block below the bot.
      }
    }
  }

  async function makeCraftingTableForPlayer(playerName, wantedLogs = 3) {
    const targetLogs = clampNumber(wantedLogs, 1, 16, 3)
    const logNames = getLogItemNames()
    const plankNames = getPlankItemNames()
    const missingLogs = Math.max(targetLogs - inventoryCountByNames(logNames), 0)

    if (missingLogs > 0) {
      const mined = await mineNearestBlocks('wood', missingLogs, 96)
      if (!mined?.ok) return mined
    }

    if (inventoryCountByNames(plankNames) < 4) {
      const craftedPlanks = await craftItemByNames(plankNames, 4, { target: 'planks' })
      if (!craftedPlanks?.ok && inventoryCountByNames(plankNames) < 4) return craftedPlanks
    }

    if (!getInventoryItem('crafting_table')) {
      const craftedTable = await craftItemByNames(['crafting_table'], 1)
      if (!craftedTable?.ok && !getInventoryItem('crafting_table')) return craftedTable
    }

    if (playerName) {
      await tossInventoryToPlayer(playerName, 'crafting_table')
    }

    return {
      ok: true,
      item: 'crafting_table',
      logs: inventoryCountByNames(logNames),
      planks: inventoryCountByNames(plankNames)
    }
  }

  function getFurnaceBlocks(maxDistance = 8) {
    const furnaceNames = ['furnace', 'blast_furnace', 'smoker']
    const ids = furnaceNames
      .map((name) => bot.registry.blocksByName[name]?.id)
      .filter((id) => Number.isFinite(id))
    if (ids.length === 0) return []
    const idSet = new Set(ids)
    return bot
      .findBlocks({
        point: bot.entity.position,
        matching: (block) => idSet.has(block.type),
        maxDistance,
        count: 6
      })
      .map((position) => bot.blockAt(position))
      .filter(Boolean)
  }

  async function ensureFurnaces(minCount = 1) {
    let furnaces = getFurnaceBlocks()
    const wanted = clampNumber(minCount, 1, 3, 1)

    while (furnaces.length < wanted && getStoneProgress() >= 8) {
      const crafted = await craftItemByNames(['furnace'], 1)
      if (!crafted?.ok) break
      await placeBlockAutonomously('furnace', ['front'])
      await delay(350)
      furnaces = getFurnaceBlocks()
    }

    if (furnaces.length < wanted) {
      await craftItemByNames(['blast_furnace', 'smoker'], 1).catch(() => false)
      furnaces = getFurnaceBlocks()
    }

    return furnaces
  }

  function getSmeltInput(goal = 'auto') {
    if (goal === 'food') return getInventoryItemByNames(getCookableFoodItems())
    if (goal === 'ore') return getInventoryItemByNames(getRawSmeltItems())
    return getInventoryItemByNames([...getRawSmeltItems(), ...getCookableFoodItems()])
  }

  async function smeltAvailableItems(goal = 'auto') {
    if (Date.now() - aiMemory.lastSmeltAt < 6000) return false
    aiMemory.lastSmeltAt = Date.now()

    if (typeof bot.openFurnace !== 'function') {
      sendEvent(
        bot._client.username,
        'chat',
        'AI smelt blocked: furnace plugin is not active. Restart the bot with AI mode enabled.'
      )
      return false
    }

    const input = getSmeltInput(goal)
    const fuel = getFuelItem()
    if (!input || !fuel) return false

    const furnaces = await ensureFurnaces(Math.min(3, Math.max(1, Math.ceil(input.count / 16))))
    const furnaceBlock = furnaces[0]
    if (!furnaceBlock) return false

    let furnace
    try {
      await bot.pathfinder.goto(
        new goals.GoalNear(
          furnaceBlock.position.x,
          furnaceBlock.position.y,
          furnaceBlock.position.z,
          3
        )
      )
      furnace = await bot.openFurnace(furnaceBlock)
      const inputCount = clampNumber(input.count, 1, 16, 1)
      const fuelCount =
        fuel.name === 'coal' || fuel.name === 'charcoal' ? 1 : Math.min(fuel.count, 4)
      if (!furnace.inputItem()) await furnace.putInput(input.type, null, inputCount)
      if (!furnace.fuelItem()) await furnace.putFuel(fuel.type, null, fuelCount)
      sendEvent(bot._client.username, 'chat', `AI smelt: ${input.name} using ${fuel.name}`)
      aiCore.emit('item.smelt_started', { input: input.name, fuel: fuel.name, count: inputCount })
      await delay(11000)
      if (furnace.outputItem()) {
        const output = furnace.outputItem().name
        await furnace.takeOutput()
        aiCore.emit('item.smelted', { input: input.name, output })
        aiCore.memory.rememberSuccess('smelt', { input: input.name, output })
      }
      return true
    } catch (error) {
      sendEvent(bot._client.username, 'chat', `AI smelt error: ${error.message}`)
      return false
    } finally {
      furnace?.close?.()
    }
  }

  function getFoodItem() {
    return bot.inventory.items().find((item) => {
      if (/poisonous_potato|pufferfish|rotten_flesh|spider_eye/.test(item.name)) return false
      return Boolean(bot.registry.foodsByName?.[item.name])
    })
  }

  async function eatIfHungry() {
    if (bot.food === undefined || bot.food > 14) return false
    if (Date.now() - aiMemory.lastEatAt < 4000) return false

    const food = getFoodItem()
    if (!food) return false

    aiMemory.currentTask = 'eating'
    aiMemory.lastEatAt = Date.now()
    try {
      await bot.equip(food, 'hand')
      await bot.consume()
      sendEvent(bot._client.username, 'chat', `AI survival: ate ${food.name}`)
      return true
    } catch (error) {
      sendEvent(bot._client.username, 'chat', `AI survival eat error: ${error.message}`)
      return false
    } finally {
      aiMemory.currentTask = 'idle'
    }
  }

  function findNearestThreat(range = 8) {
    const hostileNames = new Set([
      'zombie',
      'skeleton',
      'spider',
      'creeper',
      'witch',
      'enderman',
      'drowned',
      'husk',
      'stray',
      'phantom',
      'slime',
      'magma_cube',
      'blaze',
      'piglin_brute',
      'vindicator',
      'evoker',
      'pillager',
      'ravager',
      'warden'
    ])

    return Object.values(bot.entities)
      .filter((entity) => {
        if (!entity?.position || entity === bot.entity || entity.isValid === false) return false
        if (bot.entity.position.distanceTo(entity.position) > range) return false
        return entity.kind === 'Hostile mobs' || hostileNames.has(entity.name)
      })
      .sort(
        (a, b) =>
          bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
      )[0]
  }

  async function defendAgainstThreat(entity) {
    if (!entity?.position || Date.now() - aiMemory.lastThreatAt < 900) return false
    aiMemory.currentTask = 'defending'
    aiMemory.lastThreatAt = Date.now()

    try {
      const distance = bot.entity.position.distanceTo(entity.position)
      if (distance > 3.2) {
        await mobility.reach(entity.position, { near: 2, timeoutMs: 10000 })
      }
      await mobility.combatStrafe(entity)
      bot.attack(entity)
      aiCore.recordMetric('combatWins')
      aiCore.emit('combat.attack', {
        target: entity.name || entity.type,
        distance: Number(distance.toFixed(2))
      })
      sendEvent(
        bot._client.username,
        'chat',
        `AI survival: defending against ${entity.name || entity.type}`
      )
      return true
    } catch (error) {
      sendEvent(bot._client.username, 'chat', `AI survival combat error: ${error.message}`)
      return false
    } finally {
      aiMemory.currentTask = 'idle'
    }
  }

  function reportValuableBlocks() {
    getValuableBlockNames().forEach((target) => {
      const result = findNearestBlocks(target, 48, 2)
      if (result.error || result.blocks.length === 0) return

      result.blocks.forEach((block) => {
        const key = `${block.name}:${block.position.x}:${block.position.y}:${block.position.z}`
        if (aiMemory.reportedBlocks.has(key)) return

        aiMemory.reportedBlocks.add(key)
        if (aiMemory.reportedBlocks.size > 250) {
          aiMemory.reportedBlocks = new Set(Array.from(aiMemory.reportedBlocks).slice(-160))
        }

        sendEvent(
          bot._client.username,
          'chat',
          `AI found ${block.name} @ ${formatPosition(block.position)}`
        )
      })
    })
  }

  function getArmorCraftObjective() {
    const ironIngots = getIronIngotCount()
    const pieces = [
      { item: 'iron_chestplate', cost: 8 },
      { item: 'iron_leggings', cost: 7 },
      { item: 'iron_helmet', cost: 5 },
      { item: 'iron_boots', cost: 4 }
    ]

    for (const piece of pieces) {
      if (!hasAnyItem([piece.item]) && ironIngots >= piece.cost) {
        return {
          type: 'craft',
          items: [piece.item],
          count: 1,
          reason: `armor upgrade ${piece.item}`
        }
      }
    }
  }

  function getNextSurvivalObjective() {
    const pickaxes = ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe']
    const strongPickaxes = ['iron_pickaxe', 'diamond_pickaxe']
    const wood = getWoodProgress()
    const stone = getStoneProgress()
    const iron = getIronProgress()
    const diamond = getDiamondProgress()
    const obsidian = getObsidianProgress()

    if (wood.plankEquivalent < 24) {
      return {
        type: 'mine',
        target: 'wood',
        count: Math.max(Math.ceil((24 - wood.plankEquivalent) / 4), 3),
        range: 96,
        reason: 'start wood supply'
      }
    }
    if (wood.planks < 20) {
      return {
        type: 'craft',
        items: getPlankItemNames(),
        count: 20,
        reason: 'planks for tools'
      }
    }
    if (!hasAnyItem(['crafting_table']) && !getCraftingTableBlock()) {
      return { type: 'craft', items: ['crafting_table'], count: 1, reason: 'crafting table' }
    }
    if (hasAnyItem(['crafting_table']) && !getCraftingTableBlock()) {
      return {
        type: 'place',
        item: 'crafting_table',
        placeArgs: ['front'],
        reason: 'place crafting table'
      }
    }
    if (getStickCount() < 12) {
      return { type: 'craft', items: ['stick'], count: 12, reason: 'sticks for tools' }
    }
    if (!hasAnyItem(pickaxes)) {
      return { type: 'craft', items: ['wooden_pickaxe'], count: 1, reason: 'first pickaxe' }
    }
    if (stone < 32) {
      return {
        type: 'mine',
        target: 'stone',
        count: Math.max(Math.min(32 - stone, 16), 4),
        range: 96,
        reason: 'stone tools and furnace materials'
      }
    }
    if (!hasAnyItem(['stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe'])) {
      return { type: 'craft', items: ['stone_pickaxe'], count: 1, reason: 'stone pickaxe' }
    }
    if (!hasAnyItem(['furnace']) && getFurnaceBlocks().length === 0 && stone >= 8) {
      return { type: 'craft', items: ['furnace'], count: 1, reason: 'furnace for smelting' }
    }
    if (inventoryCount('coal') < 12) {
      return { type: 'mine', target: 'coal', count: 6, range: 96, reason: 'fuel and torches' }
    }
    if (iron < 24) {
      return {
        type: 'mine',
        target: 'iron',
        count: Math.max(Math.min(24 - iron, 8), 3),
        range: 128,
        reason: 'iron gear and progression'
      }
    }
    if (getInventoryItemByNames(getRawSmeltItems()) && getFuelItem()) {
      return { type: 'smelt', goal: 'ore', reason: 'smelt raw ores' }
    }
    if (!hasAnyItem(strongPickaxes)) {
      return {
        type: 'craft',
        items: ['iron_pickaxe'],
        count: 1,
        reason: 'iron pickaxe for diamond'
      }
    }
    if (!hasAnyItem(['shield']) && getIronIngotCount() >= 1 && getWoodProgress().planks >= 6) {
      return { type: 'craft', items: ['shield'], count: 1, reason: 'shield for survival' }
    }
    const armorObjective = getArmorCraftObjective()
    if (armorObjective) return armorObjective
    if (diamond < 5) {
      return {
        type: 'mine',
        target: 'diamond',
        count: Math.max(Math.min(5 - diamond, 3), 1),
        range: 128,
        reason: 'diamond pickaxe and endgame gear'
      }
    }
    if (!hasAnyItem(['diamond_pickaxe']) && diamond >= 3) {
      return {
        type: 'craft',
        items: ['diamond_pickaxe'],
        count: 1,
        reason: 'diamond pickaxe for obsidian'
      }
    }
    if (obsidian < 10) {
      return {
        type: 'mine',
        target: 'obsidian',
        count: 10 - obsidian,
        range: 128,
        reason: 'nether portal frame'
      }
    }
    if (!hasAnyItem(['flint_and_steel'])) {
      return { type: 'blocked', reason: 'needs flint_and_steel crafting/smelting chain' }
    }
    if (inventoryCountByNames(['blaze_rod']) < 7) {
      return { type: 'hunt', target: 'blaze', reason: 'blaze rods for eyes of ender' }
    }
    if (inventoryCountByNames(['ender_pearl']) < 12) {
      return { type: 'hunt', target: 'enderman', reason: 'ender pearls for eyes of ender' }
    }
    if (inventoryCountByNames(['ender_eye']) < 12) {
      return { type: 'blocked', reason: 'needs eye_of_ender crafting and stronghold navigation' }
    }
    return { type: 'blocked', reason: 'ready for stronghold/end fight planner' }
  }

  function getSelectedAiGoal() {
    return 'gemini'
  }

  function getGoalObjective(goal = getSelectedAiGoal()) {
    switch (goal) {
      case 'mining':
        return { type: 'mine', target: 'ore', count: 4, range: 128, reason: 'mine valuable ores' }
      case 'lumber':
        return { type: 'mine', target: 'wood', count: 8, range: 96, reason: 'collect wood' }
      case 'farm':
        if (getWoodProgress().plankEquivalent < 16) {
          return { type: 'mine', target: 'wood', count: 4, range: 96, reason: 'farm tools wood' }
        }
        return {
          type: 'mine',
          target: 'hay_block',
          count: 4,
          range: 96,
          reason: 'collect village/farm food blocks'
        }
      case 'village':
        return { type: 'find', target: 'bell', range: 128, reason: 'find village center marker' }
      case 'trade':
        if (inventoryCount('emerald') < 8) {
          return {
            type: 'mine',
            target: 'emerald',
            count: 3,
            range: 128,
            reason: 'get emeralds for trading'
          }
        }
        return { type: 'blocked', reason: 'villager trading UI automation is not enabled yet' }
      case 'combat': {
        const threat = findNearestThreat(16)
        return threat
          ? {
              type: 'hunt',
              entity: threat,
              target: threat.name,
              reason: `fight ${threat.name || threat.type}`
            }
          : { type: 'blocked', reason: 'no hostile mob nearby' }
      }
      case 'loot':
        return { type: 'find', target: 'chest', range: 96, reason: 'find loot chest' }
      case 'nether':
        if (getObsidianProgress() < 10) {
          return {
            type: 'mine',
            target: 'obsidian',
            count: 10 - getObsidianProgress(),
            range: 128,
            reason: 'nether portal obsidian'
          }
        }
        if (!hasAnyItem(['flint_and_steel'])) {
          return { type: 'blocked', reason: 'needs flint_and_steel before portal placement' }
        }
        return {
          type: 'find',
          target: 'nether_portal',
          range: 128,
          reason: 'find or enter nether portal'
        }
      case 'end':
        if (inventoryCountByNames(['blaze_rod']) < 7) {
          return { type: 'hunt', target: 'blaze', reason: 'blaze rods for eyes of ender' }
        }
        if (inventoryCountByNames(['ender_pearl']) < 12) {
          return { type: 'hunt', target: 'enderman', reason: 'ender pearls for eyes of ender' }
        }
        return { type: 'blocked', reason: 'stronghold/end portal navigation is not enabled yet' }
      case 'survival':
      default:
        return getNextSurvivalObjective()
    }
  }

  async function huntEntity(targetName) {
    const entity = Object.values(bot.entities)
      .filter((candidate) => candidate?.position && candidate.name === targetName)
      .sort(
        (a, b) =>
          bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
      )[0]

    if (!entity) return false
    await defendAgainstThreat(entity)
    return true
  }

  async function exploreForObjective(reason) {
    if (Date.now() - aiMemory.lastExploreAt < 10000) return false
    aiMemory.lastExploreAt = Date.now()
    aiMemory.currentTask = `exploring: ${reason}`

    const angle = Math.random() * Math.PI * 2
    const distance = crypto.randomInt(24, 56)
    const x = bot.entity.position.x + Math.cos(angle) * distance
    const z = bot.entity.position.z + Math.sin(angle) * distance
    const y = bot.entity.position.y

    sendEvent(bot._client.username, 'chat', `AI survival: exploring for ${reason}`)
    await mobility.reach({ x, y, z }, { near: 4, timeoutMs: 25000 }).catch(() => {})
    aiMemory.currentTask = 'idle'
    return true
  }

  function findNearestBlockMatching(matching, maxDistance = 32, count = 1) {
    if (!bot.entity?.position || typeof bot.findBlocks !== 'function') return []
    return bot
      .findBlocks({
        point: bot.entity.position,
        matching,
        maxDistance: clampNumber(maxDistance, 4, 128, 32),
        count: clampNumber(count, 1, 16, 1)
      })
      .map((position) => bot.blockAt(position))
      .filter(Boolean)
      .sort(
        (a, b) =>
          bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
      )
  }

  function containerBlockNames(type = 'chest') {
    const normalized = normalizeBlockName(type)
    if (normalized === 'furnace') return ['furnace', 'blast_furnace', 'smoker']
    if (normalized === 'barrel') return ['barrel']
    return ['chest', 'trapped_chest', 'barrel']
  }

  async function openNearestContainerBlock(type = 'chest', range = 32) {
    const names = new Set(containerBlockNames(type))
    const block = findNearestBlockMatching((candidate) => names.has(candidate.name), range, 1)[0]
    if (!block) return { ok: false, reason: `no ${type} container nearby` }
    await mobility.reach(block.position, { near: 4, timeoutMs: 18000 })
    const container =
      block.name.includes('furnace') || block.name === 'smoker' || block.name === 'blast_furnace'
        ? await bot.openFurnace(block)
        : await bot.openContainer(block)
    return { ok: true, block, container }
  }

  async function inspectNearestContainer(type = 'chest', range = 32) {
    const opened = await openNearestContainerBlock(type, range).catch((error) => ({
      ok: false,
      reason: error.message
    }))
    if (!opened.ok) return opened
    try {
      const items = opened.container.containerItems?.() || []
      return {
        ok: true,
        type: opened.block.name,
        position: formatPosition(opened.block.position),
        items: items.slice(0, 20).map(({ name, count }) => ({ name, count }))
      }
    } finally {
      opened.container.close?.()
    }
  }

  async function storeItemsInNearestContainer(items, except) {
    const wanted = Array.isArray(items) ? items.map(normalizeBlockName) : undefined
    const excluded = new Set((Array.isArray(except) ? except : []).map(normalizeBlockName))
    const opened = await openNearestContainerBlock('chest', 32).catch((error) => ({
      ok: false,
      reason: error.message
    }))
    if (!opened.ok) return opened
    let stored = 0
    try {
      const inventoryItems = bot.inventory.items().filter((item) => {
        if (/pickaxe|axe|shovel|sword|helmet|chestplate|leggings|boots|shield/.test(item.name)) {
          return false
        }
        if (excluded.has(item.name)) return false
        return !wanted || wanted.some((target) => itemMatchesTarget(item.name, target))
      })
      for (const item of inventoryItems) {
        await opened.container.deposit(item.type, item.metadata ?? null, item.count)
        stored += item.count
      }
      return { ok: stored > 0, stored, container: opened.block.name }
    } finally {
      opened.container.close?.()
    }
  }

  async function withdrawItemsFromNearestContainer(items, count = 1) {
    const wanted = Array.isArray(items) ? items.map(normalizeBlockName) : undefined
    const wantedCount = clampNumber(count, 1, 64, 1)
    const opened = await openNearestContainerBlock('chest', 32).catch((error) => ({
      ok: false,
      reason: error.message
    }))
    if (!opened.ok) return opened
    let withdrawn = 0
    try {
      const containerItems = opened.container.containerItems?.() || []
      for (const item of containerItems) {
        if (wanted && !wanted.some((target) => itemMatchesTarget(item.name, target))) continue
        const amount = Math.min(item.count, wantedCount - withdrawn)
        if (amount <= 0) break
        await opened.container.withdraw(item.type, item.metadata ?? null, amount)
        withdrawn += amount
        if (withdrawn >= wantedCount) break
      }
      return { ok: withdrawn > 0, withdrawn, container: opened.block.name }
    } finally {
      opened.container.close?.()
    }
  }

  async function sleepInNearestBed(range = 32) {
    const bed = findNearestBlockMatching((block) => /_bed$|^bed$/.test(block.name), range, 1)[0]
    if (!bed) return { ok: false, reason: 'no bed nearby' }
    await mobility.reach(bed.position, { near: 3, timeoutMs: 18000 })
    await bot.sleep(bed)
    return { ok: true, bed: bed.name, position: formatPosition(bed.position) }
  }

  function buildGeminiObservation(username) {
    return {
      bot: bot.username,
      speaker: username,
      health: Math.round(bot.health || 0),
      food: bot.food,
      position: bot.entity?.position && formatPosition(bot.entity.position),
      heldItem: bot.heldItem?.name,
      inventory: bot.inventory
        .items()
        .slice(0, 30)
        .map(({ name, count }) => ({ name, count })),
      nearbyPlayers: Object.values(bot.players || {})
        .map((player) => player?.entity)
        .filter((entity) => entity?.position && entity.username !== bot.username)
        .slice(0, 8)
        .map((entity) => ({
          name: entity.username,
          distance: Number(bot.entity.position.distanceTo(entity.position).toFixed(1)),
          position: formatPosition(entity.position)
        })),
      nearbyEntities: Object.values(bot.entities || {})
        .filter((entity) => entity?.position && entity !== bot.entity)
        .sort(
          (a, b) =>
            bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
        )
        .slice(0, 12)
        .map((entity) => ({
          name: entity.username || entity.name || entity.type,
          type: entity.type,
          distance: Number(bot.entity.position.distanceTo(entity.position).toFixed(1)),
          position: formatPosition(entity.position)
        })),
      local3dModel: buildLocal3DModel(10, 7),
      pathfinderMoving: Boolean(bot.pathfinder?.isMoving?.())
    }
  }

  async function executeGeminiAction(action, username) {
    if (!action || typeof action !== 'object') return { ok: false, reason: 'empty_action' }
    const routedIntent = await executeIntentAction(action, username)
    if (routedIntent) return routedIntent
    const tool = String(action.tool || '').toLowerCase()
    const args = action.args && typeof action.args === 'object' ? action.args : {}
    aiCore.debug.currentTask = action
    aiCore.debug.executionState = 'ACTING'

    switch (tool) {
      case 'say':
      case 'chat': {
        const text = String(args.message || args.text || action.reply || '').trim()
        if (!text) return { ok: false, reason: 'empty_message' }
        const reply = text.slice(0, 240)
        const replyKey = `${options.host || ''}:${bot.username}:${reply}`
        if (rememberRecent(recentGeminiChatReplies, replyKey, GEMINI_CHAT_DEDUPE_MS)) {
          bot.chat(reply)
        }
        return { ok: true }
      }
      case 'move_to': {
        const { x, y, z, near = 2 } = args
        if (![x, y, z].every((value) => Number.isFinite(Number(value)))) {
          return { ok: false, reason: 'invalid_coordinates' }
        }
        return mobility.reach(
          { x: Number(x), y: Number(y), z: Number(z) },
          { near: clampNumber(near, 1, 8, 2), timeoutMs: 30000 }
        )
      }
      case 'come':
      case 'come_to_me':
      case 'come_to_player':
      case 'go_to_player':
        return comeToPlayerIntent(
          resolveSpeakerTarget(args.player || args.name || args.target, username),
          args.near || 2
        )
      case 'follow':
      case 'follow_entity':
      case 'follow_user':
      case 'follow_player': {
        return comeToPlayerIntent(resolveSpeakerTarget(args.name || args.player || args.target, username), args.near || 2, {
          timeoutMs: 60000
        })
      }
      case 'protect':
      case 'protect_player':
      case 'guard_player':
        return protectPlayerIntent(resolveSpeakerTarget(args.player || args.name || args.target, username))
      case 'gather_wood':
        return mineNearestBlocks('wood', args.count || args.logs || 1, args.range || 96)
      case 'gather_resource':
        return mineNearestBlocks(args.resource || args.target || args.block || 'wood', args.count || 1, args.range || 96)
      case 'explore_cave':
        return exploreForObjective(args.reason || 'find cave')
      case 'stop':
        stopPathfinderTask('Gemini: stopped')
        return { ok: true }
      case 'mine_block':
        if ([args.x, args.y, args.z].every((value) => Number.isFinite(Number(value)))) {
          return mineBlockAtPosition(args.x, args.y, args.z)
        }
        return mineNearestBlocks(
          args.block || args.name || args.target || 'stone',
          args.count || 1,
          args.range || 64
        )
      case 'place_block':
        return placeBlockAutonomously(args.item, args.where || args.placeArgs || ['front'])
      case 'craft_item':
        return craftItemByNames([args.item].filter(Boolean), args.count || 1)
      case 'equip_item': {
        const itemName = normalizeBlockName(args.item)
        const item = bot.inventory.items().find((entry) => itemMatchesTarget(entry.name, itemName))
        if (!item) return { ok: false, reason: `item_not_found:${itemName}` }
        await bot.equip(item, args.destination || 'hand')
        return { ok: true }
      }
      case 'eat_food':
        return eatIfHungry()
      case 'attack_entity':
        return huntEntity(args.name || args.entity)
      case 'look_at': {
        const target = resolveSpeakerTarget(args.name || args.target, username)
        const looked =
          (await aiLookAtTarget(target)) ||
          (target === username ? await aiLookAtNearestPlayer() : false) ||
          (await aiLook(args.direction || target)) ||
          (await aiLookAtNearestPlayer()) ||
          (await aiLookAtNearestVisible())
        return looked ? { ok: true } : { ok: true, reason: 'look_forced_no_visible_target' }
      }
      case 'use_item':
        mobility.rightClick()
        return { ok: true }
      case 'give_items':
        return tossInventoryToPlayer(args.player || username, args.item || args.target || args.name)
      case 'make_crafting_table_for_player':
      case 'crafting_table_for_player':
      case 'make_crafting_table':
        return makeCraftingTableForPlayer(args.player || username, args.logs || args.count || 3)
      case 'status':
        sendAiStatus()
        return { ok: true }
      case 'inventory':
        sendEvent(bot._client.username, 'chat', `Gemini inventory: ${getInventorySnapshot()}`)
        return { ok: true }
      case 'explore':
        return exploreForObjective(args.reason || 'Gemini requested exploration')
      case 'smelt_item':
        return smeltAvailableItems(args.item || args.goal || 'ore')
      case 'sleep':
        return sleepInNearestBed(args.range || 32)
      default:
        return { ok: false, reason: `unknown_tool:${tool}` }
    }
  }

  async function executeIntentAction(action, username) {
    const intent = String(action.intent || action.tool || '').toLowerCase()
    const args = action.args && typeof action.args === 'object' ? action.args : {}
    const target = action.target || args.target
    const player = resolveSpeakerTarget(args.player || args.name || target, username)

    switch (intent) {
      case 'come_to_player':
      case 'come_to_me':
      case 'go_to_player':
        return comeToPlayerIntent(player, args.near || 2)
      case 'follow_player':
      case 'follow':
        return comeToPlayerIntent(player, args.near || 2, { timeoutMs: 60000 })
      case 'protect_player':
      case 'protect':
      case 'guard_player':
        return protectPlayerIntent(player)
      case 'gather_wood':
        return mineNearestBlocks('wood', args.count || args.logs || 1, args.range || 96)
      case 'gather_resource':
      case 'obtain_resource':
        return mineNearestBlocks(args.resource || target || args.block || 'wood', args.count || 1, args.range || 96)
      case 'explore_cave':
        return exploreForObjective(args.reason || 'find cave')
      case 'build_house':
        return { ok: false, reason: 'build_house_skill_not_ready' }
      case 'obtain_diamond':
        return mineNearestBlocks('diamond', args.count || 1, args.range || 96)
      default:
        return undefined
    }
  }

  async function executeActionClosedLoop(action, username, goalMessage, options = {}) {
    const maxAttempts = clampNumber(options.maxAttempts, 1, 4, 3)
    const actionKey = `${action?.tool || 'unknown'}:${JSON.stringify(action?.args || {})}`
    let lastResult = { ok: false, reason: 'not_started' }
    let recoveryUsed

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const before = buildActionFeedbackSnapshot()
      setExecutionStateForAction(action, attempt > 1 ? 'RECOVERING' : undefined)
      const candidate = attempt === 1 ? action : buildRecoveryAction(action, lastResult, attempt, username)
      recoveryUsed = attempt === 1 ? recoveryUsed : candidate

      if (!candidate) {
        if (attempt === 1) {
          lastResult = { ok: false, reason: 'no_action_candidate' }
        }
        break
      }

      if (attempt > 1) {
        sendEvent(
          bot._client.username,
          'chat',
          `AI recovery: ${candidate.tool} after ${lastResult.reason || 'failure'}`
        )
      }

      const rawResult = await executeGeminiAction(candidate, username)
      const after = buildActionFeedbackSnapshot()
      const verification = verifyActionOutcome(candidate, rawResult, before, after, username)
      lastResult = {
        ...rawResult,
        ok: verification.ok,
        reason: verification.ok ? rawResult?.reason : verification.reason || rawResult?.reason,
        verification,
        attempt,
        action: candidate
      }
      rememberActionOutcome({
        goal: goalMessage,
        originalAction: action,
        action: candidate,
        attempt,
        before,
        after,
        outcome: lastResult,
        recoveryUsed
      })

      if (verification.ok) {
        aiCore.memory.rememberSuccess('action_verified', {
          tool: candidate.tool,
          attempts: attempt,
          goal: goalMessage
        })
        return lastResult
      }

      aiCore.memory.rememberFailure('action_unverified', {
        key: actionKey,
        tool: candidate.tool,
        reason: lastResult.reason,
        attempt,
        goal: goalMessage
      })

      if (isCriticalState(after)) {
        const criticalRecovery = buildCriticalRecoveryAction(after)
        if (criticalRecovery) {
          await executeGeminiAction(criticalRecovery, username).catch(() => undefined)
        }
      }
    }

    aiCore.reflect('action failed after closed-loop retries', {
      action,
      reason: lastResult.reason,
      goal: goalMessage
    })
    return lastResult
  }

  function buildActionFeedbackSnapshot() {
    return {
      position: bot.entity?.position && formatPosition(bot.entity.position),
      rawPosition: bot.entity?.position && {
        x: bot.entity.position.x,
        y: bot.entity.position.y,
        z: bot.entity.position.z
      },
      health: Math.round(bot.health || 0),
      food: bot.food,
      inventory: bot.inventory.items().map(({ name, count }) => ({ name, count })),
      visibleBlocks: buildLocal3DModel(8, 5)?.nearestByCategory || {},
      visibleEntities: Object.values(bot.entities || {})
        .filter((entity) => entity?.position && entity !== bot.entity)
        .slice(0, 10)
        .map((entity) => ({
          name: entity.username || entity.name || entity.type,
          type: entity.type,
          distance: Number(bot.entity.position.distanceTo(entity.position).toFixed(1))
        }))
    }
  }

  function verifyActionOutcome(action, result, before, after, username) {
    if (result?.ok === false && !isSoftRecoverableReason(result.reason)) {
      return { ok: false, reason: result.reason || 'executor_failed' }
    }

    const tool = String(action?.tool || '').toLowerCase()
    const args = action?.args || {}
    if (['say', 'chat', 'status', 'inventory', 'use_item', 'stop', 'look_at'].includes(tool)) {
      return { ok: result?.ok !== false, reason: result?.reason }
    }
    if (tool === 'move_to') {
      const target = { x: Number(args.x), y: Number(args.y), z: Number(args.z) }
      if (![target.x, target.y, target.z].every(Number.isFinite)) {
        return { ok: false, reason: 'invalid_move_target' }
      }
      const distance = distanceBetweenRaw(after.rawPosition, target)
      return distance < clampNumber(args.near, 1, 8, 2) + 0.8
        ? { ok: true, distance }
        : { ok: false, reason: `move_not_reached:${distance.toFixed(1)}`, distance }
    }
    if (tool.includes('follow') || tool.includes('come_to_player')) {
      const entity = findPlayerEntity(resolveSpeakerTarget(args.name || args.player || args.target, username))
      const distance = entity?.position ? bot.entity.position.distanceTo(entity.position) : Infinity
      return distance <= clampNumber(args.near, 1, 8, 2) + 1.5 || bot.pathfinder?.isMoving?.()
        ? { ok: true, distance }
        : { ok: false, reason: 'follow_target_not_reached', distance }
    }
    if (tool === 'mine_block') {
      const target = args.block || args.name || args.target
      const inventoryChanged = inventoryTotal(after.inventory) > inventoryTotal(before.inventory)
      const hasTarget = target ? inventoryContainsTarget(after.inventory, target) : inventoryChanged
      return result?.ok || hasTarget || inventoryChanged
        ? { ok: true }
        : { ok: false, reason: result?.reason || 'mine_no_inventory_gain' }
    }
    if (tool === 'craft_item') {
      const item = args.item
      return item && inventoryContainsTarget(after.inventory, item)
        ? { ok: true }
        : { ok: Boolean(result?.ok), reason: result?.reason || 'craft_item_missing' }
    }
    if (tool === 'make_crafting_table_for_player' || tool === 'make_crafting_table') {
      return result?.ok || inventoryContainsTarget(after.inventory, 'crafting_table')
        ? { ok: true }
        : { ok: false, reason: result?.reason || 'crafting_table_not_verified' }
    }
    if (tool === 'place_block') {
      return result?.ok ? { ok: true } : { ok: false, reason: result?.reason || 'place_failed' }
    }
    if (tool === 'eat_food') {
      return after.food > before.food || result?.ok ? { ok: true } : { ok: false, reason: 'food_not_improved' }
    }
    if (tool === 'attack_entity') {
      return result?.ok ? { ok: true } : { ok: false, reason: result?.reason || 'attack_failed' }
    }
    return { ok: result?.ok !== false, reason: result?.reason }
  }

  function buildRecoveryAction(action, result, attempt, username) {
    const tool = String(action?.tool || '').toLowerCase()
    const args = action?.args || {}
    const reason = String(result?.reason || '').toLowerCase()

    if (reason.includes('missing_logs') || reason.includes('wood') || reason.includes('log')) {
      return { tool: 'mine_block', args: { target: 'wood', count: 1 + attempt, range: 96 }, reason: 'recover missing wood' }
    }
    if (reason.includes('crafting_table') || reason.includes('missing crafting')) {
      return { tool: 'make_crafting_table_for_player', args: { player: username, logs: 3 }, reason: 'recover missing crafting table' }
    }
    if (reason.includes('player_not_visible')) {
      return undefined
    }
    if (tool.includes('follow') || tool.includes('come_to_player')) {
      return attempt === 2
        ? {
            tool,
            args: {
              ...args,
              player: args.player || args.name || args.target || username,
              near: clampNumber(args.near, 2, 8, 4)
            },
            reason: 'retry follow with wider arrival radius'
          }
        : undefined
    }
    if (tool === 'move_to' || reason.includes('path') || reason.includes('not_reached') || reason.includes('timeout')) {
      return attempt === 2
        ? { tool: 'move_to', args: { ...args, near: clampNumber(args.near, 2, 8, 3) }, reason: 'retry movement with wider arrival radius' }
        : undefined
    }
    if (tool === 'mine_block' || reason.includes('unreachable')) {
      return attempt === 2
        ? { tool: 'look_at', args: { target: args.target || args.block || 'nearest' }, reason: 're-scan target before mining retry' }
        : { tool: 'mine_block', args: { ...args, range: clampNumber(args.range, 32, 128, 96) }, reason: 'retry mining with wider search' }
    }
    if (tool === 'craft_item' || reason.includes('missing_material') || reason.includes('no_recipe')) {
      return { tool: 'mine_block', args: { target: 'wood', count: 1 + attempt, range: 96 }, reason: 'recover crafting materials' }
    }
    return undefined
  }

  function rememberActionOutcome(record) {
    aiMemory.actionHistory.push({
      ...record,
      at: Date.now()
    })
    if (aiMemory.actionHistory.length > 80) aiMemory.actionHistory.shift()
    aiCore.memory.state.actions.push({
      action: record.action,
      outcome: record.outcome,
      recoveryUsed: record.recoveryUsed,
      at: Date.now()
    })
    if (aiCore.memory.state.actions.length > 120) aiCore.memory.state.actions.shift()
    aiCore.memory.setWorking('recentActions', aiMemory.actionHistory.slice(-12))
  }

  function setExecutionStateForAction(action, override) {
    if (override) {
      aiCore.debug.executionState = override
      return
    }
    const tool = String(action?.tool || '').toLowerCase()
    if (tool === 'move_to' || tool.includes('follow') || tool.includes('come_to_player')) aiCore.debug.executionState = 'MOVING'
    else if (tool === 'mine_block') aiCore.debug.executionState = 'MINING'
    else if (tool === 'place_block' || tool === 'craft_item') aiCore.debug.executionState = 'BUILDING'
    else if (tool === 'attack_entity') aiCore.debug.executionState = 'COMBAT'
    else if (tool === 'explore') aiCore.debug.executionState = 'EXPLORING'
    else aiCore.debug.executionState = 'ACTING'
  }

  function distanceBetweenRaw(a, b) {
    if (!a || !b) return Infinity
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
  }

  function inventoryTotal(items) {
    return (items || []).reduce((total, item) => total + Number(item.count || 0), 0)
  }

  function inventoryContainsTarget(items, target) {
    return (items || []).some((item) => itemMatchesTarget(item.name, target))
  }

  function isSoftRecoverableReason(reason) {
    return /path|timeout|unreachable|missing|no_recipe|not_found|not_reached|blocked|target/i.test(String(reason || ''))
  }

  function isCriticalState(snapshot) {
    return Number(snapshot.health || 0) <= 8 || Number(snapshot.food || 20) <= 4
  }

  function buildCriticalRecoveryAction(snapshot) {
    if (Number(snapshot.food || 20) <= 4) return { tool: 'eat_food', args: {}, reason: 'critical hunger recovery' }
    if (Number(snapshot.health || 0) <= 8) return { tool: 'explore', args: { reason: 'escape danger and recover health' }, reason: 'critical health recovery' }
    return undefined
  }

  function prepareGeminiCommand() {
    clearInterval(playerGotoTimer)
    playerGotoTimer = undefined
    pathfinderBusy = false
    bot.pathfinder?.setGoal?.(null)
    bot.pathfinder?.stop?.()
    resetAiBody()
    aiMemory.currentTask = 'gemini_control'
  }

  async function askGeminiFromChat(username, message, optionsOverride = {}) {
    const allowActions = optionsOverride.allowActions !== false
    const inputKey = `${options.host || ''}:${getPrimaryBotName()}:${username}:${normalizeCommandText(message)}`
    if (!optionsOverride.bypassDedupe && !rememberRecent(recentGeminiChatInputs, inputKey, GEMINI_CHAT_DEDUPE_MS)) {
      console.log('[GEMINI] Duplicate chat input ignored', { bot: bot.username, username, message })
      return
    }
    if (aiThinkBusy) {
      if (!allowActions) {
        bot.chat(optionsOverride.defaultReply || 'Buradayim, onceki komutu bitiriyorum.')
        return
      }
      sendEvent(bot._client.username, 'chat', 'Gemini busy: onceki komut bitiyor')
      return
    }
    aiThinkBusy = true
    try {
      prepareGeminiCommand()
      const actionableCommand = isActionableChatCommand(message)
      const immediateAction = allowActions ? inferImmediateFallbackAction(username, message) : undefined
      const observation = immediateAction ? undefined : buildGeminiObservation(username)
      let decision = immediateAction
        ? {
            ok: true,
            actions: [immediateAction],
            intent: immediateAction.tool
          }
        : await aiCore.decideFromChat({
            username,
            message,
            observation
          })
      if (!decision.ok) {
        const fallbackAction = allowActions && actionableCommand ? inferFallbackAction(username, message) : undefined
        if (fallbackAction) {
          decision = { ok: true, actions: [fallbackAction], intent: fallbackAction.tool }
        } else {
          sendEvent(bot._client.username, 'chat', `Gemini error: ${decision.error}`)
          return
        }
      }
      let actions = allowActions ? (Array.isArray(decision.actions) ? decision.actions.filter(Boolean) : []) : []
      if (allowActions && actionableCommand && actions.length === 0) {
        const fallbackAction = inferFallbackAction(username, message)
        if (fallbackAction) {
          actions = [fallbackAction]
        } else {
          const repaired = await aiCore.repairEmptyAction({
            username,
            message,
            observation: observation || buildGeminiObservation(username),
            previous: decision.raw || decision.reply || {}
        })
          if (repaired.ok) {
            decision = repaired
            actions = Array.isArray(decision.actions) ? decision.actions.filter(Boolean) : []
          }
        }
      }
      if (decision.intent) {
        sendEvent(bot._client.username, 'chat', `Gemini intent: ${String(decision.intent).slice(0, 180)}`)
      }
      if (decision.reply) {
        const reply = String(decision.reply).slice(0, 240)
        const replyKey = `${options.host || ''}:${bot.username}:${reply}`
        if (rememberRecent(recentGeminiChatReplies, replyKey, GEMINI_CHAT_DEDUPE_MS)) {
          bot.chat(reply)
        }
      }
      actions = allowActions
        ? normalizeGeminiActions(actions, username, message).filter((action) =>
            isActionAllowedForMessage(action, message)
          ).slice(0, 5)
        : []
      if (actions.length === 0) {
        if (!decision.reply && optionsOverride.defaultReply) bot.chat(optionsOverride.defaultReply)
        else if (allowActions) {
          sendEvent(
            bot._client.username,
            'chat',
            decision.reply
              ? 'Gemini: replied without tool action'
              : 'Gemini: no tool action returned'
          )
        }
      }
      for (const action of actions) {
        if (action.reason) {
          sendEvent(
            bot._client.username,
            'chat',
            `Gemini action: ${action.tool} - ${String(action.reason).slice(0, 160)}`
          )
        }
        const result = await executeActionClosedLoop(action, username, message)
        aiCore.recordMetric(result?.ok ? 'actions' : 'failures')
        if (!result?.ok) {
          sendEvent(
            bot._client.username,
            'chat',
            `Gemini action failed: ${action.tool} ${result?.reason || 'unknown'}`
          )
          break
        }
      }
      aiCore.debug.executionState = 'LISTENING'
    } catch (error) {
      aiCore.debug.lastError = error.message
      aiCore.debug.executionState = 'FAILED'
      sendEvent(bot._client.username, 'chat', `Gemini error: ${error.message}`)
    } finally {
      aiThinkBusy = false
    }
  }

  function normalizeGeminiActions(actions, username, message) {
    const normalizedActions = (Array.isArray(actions) ? actions.filter(Boolean) : [])
      .map((action) => normalizeIntentAction(action, username, message))
      .filter((action) => !isEmptyChatAction(action))
    const explicitSkill = inferExplicitSkillAction(username, message)
    if (explicitSkill && shouldPreferSkillAction(normalizedActions, explicitSkill)) {
      return [explicitSkill]
    }
    if (normalizedActions.length > 0) return normalizedActions
    const fallbackAction = inferFallbackAction(username, message)
    if (fallbackAction) return [fallbackAction]

    const text = normalizeCommandText(message)
    const asksToFollow =
      /\b(follow me|follow|takip et|beni takip|beni izle|arkamdan gel|pesimden gel|peşimden gel)\b/i.test(
        text
      ) ||
      (text.includes('takip') && (text.includes('beni') || text.includes('et')))

    if (asksToFollow) {
      return [
        {
          tool: 'follow_player',
          args: { name: username, near: 2 },
          reason: 'explicit follow command fallback'
        }
      ]
    }

    return normalizedActions
  }

  function isActionableChatCommand(message) {
    const text = normalizeCommandText(message)
    const words = text.split(' ').filter(Boolean)
    const actionWords = [
      'gel',
      'come',
      'takip',
      'follow',
      'git',
      'goto',
      'move',
      'yuru',
      'yürü',
      'walk',
      'kos',
      'koş',
      'dur',
      'stop',
      'kes',
      'kir',
      'kır',
      'kaz',
      'dig',
      'mine',
      'break',
      'topla',
      'collect',
      'gather',
      'bul',
      'find',
      'ara',
      'search',
      'getir',
      'bring',
      'ver',
      'give',
      'at',
      'drop',
      'birak',
      'bırak',
      'koy',
      'place',
      'yerlestir',
      'yerleştir',
      'craft',
      'yap',
      'uret',
      'üret',
      'ye',
      'eat',
      'uyu',
      'sleep',
      'kullan',
      'use',
      'saldir',
      'saldır',
      'attack',
      'vur',
      'koru',
      'protect',
      'guard',
      'kesfet',
      'keşfet',
      'explore',
      'bak',
      'look',
      'envanter',
      'inventory',
      'durum',
      'status'
    ]
    const actionPhrases = [
      'come to me',
      'follow me',
      'beni takip',
      'takip et',
      'yanima gel',
      'yanıma gel',
      'arkamdan gel',
      'beni koru',
      'protect me'
    ]
    return actionPhrases.some((phrase) => text.includes(phrase)) || hasAnyWord(words, actionWords)
  }

  function isMovementTool(tool) {
    return [
      'move_to',
      'come',
      'come_to_me',
      'come_to_player',
      'go_to',
      'go_to_player',
      'follow',
      'follow_entity',
      'follow_user',
      'follow_player',
      'explore',
      'explore_cave'
    ].includes(String(tool || '').toLowerCase())
  }

  function isActionAllowedForMessage(action, message) {
    const tool = String(action?.tool || action?.intent || '').toLowerCase()
    if (!tool) return false
    if (['say', 'chat', 'status', 'inventory', 'stop'].includes(tool)) return true
    if (!isActionableChatCommand(message)) return false

    const text = normalizeCommandText(message)
    const words = text.split(' ').filter(Boolean)
    if (isMovementTool(tool)) {
      return (
        hasAnyWord(words, [
          'gel',
          'come',
          'takip',
          'follow',
          'git',
          'goto',
          'move',
          'yuru',
          'yürü',
          'walk',
          'kesfet',
          'keşfet',
          'explore'
        ]) ||
        text.includes('come to me') ||
        text.includes('follow me') ||
        text.includes('yanima gel') ||
        text.includes('yanıma gel') ||
        text.includes('takip et') ||
        text.includes('beni takip')
      )
    }
    return true
  }

  function normalizeIntentAction(action, username, message) {
    if (!action || typeof action !== 'object') return action
    const text = normalizeCommandText(message)
    const words = text.split(' ').filter(Boolean)
    const tool = String(action.tool || action.intent || '').toLowerCase()
    const args =
      action.args && typeof action.args === 'object'
        ? action.args
        : action.parameters && typeof action.parameters === 'object'
          ? action.parameters
          : {}
    const semanticTarget = action.target || args.target
    const isEmptySay =
      (tool === 'say' || tool === 'chat') &&
      !String(args.message || args.text || action.reply || '').trim()

    const asksCome =
      hasAnyWord(words, ['gel', 'come']) ||
      text.includes('yanima gel') ||
      text.includes('yanıma gel') ||
      text.includes('come to me')
    const asksFollow =
      text.includes('follow me') ||
      text.includes('takip et') ||
      text.includes('beni takip') ||
      text.includes('beni izle') ||
      text.includes('arkamdan gel')
    const asksProtect =
      text.includes('beni koru') ||
      text.includes('protect me') ||
      text.includes('guard me') ||
      hasAnyWord(words, ['koru', 'protect', 'guard'])

    if (isEmptySay) {
      return inferFallbackAction(username, message) || action
    }
    if (asksCome && (tool === 'move_to' || tool === 'follow_player' || tool === 'go_to')) {
      return { tool: 'come_to_player', args: { player: username, near: args.near || 2 }, reason: 'intent normalized from come command' }
    }
    if (asksFollow && (tool === 'move_to' || tool === 'follow_player' || tool === 'go_to')) {
      return { tool: 'follow_player', args: { player: username, near: args.near || 2 }, reason: 'intent normalized from follow command' }
    }
    if (asksProtect) {
      return { tool: 'protect_player', args: { player: username }, reason: 'intent normalized from protect command' }
    }
    if (action.parameters && !action.args) {
      return {
        ...action,
        args
      }
    }
    if (action.intent && !action.tool) {
      return {
        tool,
        args: {
          ...args,
          target: semanticTarget,
          player: args.player || (semanticTarget === 'speaker' ? username : undefined)
        },
        reason: action.reason || 'intent object normalized'
      }
    }
    return action
  }

  function isEmptyChatAction(action) {
    const tool = String(action?.tool || action?.intent || '').toLowerCase()
    if (tool !== 'say' && tool !== 'chat') return false
    const args =
      action?.args && typeof action.args === 'object'
        ? action.args
        : action?.parameters && typeof action.parameters === 'object'
          ? action.parameters
          : {}
    return !String(args.message || args.text || action?.reply || '').trim()
  }

  function inferExplicitSkillAction(username, message) {
    const text = normalizeCommandText(message)
    const words = text.split(' ').filter(Boolean)
    const wantsWood = hasAnyWord(words, ['odun', 'agac', 'ağaç', 'wood', 'log'])
    const wantsPlanks = hasAnyWord(words, ['tahta', 'plank', 'planks'])
    const wantsCraftingTable =
      text.includes('craftingtable') ||
      text.includes('crafting table') ||
      text.includes('crafting_table') ||
      text.includes('çalışma masası') ||
      text.includes('calisma masasi')
    const wantsGive = hasAnyWord(words, ['ver', 'give', 'bana', 'getir'])

    if (wantsWood && (wantsPlanks || wantsCraftingTable) && wantsCraftingTable) {
      const requested = words.map(Number).find((value) => Number.isFinite(value))
      return {
        tool: 'make_crafting_table_for_player',
        args: { player: wantsGive ? username : undefined, logs: requested || 3 },
        reason: 'compound wood to planks to crafting table request'
      }
    }

    return undefined
  }

  function shouldPreferSkillAction(actions, skillAction) {
    if (!skillAction) return false
    if (!Array.isArray(actions) || actions.length === 0) return true
    return actions.some((action) => {
      const tool = String(action?.tool || '').toLowerCase()
      return tool === 'move_to' || tool === 'look_at' || tool === 'say' || tool === 'chat'
    })
  }

  function inferFallbackAction(username, message) {
    const text = normalizeCommandText(message)
    const words = text.split(' ').filter(Boolean)
    const count = words.map(Number).find((value) => Number.isFinite(value))
    const coordinates = extractCommandCoordinates(words)
    const after = (...tokens) => firstWordAfterAny(words, tokens)

    if (hasAnyWord(words, ['dur', 'stop', 'iptal', 'cancel'])) {
      return { tool: 'stop', args: {}, reason: 'fallback stop command' }
    }
    if (hasAnyWord(words, ['durum', 'status'])) {
      return { tool: 'status', args: {}, reason: 'fallback status command' }
    }
    if (hasAnyWord(words, ['envanter', 'inventory', 'items', 'itemler'])) {
      return { tool: 'inventory', args: {}, reason: 'fallback inventory command' }
    }
    if (
      text.includes('yanima gel') ||
      text.includes('yanıma gel') ||
      text.includes('come to me') ||
      hasAnyWord(words, ['gel', 'come'])
    ) {
      return { tool: 'come_to_player', args: { player: username, near: 2 }, reason: 'fallback come intent' }
    }

    if (
      text.includes('follow me') ||
      text.includes('takip et') ||
      text.includes('beni takip') ||
      text.includes('beni izle') ||
      text.includes('arkamdan gel') ||
      text.includes('pesimden gel') ||
      text.includes('peşimden gel') ||
      hasAnyWord(words, ['follow'])
    ) {
      return { tool: 'follow_player', args: { player: username, near: 2 }, reason: 'fallback follow intent' }
    }
    if (hasAnyWord(words, ['kesfet', 'keşfet', 'explore', 'dolas', 'dolaş'])) {
      return { tool: 'explore', args: { reason: text || 'fallback explore' }, reason: 'fallback explore command' }
    }
    if (coordinates && hasAnyWord(words, ['git', 'goto', 'move', 'yuru', 'yürü'])) {
      return { tool: 'move_to', args: { ...coordinates, near: 2 }, reason: 'fallback coordinate move command' }
    }
    if (hasAnyWord(words, ['ye', 'eat', 'yemek', 'ac', 'aç', 'hungry'])) {
      return { tool: 'eat_food', args: {}, reason: 'fallback eat command' }
    }
    if (hasAnyWord(words, ['uyu', 'sleep', 'yat'])) {
      return { tool: 'sleep', args: { range: 32 }, reason: 'fallback sleep command' }
    }
    if (hasAnyWord(words, ['kullan', 'use', 'tikla', 'tıkla'])) {
      return { tool: 'use_item', args: {}, reason: 'fallback use command' }
    }
    if (hasAnyWord(words, ['saldir', 'saldır', 'vur', 'oldur', 'öldür', 'attack', 'fight'])) {
      return {
        tool: 'attack_entity',
        args: { name: after('saldir', 'saldır', 'vur', 'oldur', 'öldür', 'attack', 'fight') },
        reason: 'fallback attack command'
      }
    }
    if (hasAnyWord(words, ['koy', 'place', 'yerlestir', 'yerleştir'])) {
      return {
        tool: 'place_block',
        args: { item: after('koy', 'place', 'yerlestir', 'yerleştir'), where: ['front'] },
        reason: 'fallback place command'
      }
    }
    if (hasAnyWord(words, ['craft', 'yap', 'uret', 'üret'])) {
      return {
        tool: 'craft_item',
        args: { item: after('craft', 'yap', 'uret', 'üret'), count: count || 1 },
        reason: 'fallback craft command'
      }
    }
    if (hasAnyWord(words, ['giy', 'tak', 'equip', 'kusan', 'kuşan'])) {
      return {
        tool: 'equip_item',
        args: { item: after('giy', 'tak', 'equip', 'kusan', 'kuşan') },
        reason: 'fallback equip command'
      }
    }
    if (hasAnyWord(words, ['erit', 'pisir', 'pişir', 'smelt', 'cook'])) {
      return {
        tool: 'smelt_item',
        args: { item: after('erit', 'pisir', 'pişir', 'smelt', 'cook') || 'ore' },
        reason: 'fallback smelt command'
      }
    }
    if (hasAnyWord(words, ['ver', 'give', 'at', 'birak', 'bırak'])) {
      return {
        tool: 'give_items',
        args: { player: username, item: extractGiveTarget(words) },
        reason: 'fallback give command'
      }
    }
    if (hasAnyWord(words, ['bak', 'look'])) {
      const target =
        text.includes('bana bak') || text.includes('look at me')
          ? username
          : after('bak', 'look') || 'nearest'
      return { tool: 'look_at', args: { target }, reason: 'fallback look command' }
    }
    if (hasAnyWord(words, ['kir', 'kır', 'kaz', 'dig', 'mine', 'break', 'topla', 'ara', 'bul'])) {
      return {
        tool: 'mine_block',
        args: {
          target:
            after('kir', 'kır', 'kaz', 'dig', 'mine', 'break', 'topla', 'ara', 'bul') || words[0],
          count: count || 1,
          range: 64
        },
        reason: 'fallback mine/search command'
      }
    }
    return undefined
  }

  function inferImmediateFallbackAction(username, message) {
    const action = inferFallbackAction(username, message)
    const tool = String(action?.tool || '').toLowerCase()
    return ['come_to_player', 'follow_player', 'look_at', 'stop', 'status', 'inventory'].includes(tool)
      ? action
      : undefined
  }

  function hasAnyWord(words, candidates) {
    return candidates.some((candidate) => words.includes(candidate))
  }

  function firstWordAfterAny(words, candidates) {
    for (const candidate of candidates) {
      const index = words.indexOf(candidate)
      if (index >= 0 && words[index + 1] && !Number.isFinite(Number(words[index + 1]))) {
        return words[index + 1]
      }
    }
    return undefined
  }

  function extractGiveTarget(words) {
    const giveVerbs = ['ver', 'give', 'at', 'birak', 'bırak']
    const allWords = [
      'all',
      'everything',
      'hepsi',
      'hepsini',
      'tum',
      'tumu',
      'tüm',
      'tümü',
      'hersey',
      'herseyi',
      'herşey',
      'herşeyi'
    ]
    if (hasAnyWord(words, allWords)) return 'all'

    const ignored = new Set([
      ...giveVerbs,
      'bana',
      'me',
      'to',
      'ben',
      'sen',
      'lutfen',
      'lütfen',
      'please'
    ])

    for (const verb of giveVerbs) {
      const index = words.indexOf(verb)
      if (index < 0) continue

      for (let cursor = index + 1; cursor < words.length; cursor++) {
        const word = words[cursor]
        if (!word || ignored.has(word) || Number.isFinite(Number(word))) continue
        return word
      }

      for (let cursor = index - 1; cursor >= 0; cursor--) {
        const word = words[cursor]
        if (!word || ignored.has(word) || Number.isFinite(Number(word))) continue
        return word
      }
    }

    return undefined
  }

  function extractCommandCoordinates(words) {
    const numbers = words.map(Number).filter((value) => Number.isFinite(value))
    if (numbers.length >= 3) return { x: numbers[0], y: numbers[1], z: numbers[2] }
    if (numbers.length === 2 && bot.entity?.position) {
      return { x: numbers[0], y: Math.floor(bot.entity.position.y), z: numbers[1] }
    }
    return undefined
  }

  function getInventorySnapshot() {
    const wood = getWoodProgress()
    return `wood ${wood.logs} logs/${wood.planks} planks, sticks ${getStickCount()}, stone ${getStoneProgress()}, coal ${inventoryCount('coal')}, iron ${getIronProgress()}, gold ${getGoldProgress()}, copper ${getCopperProgress()}, diamond ${getDiamondProgress()}, obsidian ${getObsidianProgress()}`
  }

  async function tossInventoryToPlayer(playerName, target) {
    const resolvedName = resolvePlayerName(playerName)
    const entity = findPlayerEntity(resolvedName)
    if (!entity) {
      sendEvent(bot._client.username, 'chat', `Pathfinder: player not found ${playerName || ''}`)
      return { ok: false, reason: 'player_not_found' }
    }

    const normalizedTarget = normalizeBlockName(target)
    const giveAll = isGiveAllTarget(normalizedTarget)
    if (!normalizedTarget) {
      sendEvent(bot._client.username, 'chat', 'Pathfinder: item name required, say "hepsini" to give all')
      return { ok: false, reason: 'item_target_required' }
    }

    await mobility.reach(entity.position, { near: 2, timeoutMs: 22000 })

    const matchingItems = bot.inventory
      .items()
      .filter((item) => (giveAll ? true : itemMatchesTarget(item.name, normalizedTarget)))
      .sort((a, b) => itemTargetPriority(a.name, normalizedTarget) - itemTargetPriority(b.name, normalizedTarget))
    const items = giveAll ? matchingItems : matchingItems.slice(0, 1)

    if (items.length === 0) {
      sendEvent(bot._client.username, 'chat', `Pathfinder: no matching items to give`)
      return { ok: false, reason: `item_not_found:${normalizedTarget}` }
    }

    for (const item of items) {
      await bot.tossStack(item).catch((error) => {
        sendEvent(bot._client.username, 'chat', `Pathfinder give error: ${error.message}`)
      })
      await delay(150)
    }
    sendEvent(
      bot._client.username,
      'chat',
      `Pathfinder: gave ${giveAll ? 'all items' : items[0].name} to ${resolvedName}`
    )
    return { ok: true, item: giveAll ? 'all' : items[0].name, count: items.length }
  }

  function normalizeCommandText(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[.,;:!?]/g, ' ')
      .replace(/\s+/g, ' ')
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function getPrimaryBotName() {
    return bot._client?.username || bot.username || options.username || 'bot'
  }

  function getAiMentionNames() {
    const names = [
      bot.username,
      bot._client?.username,
      options.username,
      getPrimaryBotName(),
      aiCore?.botName
    ]
      .map((name) => normalizeCommandText(name))
      .filter((name) => name && name.length >= 3)

    return Array.from(new Set(names))
  }

  function hasBotMention(text, mentionNames = getAiMentionNames()) {
    const normalized = ` ${normalizeCommandText(text)} `
    return mentionNames.some((name) => {
      const pattern = new RegExp(`\\s@?${escapeRegExp(name)}(?=\\s)`, 'i')
      return pattern.test(normalized)
    })
  }

  function stripBotMentions(text) {
    return getAiMentionNames()
      .sort((a, b) => b.length - a.length)
      .reduce(
        (value, name) =>
          value.replace(new RegExp(`(^|\\s)@?${escapeRegExp(name)}(?=\\s|$)`, 'g'), ' '),
        normalizeCommandText(text)
      )
      .replace(/^(ai|bot)\s+/, '')
      .trim()
  }

  function parseMessageStringForAi(rawMessage) {
    const message = readChatText(rawMessage).trim()
    if (!message) return undefined

    const parsed = message.match(/^(?:<([^>]+)>|\[([^\]]+)\]|([^:：»>]+))\s*(?:[:：»>])\s*(.+)$/)
    if (!parsed) return { username: 'Server', message }

    return {
      username: (parsed[1] || parsed[2] || parsed[3] || 'Server').trim(),
      message: (parsed[4] || message).trim()
    }
  }

  function handleAiMessageString(rawMessage) {
    const parsed = parseMessageStringForAi(rawMessage)
    if (!parsed) return
    if (!configBoolean('aiMode') || !hasBotMention(parsed.message)) return
    handleAiChat(parsed.username, parsed.message)
  }

  function parseAiCollectCommand(words) {
    const actionIndex = words.findIndex((word) =>
      ['bul', 'find', 'mine', 'kaz', 'topla', 'collect', 'getir', 'bring', 'ara'].includes(word)
    )
    if (actionIndex < 0) return

    const targetIndex = actionIndex === 0 ? 1 : actionIndex - 1
    const target = words[targetIndex]
    if (!target || ['bot', 'ai', 'bana', 'me', 'to'].includes(target)) return

    const number = words.map(Number).find((value) => Number.isFinite(value))
    const wantsDelivery = words.some((word) =>
      ['getir', 'bring', 'bana', 'me', 'ver'].includes(word)
    )
    return {
      target,
      count: number || 1,
      range: 96,
      deliveryTarget: wantsDelivery ? 'sender' : undefined
    }
  }

  function setAiMode(enabled) {
    store.set('config.boolean.aiMode', enabled)
    if (aiRuntimeEnabled === enabled) {
      sendEvent(bot._client.username, 'chat', `AI mode: already ${enabled ? 'on' : 'off'}`)
      return
    }
    aiRuntimeEnabled = enabled
    if (enabled) {
      aiCore.startAutonomy()
      aiMemory.owner ||= resolvePlayerName()
      aiMemory.currentTask = 'idle'
      aiMemory.lastPlanAt = 0
      aiThinkBusy = false
    } else {
      aiCore.stopAutonomy('manual_toggle_off')
      aiMemory.currentTask = 'off'
      aiThinkBusy = false
      clearInterval(playerGotoTimer)
      playerGotoTimer = undefined
      pathfinderBusy = false
      bot.pathfinder?.setGoal?.(null)
      bot.pathfinder?.stop?.()
      bot.stopDigging?.()
      resetAiBody()
    }
    sendEvent(bot._client.username, 'chat', `AI mode: ${enabled ? 'on' : 'off'}`)
  }

  function isAiModeActive() {
    return configBoolean('aiMode')
  }

  function sendAiHelp() {
    sendEvent(
      bot._client.username,
      'chat',
      'AI help: ai gel, ai dur, ai durum, ai mobility, ai gemini, ai model gemini-2.5-flash, ai ileri 800, ai zıpla, ai koş, ai eğil, ai bak north, ai kır stone, ai koy cobblestone front, ai diamond bul 3, ai bana tas getir 32, ai ver, ai portal'
    )
  }

  function sendAiStatus() {
    const mode = configBoolean('aiMode') ? 'on' : 'off'
    const task = pathfinderBusy
      ? 'busy'
      : bot.pathfinder?.isMoving?.()
        ? 'moving'
        : aiMemory.currentTask
    sendEvent(
      bot._client.username,
      'chat',
      `AI status: ${mode}, Gemini-controlled, ${task}, owner ${aiMemory.owner || '-'}, hp ${Math.round(bot.health || 0)}, food ${bot.food ?? '-'}, position ${formatPosition(bot.entity.position)}`
    )
    sendEvent(bot._client.username, 'chat', `AI inventory: ${getInventorySnapshot()}`)
    const coreStatus = aiCore.status()
    sendEvent(
      bot._client.username,
      'chat',
      `AI core: events ${coreStatus.memory.events}, players ${coreStatus.memory.players}, resources ${coreStatus.memory.resources}, failures ${coreStatus.memory.failures}`
    )
    sendEvent(
      bot._client.username,
      'chat',
      `AI llm: ${coreStatus.llm.provider}/${coreStatus.llm.model}, available ${coreStatus.llm.available === false ? 'no' : 'unknown'}, sqlite ${coreStatus.sqlite.ready ? 'on' : 'fallback'}`
    )
    if (coreStatus.llm.performance?.queue) {
      const queue = coreStatus.llm.performance.queue
      sendEvent(
        bot._client.username,
        'chat',
        `AI queue: interval ${queue.minIntervalMs}ms, inflight ${queue.inflight}, recent ${queue.recent}`
      )
    }
    sendEvent(
      bot._client.username,
      'chat',
      `AI metrics: deaths ${coreStatus.metrics.deaths}, mined ${coreStatus.metrics.minedBlocks}, crafted ${coreStatus.metrics.craftedItems}, placed ${coreStatus.metrics.placedBlocks}, combat ${coreStatus.metrics.rates.combatEffectiveness}`
    )
    sendEvent(
      bot._client.username,
      'chat',
      `AI world: resources ${coreStatus.worldModel.resources}, hazards ${coreStatus.worldModel.hazards}, routes ${coreStatus.worldModel.routes}, players ${coreStatus.worldModel.players}`
    )
    if (coreStatus.debug) {
      sendEvent(
        bot._client.username,
        'chat',
        `AI debug: goal ${coreStatus.debug.currentGoal || '-'}, task ${coreStatus.debug.currentTask?.tool || coreStatus.debug.currentTask || '-'}, agent ${coreStatus.debug.currentAgent || '-'}, state ${coreStatus.debug.executionState}, queue ${coreStatus.debug.taskQueue?.length || 0}, error ${coreStatus.debug.lastError || '-'}`
      )
      sendEvent(
        bot._client.username,
        'chat',
        `Gemini last: ${JSON.stringify(coreStatus.debug.lastGeminiResponse || {}).slice(0, 220)}`
      )
    }
    if (coreStatus.mobility) {
      sendEvent(
        bot._client.username,
        'chat',
        `AI mobility: ${coreStatus.mobility.solutions.join('/')}, stuck ${coreStatus.mobility.stuckTicks}, front ${coreStatus.mobility.analysis.front}, hazard ${coreStatus.mobility.analysis.hazard || '-'}`
      )
    }
  }

  function sendAiPlan() {
    const goal = getSelectedAiGoal()
    sendLocalLlmPlan(goal).catch((error) => {
      sendEvent(bot._client.username, 'chat', `Gemini plan error: ${error.message}`)
    })
  }

  function sendPortalPlan() {
    const obsidian = inventoryCount('obsidian')
    const hasFlintAndSteel = bot.inventory.items().some((item) => item.name === 'flint_and_steel')
    sendEvent(
      bot._client.username,
      'chat',
      `AI portal plan: needs 10 obsidian and flint_and_steel. Current obsidian ${obsidian}/10, flint_and_steel ${hasFlintAndSteel ? 'yes' : 'no'}. Placement planner is not enabled yet.`
    )
  }

  async function sendLocalLlmPlan(goal = getSelectedAiGoal()) {
    sendEvent(bot._client.username, 'chat', `Gemini: asking for plan ${goal}`)
    const response = await aiCore.generateLocalPlan(goal)
    if (!response.ok) {
      sendEvent(
        bot._client.username,
        'chat',
        `Gemini unavailable: ${response.error || 'no response'}`
      )
      return
    }
    if (!response.validation?.ok) {
      sendEvent(
        bot._client.username,
        'chat',
        `Gemini plan rejected: ${response.validation?.reason || 'invalid tool plan'}`
      )
      return
    }
    const steps = response.json.steps
      .map((step) => `${step.tool}${step.reason ? `:${step.reason}` : ''}`)
      .join(' > ')
    sendEvent(bot._client.username, 'chat', `Gemini plan (${response.model}): ${steps}`)
  }

  function handleAiChat(username, message) {
    const normalizedSender = normalizeCommandText(username)
    if (!configBoolean('aiMode') || !aiSpawnReady || getAiMentionNames().includes(normalizedSender)) return
    aiMemory.owner = username
    const text = normalizeCommandText(message)
    const mentionNames = getAiMentionNames()
    if (mentionNames.length === 0 || !hasBotMention(text, mentionNames)) return
    const mentionedBotNames = Array.from(connectedBots)
      .map((name) => normalizeCommandText(name))
      .filter((name) => name && hasBotMention(text, [name]))
    if (
      mentionedBotNames.length > 0 &&
      !mentionedBotNames.some((name) => mentionNames.includes(name))
    )
      return

    const cleaned = stripBotMentions(text)
    const words = cleaned.split(' ').filter(Boolean)
    if (words.length === 0) {
      askGeminiFromChat(
        username,
        'The player only mentioned your bot name. This is a ping, not a movement or action command. Reply briefly that you are listening and ready. Do not move, pathfind, mine, attack, place, or use tools.',
        {
          allowActions: false,
          bypassDedupe: true,
          defaultReply: 'Buradayim, komutunu bekliyorum.'
        }
      ).catch((error) => {
        sendEvent(bot._client.username, 'chat', `Gemini error: ${error.message}`)
      })
      return
    }

    if (['dur', 'stop', 'iptal', 'cancel'].includes(words[0])) {
      stopPathfinderTask('Gemini: stopped by chat command')
      bot.stopDigging?.()
      resetAiBody()
      aiThinkBusy = false
      sendEvent(bot._client.username, 'chat', 'Gemini: stopped')
      return
    }

    if (['yardim', 'help', 'komut', 'commands'].includes(words[0])) {
      sendAiHelp()
      return
    }
    if (['durum', 'status'].includes(words[0])) {
      sendAiStatus()
      return
    }
    if (['hafiza', 'memory', 'core'].includes(words[0])) {
      const status = aiCore.status()
      sendEvent(bot._client.username, 'chat', `AI memory: ${JSON.stringify(status.memory)}`)
      return
    }
    if (['mobility', 'hareket'].includes(words[0])) {
      sendEvent(bot._client.username, 'chat', `AI mobility: ${JSON.stringify(mobility.status())}`)
      return
    }
    if (['llm', 'gemini'].includes(words[0])) {
      askGeminiFromChat(
        username,
        words.slice(1).join(' ') || 'Durumu incele ve uygun aksiyonu seç.'
      ).catch((error) => {
        sendEvent(bot._client.username, 'chat', `Gemini error: ${error.message}`)
      })
      return
    }
    if (['key', 'apikey', 'api-key'].includes(words[0])) {
      const apiKey = words.slice(1).join(' ').trim()
      if (!apiKey) {
        sendEvent(bot._client.username, 'chat', 'Gemini API key: missing')
        return
      }
      aiCore.setApiKey(apiKey)
      store.set('config.value.geminiApiKey', apiKey)
      sendEvent(bot._client.username, 'chat', 'Gemini API key: saved')
      return
    }
    if (['model', 'provider'].includes(words[0])) {
      const model =
        words[0] === 'provider'
          ? words[2] || words[1] || getConfiguredAiModel()
          : words[1] || getConfiguredAiModel()
      aiCore.setModel(model)
      store.set('config.value.aiProvider', 'gemini')
      store.set('config.value.aiModel', model)
      sendEvent(bot._client.username, 'chat', `Gemini model: ${aiCore.llm.model}`)
      return
    }
    if (['auto', 'otonom', 'brain', 'beyin'].includes(words[0])) {
      askGeminiFromChat(
        username,
        words.slice(1).join(' ') || 'Durumu incele ve uygun aksiyonu seç.'
      )
      return
    }
    if (['research', 'arastir', 'araştır'].includes(words[0])) {
      aiCore[words.length > 1 ? 'research' : 'autoResearch'](
        words.slice(1).join(' ') || 'nearby area may contain useful resources'
      )
        .then((response) => {
          sendEvent(
            bot._client.username,
            'chat',
            response.ok
              ? `AI research: ${response.json?.test || response.text.slice(0, 120)}`
              : `AI research unavailable: ${response.error}`
          )
        })
        .catch((error) =>
          sendEvent(bot._client.username, 'chat', `AI research error: ${error.message}`)
        )
      return
    }
    if (['plan', 'hedef', 'goal'].includes(words[0])) {
      askGeminiFromChat(
        username,
        words.slice(1).join(' ') || 'Durumu incele, hedef seç ve uygun aksiyonu uygula.'
      )
      return
    }
    askGeminiFromChat(username, cleaned).catch((error) => {
      sendEvent(bot._client.username, 'chat', `Gemini error: ${error.message}`)
    })
    return

    if (['portal', 'nether'].includes(words[0])) {
      sendPortalPlan()
      return
    }
    if (
      [
        'ileri',
        'geri',
        'sol',
        'sag',
        'sağ',
        'zipla',
        'zıpla',
        'kos',
        'koş',
        'egil',
        'eğil'
      ].includes(words[0])
    ) {
      pulseAiControl(words[0], words.map(Number).find((value) => Number.isFinite(value)) || 650, {
        sprint: words.includes('kos') || words.includes('koş')
      }).catch((error) => {
        sendEvent(bot._client.username, 'chat', `AI body error: ${error.message}`)
      })
      return
    }
    if (['yuru', 'yürü', 'walk', 'move'].includes(words[0])) {
      pulseAiControl(
        words[1] || 'forward',
        words.map(Number).find((value) => Number.isFinite(value)) || 800,
        {
          sprint: words.includes('kos') || words.includes('koş') || words.includes('sprint'),
          sneak: words.includes('egil') || words.includes('eğil') || words.includes('sneak')
        }
      ).catch((error) => {
        sendEvent(bot._client.username, 'chat', `AI body error: ${error.message}`)
      })
      return
    }
    if (['bak', 'look'].includes(words[0])) {
      const target = words[1]
      ;(async () => {
        const looked = (await aiLookAtTarget(target)) || (await aiLook(target))
        sendEvent(
          bot._client.username,
          'chat',
          looked ? `AI look: ${target}` : `AI look: target not found ${target || ''}`
        )
      })().catch((error) => {
        sendEvent(bot._client.username, 'chat', `AI look error: ${error.message}`)
      })
      return
    }
    if (['kir', 'kır', 'break', 'dig', 'kaz'].includes(words[0])) {
      breakBlockCommand(words.slice(1)).catch((error) => {
        sendEvent(bot._client.username, 'chat', `AI break error: ${error.message}`)
      })
      return
    }
    if (['koy', 'place', 'yerlestir', 'yerleştir'].includes(words[0])) {
      const itemName = words[1]
      const placeArgs = words.length > 2 ? words.slice(2) : ['front']
      placeBlockAutonomously(itemName, placeArgs).catch((error) => {
        sendEvent(bot._client.username, 'chat', `AI place error: ${error.message}`)
      })
      return
    }
    if (['kullan', 'use'].includes(words[0])) {
      mobility.rightClick()
      sendEvent(bot._client.username, 'chat', 'AI use: held item')
      return
    }
    if (['gel', 'come'].includes(words[0])) {
      goToMovingPlayer(username)
      return
    }
    if (
      words.includes('takip') ||
      words.includes('follow') ||
      (words.includes('beni') && words.includes('izle'))
    ) {
      const entity = findPlayerEntity(username)
      if (!entity) {
        sendEvent(bot._client.username, 'chat', `AI mode: player not visible ${username}`)
        return
      }
      const distance = words.map(Number).find((value) => Number.isFinite(value))
      bot.pathfinder.setGoal(new goals.GoalFollow(entity, clampNumber(distance, 1, 8, 2)), true)
      sendEvent(bot._client.username, 'chat', `AI mode: following ${username}`)
      return
    }
    if (['dur', 'stop', 'iptal', 'cancel'].includes(words[0])) {
      stopPathfinderTask('AI mode: stopped')
      return
    }
    if (['ver', 'give'].includes(words[0])) {
      tossInventoryToPlayer(username, extractGiveTarget(words))
      return
    }

    const collectCommand = parseAiCollectCommand(words)
    if (collectCommand) {
      mineNearestBlocks(
        collectCommand.target,
        collectCommand.count,
        collectCommand.range,
        collectCommand.deliveryTarget === 'sender' ? username : collectCommand.deliveryTarget
      )
      return
    }
  }

  function runPathfinderCommand(args) {
    if (!ensurePathfinder()) return
    const command = String(args[0] || '').toLowerCase()

    switch (command) {
      case 'ai':
        if (['key', 'apikey', 'api-key'].includes(String(args[1] || '').toLowerCase())) {
          const apiKey = args.slice(2).join(' ').trim()
          if (!apiKey) {
            sendEvent(bot._client.username, 'chat', 'Gemini API key: missing')
            return
          }
          aiCore.setApiKey(apiKey)
          store.set('config.value.geminiApiKey', apiKey)
          sendEvent(bot._client.username, 'chat', 'Gemini API key: saved')
          return
        }
        if (['model', 'provider'].includes(String(args[1] || '').toLowerCase())) {
          const subcommand = String(args[1] || '').toLowerCase()
          const model =
            subcommand === 'provider'
              ? args[3] || args[2] || getConfiguredAiModel()
              : args[2] || getConfiguredAiModel()
          aiCore.setModel(model)
          store.set('config.value.aiProvider', 'gemini')
          store.set('config.value.aiModel', model)
          sendEvent(bot._client.username, 'chat', `Gemini model: ${aiCore.llm.model}`)
          return
        }
        if (['on', 'open', 'ac', 'aç'].includes(String(args[1] || '').toLowerCase())) {
          setAiMode(true)
          sendAiHelp()
          return
        }
        if (['off', 'close', 'kapat'].includes(String(args[1] || '').toLowerCase())) {
          setAiMode(false)
          stopPathfinderTask('AI mode: off')
          return
        }
        if (
          ['help', 'yardim', 'yardım', 'commands'].includes(String(args[1] || '').toLowerCase())
        ) {
          sendAiHelp()
          return
        }
        if (['plan', 'hedef', 'goal'].includes(String(args[1] || '').toLowerCase())) {
          askGeminiFromChat(
            resolvePlayerName(),
            args.slice(2).join(' ') || 'Durumu incele, hedef seç ve uygun aksiyonu uygula.'
          )
          return
        }
        if (['portal', 'nether'].includes(String(args[1] || '').toLowerCase())) {
          sendPortalPlan()
          return
        }
        if (['memory', 'hafiza', 'core'].includes(String(args[1] || '').toLowerCase())) {
          const status = aiCore.status()
          sendEvent(bot._client.username, 'chat', `AI memory: ${JSON.stringify(status.memory)}`)
          return
        }
        if (['mobility', 'hareket'].includes(String(args[1] || '').toLowerCase())) {
          sendEvent(
            bot._client.username,
            'chat',
            `AI mobility: ${JSON.stringify(mobility.status())}`
          )
          return
        }
        if (['llm', 'gemini'].includes(String(args[1] || '').toLowerCase())) {
          askGeminiFromChat(
            resolvePlayerName(),
            args.slice(2).join(' ') || 'Durumu incele ve uygun aksiyonu seç.'
          ).catch((error) => {
            sendEvent(bot._client.username, 'chat', `Gemini error: ${error.message}`)
          })
          return
        }
        if (['brain', 'beyin', 'auto', 'otonom'].includes(String(args[1] || '').toLowerCase())) {
          askGeminiFromChat(
            resolvePlayerName(),
            args.slice(2).join(' ') || 'Durumu incele ve uygun aksiyonu seç.'
          )
          return
        }
        sendAiStatus()
        break
      case 'whereami':
      case 'pos':
      case 'p':
        sendEvent(
          bot._client.username,
          'chat',
          `Pathfinder: position ${formatPosition(bot.entity.position)}`
        )
        break
      case 'where':
      case 'w':
        describePlayerPosition(args[1])
        break
      case 'move':
      case 'yuru':
      case 'yürü':
      case 'walk':
        pulseAiControl(args[1] || 'forward', args[2] || 800, {
          sprint: args.includes('sprint') || args.includes('kos') || args.includes('koş'),
          sneak: args.includes('sneak') || args.includes('egil') || args.includes('eğil')
        }).catch((error) => {
          sendEvent(bot._client.username, 'chat', `AI body error: ${error.message}`)
        })
        break
      case 'jump':
      case 'zipla':
      case 'zıpla':
        pulseAiControl('jump', args[1] || 350).catch((error) => {
          sendEvent(bot._client.username, 'chat', `AI body error: ${error.message}`)
        })
        break
      case 'sprint':
      case 'kos':
      case 'koş':
        setAiControl('sprint', String(args[1] || 'on').toLowerCase() !== 'off')
        break
      case 'sneak':
      case 'egil':
      case 'eğil':
        setAiControl('sneak', String(args[1] || 'on').toLowerCase() !== 'off')
        break
      case 'look':
      case 'bak':
        ;(async () => {
          const looked = (await aiLookAtTarget(args[1])) || (await aiLook(args[1], args[2]))
          sendEvent(
            bot._client.username,
            'chat',
            looked ? `AI look: ${args[1]}` : `AI look: target not found ${args[1] || ''}`
          )
        })().catch((error) => {
          sendEvent(bot._client.username, 'chat', `AI look error: ${error.message}`)
        })
        break
      case 'break':
      case 'dig':
      case 'kir':
      case 'kır':
      case 'kaz':
        breakBlockCommand(args.slice(1)).catch((error) => {
          sendEvent(bot._client.username, 'chat', `AI break error: ${error.message}`)
        })
        break
      case 'place':
      case 'koy':
      case 'yerlestir':
      case 'yerleştir':
        placeBlockAutonomously(args[1], args.length > 2 ? args.slice(2) : ['front']).catch(
          (error) => {
            sendEvent(bot._client.username, 'chat', `AI place error: ${error.message}`)
          }
        )
        break
      case 'use':
      case 'kullan':
        mobility.rightClick()
        sendEvent(bot._client.username, 'chat', 'AI use: held item')
        break
      case 'mobility':
      case 'hareket':
        sendEvent(bot._client.username, 'chat', `AI mobility: ${JSON.stringify(mobility.status())}`)
        break
      case 'llm':
      case 'gemini':
        askGeminiFromChat(
          resolvePlayerName(),
          args.slice(1).join(' ') || 'Durumu incele ve uygun aksiyonu seç.'
        ).catch((error) => {
          sendEvent(bot._client.username, 'chat', `Gemini error: ${error.message}`)
        })
        break
      case 'research':
      case 'arastir':
      case 'araştır':
        aiCore[args.length > 1 ? 'research' : 'autoResearch'](
          args.slice(1).join(' ') || 'nearby area may contain useful resources'
        )
          .then((response) => {
            sendEvent(
              bot._client.username,
              'chat',
              response.ok
                ? `AI research: ${response.json?.test || response.text.slice(0, 120)}`
                : `AI research unavailable: ${response.error}`
            )
          })
          .catch((error) =>
            sendEvent(bot._client.username, 'chat', `AI research error: ${error.message}`)
          )
        break
      case 'goto':
      case 'go':
      case 'g': {
        if (String(args[1] || '').toLowerCase() === 'player') {
          goToMovingPlayer(args[2], args[3])
          return
        }
        if (args[1] && !Number.isFinite(Number(args[1]))) {
          goToMovingPlayer(args[1], args[2])
          return
        }
        const position = parsePositionArgs(
          args.slice(1),
          bot.entity.position,
          bot.entity.position.y
        )
        if (!position) {
          sendEvent(bot._client.username, 'chat', 'Pathfinder goto needs: goto x y z or goto x z')
          return
        }
        mobility
          .reach(position, { near: 1, timeoutMs: 30000 })
          .then((reached) => {
            sendEvent(
              bot._client.username,
              'chat',
              reached
                ? `Mobility: reached ${formatPosition(position)}`
                : `Mobility: could not finish ${formatPosition(position)}`
            )
          })
          .catch((error) => {
            sendEvent(bot._client.username, 'chat', `Mobility goto error: ${error.message}`)
          })
        sendEvent(bot._client.username, 'chat', `Mobility: goto ${formatPosition(position)}`)
        break
      }
      case 'follow':
      case 'f': {
        const entity = findPlayerEntity(args[1])
        if (!entity) {
          sendEvent(bot._client.username, 'chat', `Pathfinder: player not found ${args[1] || ''}`)
          return
        }
        bot.pathfinder.setGoal(new goals.GoalFollow(entity, clampNumber(args[2], 1, 8, 2)), true)
        sendEvent(bot._client.username, 'chat', `Pathfinder: following ${args[1]}`)
        break
      }
      case 'followline':
      case 'line': {
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
      case 'nearest':
      case 'findblock':
      case 'find':
      case 'bul':
        goToNearestBlock(args[1], args[2])
        break
      case 'mine':
      case 'collect':
      case 'topla':
      case 'maden': {
        const { count, range } = resolveCountAndRange(args[2], args[3])
        const deliveryTarget =
          args.includes('to') || args.includes('give') || args.includes('getir')
            ? resolvePlayerName(args[args.length - 1])
            : undefined
        mineNearestBlocks(args[1], count, range, deliveryTarget)
        break
      }
      case 'give':
      case 'ver':
        tossInventoryToPlayer(args[1], args[2])
        break
      case 'stop':
      case 'dur':
      case 's':
        stopPathfinderTask()
        break
      default:
        sendEvent(
          bot._client.username,
          'chat',
          'Pathfinder: ai on/off/help, g <player|x y z>, f <player>, line <player>, find <block>, mine <block> <count>, give <player> [item], stop'
        )
        break
    }
  }

  function handleBotEvent(target, event, ...eventOptions) {
    if (target !== bot._client.username) return
    const optionsArray = eventOptions[0]
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
        options._manualDisconnect = true
        bot._manualDisconnect = true
        bot.pathfinder?.stop()
        bot.clearControlStates()
        bot.quit()
        break
      case 'chat':
        const bypass = configBoolean('bypassChat') ? ' ' + salt(crypto.randomInt(2, 6)) : ''
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
  }

  botApi.on('botEvent', handleBotEvent)
}

process.on('uncaughtException', (err) => {
  console.log(err)
})
process.on('UnhandledPromiseRejectionWarning', (err) => {
  console.log(err)
})
