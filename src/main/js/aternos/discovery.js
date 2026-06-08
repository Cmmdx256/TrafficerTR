/* global BigInt */
import '../misc/protocolCompatibility'
import { createRequire } from 'node:module'
import dns from 'node:dns/promises'
import fs from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(import.meta.url)
const getMinecraftProtocol = () => require('minecraft-protocol')

const VALID_ATERNOS_DOMAINS = ['aternos.me', 'aternos.host']
const MAX_CONCURRENCY = 40
const PROGRESS_INTERVAL_MS = 350
const ALLOWED_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-_'

const SUBDOMAIN_RULES = {
  valid: ALLOWED_CHARS.split(''),
  invalid: [
    'ç',
    'ğ',
    'ı',
    'ö',
    'ş',
    'ü',
    'İ',
    'Ğ',
    'Ü',
    'Ş',
    'Ö',
    'Ç',
    'é',
    '!',
    '@',
    '#',
    '$',
    '%',
    '^',
    '&',
    '*',
    '(',
    ')',
    '.',
    ',',
    '?'
  ],
  check: function (subdomain) {
    const len = subdomain.length
    if (len < 3 || len > 25) return false

    const firstChar = subdomain[0]
    const lastChar = subdomain[len - 1]
    if (!/[a-z0-9]/i.test(firstChar) || !/[a-z0-9]/i.test(lastChar)) return false

    for (const char of this.invalid) {
      if (subdomain.includes(char)) return false
    }

    if (
      subdomain.includes('--') ||
      subdomain.includes('__') ||
      subdomain.includes('-_') ||
      subdomain.includes('_-')
    ) {
      return false
    }

    return true
  }
}

class AutonomousAgent {
  constructor() {
    this.matrix = {}
    this.startTokens = {}
    this.lengthWeights = {}

    const chars = 'abcdefghijklmnopqrstuvwxyz'.split('')
    chars.forEach((c) => {
      this.startTokens[c] = 100
      this.matrix[c] = {}
      chars.forEach((next) => {
        this.matrix[c][next] = 100
      })
      for (let n = 0; n <= 9; n++) {
        this.matrix[c][n.toString()] = 20
      }
      this.matrix[c]['-'] = 15
      this.matrix[c]['_'] = 15
    })

    for (let i = 4; i <= 20; i++) {
      this.lengthWeights[i] = 100
    }

    this.metrics = {
      concurrency: 20,
      timeout: 3000,
      consecutiveFailures: 0,
      stagnationCounter: 0,
      totalSuccess: 0
    }

    this.primeInitialKnowledge()
  }

  primeInitialKnowledge() {
    const commonPatterns = [
      'craft',
      'mine',
      'turk',
      'oyun',
      'server',
      'sunucu',
      'play',
      'world',
      'dunya',
      'ekip',
      'kral',
      'army',
      'team',
      'pro',
      'hub',
      'nw',
      'network',
      'pvp',
      'tr',
      'gg',
      'smp',
      'zone'
    ]
    commonPatterns.forEach((pattern) => {
      if (pattern.length > 0) {
        this.startTokens[pattern[0]] = (this.startTokens[pattern[0]] || 100) + 50
        for (let i = 0; i < pattern.length - 1; i++) {
          const current = pattern[i]
          const next = pattern[i + 1]
          if (this.matrix[current] && this.matrix[current][next] !== undefined) {
            this.matrix[current][next] += 80
          }
        }
      }
    })
  }

  loadMemory(savedState) {
    if (!savedState) return
    if (savedState.matrix) this.matrix = savedState.matrix
    if (savedState.startTokens) this.startTokens = savedState.startTokens
    if (savedState.lengthWeights) this.lengthWeights = savedState.lengthWeights
    if (savedState.metrics?.concurrency) this.metrics.concurrency = savedState.metrics.concurrency
  }

  exportMemory() {
    return {
      matrix: this.matrix,
      startTokens: this.startTokens,
      lengthWeights: this.lengthWeights,
      metrics: { concurrency: this.metrics.concurrency, timeout: this.metrics.timeout }
    }
  }

  weightedSelect(weightMap) {
    const items = Object.keys(weightMap)
    const totalWeight = items.reduce((sum, item) => sum + weightMap[item], 0)
    let random = Math.random() * totalWeight
    for (const item of items) {
      random -= weightMap[item]
      if (random <= 0) return item
    }
    return items[Math.floor(Math.random() * items.length)]
  }

  reinforce(subdomain, isSuccess) {
    const reward = isSuccess ? 40 : -1
    const len = subdomain.length

    if (this.lengthWeights[len]) {
      this.lengthWeights[len] = Math.max(
        10,
        Math.min(1000, this.lengthWeights[len] + (isSuccess ? 30 : -1))
      )
    }

    if (subdomain.length > 0) {
      const firstChar = subdomain[0]
      if (this.startTokens[firstChar]) {
        this.startTokens[firstChar] = Math.max(
          10,
          Math.min(1000, this.startTokens[firstChar] + reward)
        )
      }

      for (let i = 0; i < subdomain.length - 1; i++) {
        const current = subdomain[i]
        const next = subdomain[i + 1]
        if (this.matrix[current] && this.matrix[current][next] !== undefined) {
          this.matrix[current][next] = Math.max(
            5,
            Math.min(1000, this.matrix[current][next] + reward)
          )
        }
      }
    }

    if (isSuccess) {
      this.metrics.totalSuccess++
      this.metrics.consecutiveFailures = 0
      this.metrics.stagnationCounter = 0
    } else {
      this.metrics.consecutiveFailures++
      this.metrics.stagnationCounter++
    }

    if (this.metrics.consecutiveFailures > 30) {
      this.metrics.concurrency = Math.max(10, this.metrics.concurrency - 1)
      this.metrics.timeout = Math.min(5000, this.metrics.timeout + 150)
      this.metrics.consecutiveFailures = 0
    } else if (isSuccess && this.metrics.concurrency < MAX_CONCURRENCY) {
      this.metrics.concurrency++
      this.metrics.timeout = Math.max(2000, this.metrics.timeout - 50)
    }
  }

  generateMarkovString(targetLen, salt) {
    let current = this.weightedSelect(this.startTokens)
    let result = current
    let tempSalt = salt

    while (result.length < targetLen) {
      const row = this.matrix[current]
      if (!row) break

      let next = this.weightedSelect(row)

      if (tempSalt > 0n && Math.random() > 0.7) {
        const rowKeys = Object.keys(row)
        next = rowKeys[Number(tempSalt % BigInt(rowKeys.length))]
        tempSalt /= BigInt(rowKeys.length)
      }

      result += next
      current = next
    }
    return result.substring(0, targetLen)
  }

  generateSubdomain(entropyIndex) {
    const isExplorationMode = this.metrics.stagnationCounter > 500

    let salt = BigInt(entropyIndex) * 2862933555777941757n + 3037000493n
    if (salt < 0n) salt = -salt

    let targetLength = Number(this.weightedSelect(this.lengthWeights))
    if (isExplorationMode) {
      targetLength = Math.floor(Math.random() * 15) + 5
    }

    let word = this.generateMarkovString(targetLength, salt)

    word = word.toLowerCase().replace(/[^a-z0-9-_]/g, '')

    if (SUBDOMAIN_RULES.check(word)) {
      return word
    }

    let forcedWord = 'mc' + (salt % 10000n)
    while (!SUBDOMAIN_RULES.check(forcedWord)) {
      forcedWord = 'node' + Math.floor(Math.random() * 10000)
    }
    return forcedWord
  }
}

const agent = new AutonomousAgent()

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(number, min), max)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function generateRealisticPermutations(count, startOffset = 0) {
  const targets = []
  const seen = new Set()
  let offset = BigInt(startOffset < 0 ? 0 : startOffset)

  while (targets.length < count) {
    const subdomainIndex = offset / BigInt(VALID_ATERNOS_DOMAINS.length)
    const domainIndex = Number(offset % BigInt(VALID_ATERNOS_DOMAINS.length))

    const subdomain = agent.generateSubdomain(Number(subdomainIndex))
    const domain = VALID_ATERNOS_DOMAINS[domainIndex]
    const host = `${subdomain}.${domain}`

    offset += 1n

    if (!SUBDOMAIN_RULES.check(subdomain) || seen.has(host)) continue

    seen.add(host)
    targets.push({ host, port: 25565, originSubdomain: subdomain })
  }

  return { targets, nextOffset: offset.toString() }
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

async function resolveDns(host) {
  try {
    const records = await dns.resolve4(host)
    return records.length > 0 ? records[0] : null
  } catch {
    return null
  }
}

function pingMinecraftServer(host, port, timeout) {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback(value)
    }
    const timer = setTimeout(() => {
      done(reject, new Error('timeout'))
    }, timeout)

    getMinecraftProtocol().ping({ host, port, closeTimeout: timeout }, (error, result) => {
      if (error) {
        done(reject, error)
        return
      }
      done(resolve, result)
    })
  })
}

function formatPingError(error) {
  const message = String(error?.message || error?.code || 'unreachable')
  if (/ENOTFOUND|EAI_AGAIN|ENODATA|querySrv|queryA|DNS/i.test(message)) {
    return 'offline or unreachable'
  }
  if (/timeout/i.test(message)) return 'timeout'
  return message
}

export async function runAternosDiscovery(options = {}) {
  const outputPath =
    options.outputPath || path.resolve(process.cwd(), 'discovered_aternos_results.json')
  const statePath =
    options.statePath || path.resolve(path.dirname(outputPath), 'aternos_discovery_state.json')

  const state = await readJsonFile(statePath, { nextOffset: '0', agentMemory: null })

  if (state.agentMemory) {
    agent.loadMemory(state.agentMemory)
  }

  const targetCount = clampNumber(options.targetCount, 10, 100000, 5000)
  const generated = generateRealisticPermutations(targetCount, state.nextOffset)
  const servers = generated.targets
  const total = servers.length

  const logFailures = options.logFailures === true
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {}
  const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false

  const stats = { total, queued: total, active: 0, checked: 0, success: 0, fail: 0 }
  const existingData = await readJsonFile(outputPath, [])
  const discoveredData = Array.isArray(existingData) ? existingData : []
  const discoveredHosts = new Set(
    discoveredData.map((item) => `${item.host}:${item.port || 25565}`.toLowerCase())
  )
  let lastProgressAt = 0
  let nextIndex = 0

  const publish = (server, event, message, count = { ...stats }) => {
    onEvent(server, event, message, count)
  }

  const publishProgress = (message = 'Aternos Otonom Ajan Çalışıyor.', force = false) => {
    const now = Date.now()
    if (!force && now - lastProgressAt < PROGRESS_INTERVAL_MS) return
    lastProgressAt = now
    publish('Aternos', 'progress', message, {
      ...stats,
      concurrency: agent.metrics.concurrency,
      timeout: agent.metrics.timeout,
      nextOffset: generated.nextOffset,
      progress: `${stats.checked}/${total}`
    })
  }

  publish('Aternos', 'start', `Otonom tarama başlatıldı. Hedef: ${total}.`, {
    ...stats,
    concurrency: agent.metrics.concurrency,
    timeout: agent.metrics.timeout,
    nextOffset: generated.nextOffset,
    progress: `0/${total}`
  })

  async function worker() {
    while (!shouldStop()) {
      const index = nextIndex
      nextIndex += 1
      if (index >= total) return

      const server = servers[index]
      const address = `${server.host}:${server.port}`

      stats.queued = Math.max(total - nextIndex, 0)
      stats.active += 1
      publishProgress(`Kontrol ediliyor: ${address}`)

      try {
        const result = await pingMinecraftServer(server.host, server.port, agent.metrics.timeout)
        if (shouldStop()) return

        const versionStr = String(result?.version?.name || '').toLowerCase()
        const motdStr = String(
          result?.description?.text || JSON.stringify(result?.description) || ''
        ).toLowerCase()
        const isOfflineProxy =
          versionStr.includes('offline') ||
          motdStr.includes('offline') ||
          motdStr.includes('sunucu kapalı') ||
          result?.players?.max === 0

        if (isOfflineProxy) {
          throw new Error('Aternos Proxy: Server is offline')
        }

        agent.reinforce(server.originSubdomain, true)

        const ip = (await resolveDns(server.host)) || 'unknown'
        if (shouldStop()) return
        const players = result?.players
          ? `${result.players.online ?? '?'}/${result.players.max ?? '?'}`
          : 'unknown'
        const version = result?.version?.name || result?.version?.protocol || 'unknown'

        stats.success += 1
        const serverKey = address.toLowerCase()
        if (!discoveredHosts.has(serverKey)) {
          discoveredHosts.add(serverKey)
          discoveredData.push({
            host: server.host,
            ip,
            port: server.port,
            players,
            version,
            timestamp: new Date().toISOString()
          })
          publish(address, 'success', `Aktif Sunucu! Oyuncu: ${players}, Versiyon: ${version}`, {
            ...stats,
            progress: `${stats.checked + 1}/${total}`
          })
        }
      } catch (error) {
        if (shouldStop()) return
        stats.fail += 1

        agent.reinforce(server.originSubdomain, false)

        if (logFailures) {
          publish(address, 'fail', formatPingError(error), {
            ...stats,
            progress: `${stats.checked + 1}/${total}`
          })
        }
      } finally {
        stats.active -= 1
        stats.checked += 1
        if (!shouldStop()) publishProgress()
        await delay(35)
      }
    }
  }

  const initialConcurrency = Math.min(agent.metrics.concurrency, total)
  await Promise.all(Array.from({ length: initialConcurrency }, () => worker()))

  try {
    await writeJsonFile(outputPath, discoveredData)
    await writeJsonFile(statePath, {
      nextOffset: generated.nextOffset,
      updatedAt: new Date().toISOString(),
      agentMemory: agent.exportMemory()
    })
  } catch (error) {
    publish('Aternos', 'fail', error?.message || 'Sonuçlar kaydedilemedi.', {
      ...stats,
      progress: `${stats.checked}/${total}`
    })
  }

  publish('Aternos', 'stop', shouldStop() ? 'Tarama durduruldu.' : 'Tarama tamamlandı.', {
    ...stats,
    queued: 0,
    active: 0,
    progress: `${stats.checked}/${total}`
  })
  return stats
}

export async function runAternosServerCheck(servers, options = {}) {
  return runAternosDiscovery({ ...options, targetCount: servers.length })
}
