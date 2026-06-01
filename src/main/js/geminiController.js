import { createGeminiProvider } from './geminiProvider'

function now() {
  return Date.now()
}

function safeJson(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return '{}'
  }
}

export class GeminiMinecraftController {
  constructor({ botName, model, apiKey, sendEvent, store } = {}) {
    this.botName = botName
    this.store = store
    this.sendEvent = sendEvent
    this.llm = createGeminiProvider({
      model: model || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
      apiKey: apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      timeoutMs: 25000,
      retries: 1
    })
    this.debug = {
      currentGoal: 'chat_controlled',
      currentPlan: undefined,
      currentTask: undefined,
      lastGeminiResponse: undefined,
      lastError: undefined,
      currentAgent: 'Gemini',
      executionState: 'IDLE',
      taskQueue: []
    }
    this.metrics = {
      requests: 0,
      actions: 0,
      failures: 0,
      startedAt: now()
    }
    this.memory = {
      state: {
        episodic: [],
        failures: [],
        successes: [],
        players: {},
        resources: {},
        locations: {},
        reflections: []
      },
      rememberEvent: (event) => this.rememberEvent(event),
      rememberPlayer: (name, patch) => {
        if (!name) return
        this.memory.state.players[name] = {
          ...this.memory.state.players[name],
          ...patch,
          lastSeenAt: now()
        }
      },
      rememberFailure: (reason, context = {}) => {
        this.memory.state.failures.push({ reason, context, at: now() })
      },
      rememberSuccess: (reason, context = {}) => {
        this.memory.state.successes.push({ reason, context, at: now() })
      },
      setWorking: (key, value) => {
        this.memory.state[key] = value
      },
      summary: () => ({
        events: this.memory.state.episodic.length,
        players: Object.keys(this.memory.state.players).length,
        resources: Object.keys(this.memory.state.resources).length,
        locations: Object.keys(this.memory.state.locations).length,
        failures: this.memory.state.failures.length,
        successes: this.memory.state.successes.length
      })
    }
    this.active = false
  }

  startAutonomy() {
    this.active = true
    this.debug.executionState = 'LISTENING'
    return true
  }

  setMobility(mobility) {
    this.mobility = mobility
  }

  stopAutonomy(reason = 'manual_stop') {
    this.active = false
    this.debug.executionState = 'IDLE'
    this.debug.lastError = reason
  }

  emit(type, payload = {}) {
    this.rememberEvent({ type, payload, at: now() })
  }

  rememberEvent(event) {
    this.memory.state.episodic.push(event)
    if (this.memory.state.episodic.length > 300) this.memory.state.episodic.shift()
  }

  rememberDiscovery(kind, key, value) {
    if (kind === 'resource') this.memory.state.resources[key] = { ...value, lastSeenAt: now() }
    if (kind === 'location') this.memory.state.locations[key] = { ...value, lastSeenAt: now() }
  }

  recordMetric(event, value = 1) {
    this.metrics[event] = (this.metrics[event] || 0) + value
  }

  reflect(reason, context = {}) {
    this.memory.state.reflections.push({ reason, context, at: now() })
  }

  async reflectWithLLM(reason, context = {}) {
    return this.llm.reflect({ reason, context }, {}, this.memory.summary()).catch((error) => {
      this.debug.lastError = error.message
      return { ok: false, error: error.message }
    })
  }

  setModel(model) {
    const selected = String(model || '').trim()
    if (!selected) return false
    this.llm.model = selected
    return true
  }

  setProvider(provider, model, options = {}) {
    if (String(provider || '').toLowerCase() !== 'gemini') return false
    this.llm = createGeminiProvider({
      model: model || this.llm.model,
      apiKey: options.geminiApiKey || this.llm.apiKey
    })
    return true
  }

  setApiKey(apiKey) {
    if (!apiKey) return false
    this.llm.apiKey = String(apiKey).trim()
    return true
  }

  async generateLocalPlan(goal) {
    return this.llm.generatePlan({ mode: 'chat_controlled' }, goal, this.toolNames())
  }

  async research(hypothesis) {
    return this.llm.research(hypothesis, {}, this.memory.summary())
  }

  async autoResearch() {
    return this.research('Current Minecraft situation may need a useful next action.')
  }

  toolNames() {
    return [
      'say',
      'move_to',
      'follow_player',
      'stop',
      'mine_block',
      'place_block',
      'craft_item',
      'equip_item',
      'eat_food',
      'attack_entity',
      'look_at',
      'use_item',
      'give_items',
      'status',
      'inventory',
      'explore',
      'smelt_item',
      'sleep'
    ]
  }

  async decideFromChat({ username, message, observation }) {
    this.metrics.requests++
    this.debug.executionState = 'THINKING'
    const prompt = {
      task: 'minecraft_chat_control',
      speaker: username,
      message,
      observation,
      availableTools: this.toolNames(),
      rules: [
        'You are controlling a Mineflayer Minecraft bot through tools.',
        'Return JSON only.',
        'Do not output markdown.',
        'If the player gives a command, choose actions to execute it.',
        'If you need to answer, use the say tool.',
        'Use short action lists. Prefer one to three actions.',
        'Never request shell, filesystem, network, or arbitrary JavaScript execution.'
      ],
      responseShape: {
        reply: 'short optional chat reply',
        actions: [{ tool: 'tool_name', args: {}, reason: 'short reason' }]
      }
    }
    const response = await this.llm.complete(safeJson(prompt), { format: 'json' })
    this.debug.lastGeminiResponse = response.raw || response.text
    this.debug.executionState = response.ok ? 'ACTING' : 'FAILED'
    if (!response.ok) {
      this.debug.lastError = response.error
      this.memory.rememberFailure('gemini_chat', { error: response.error, username, message })
      return { ok: false, error: response.error, actions: [] }
    }
    const actions = Array.isArray(response.json?.actions) ? response.json.actions : []
    return {
      ok: true,
      reply: response.json?.reply,
      actions,
      raw: response.json
    }
  }

  status() {
    return {
      memory: this.memory.summary(),
      sqlite: { ready: false, provider: 'disabled' },
      llm: {
        provider: 'gemini',
        model: this.llm.model,
        available: this.llm.available,
        performance: this.llm.performance?.()
      },
      debug: this.debug,
      strategy: {
        active: this.active,
        activeGoal: 'chat_controlled',
        queueLength: 0
      },
      metrics: {
        ...this.metrics,
        rates: {}
      },
      worldModel: {
        resources: Object.keys(this.memory.state.resources).length,
        hazards: 0,
        routes: 0,
        players: Object.keys(this.memory.state.players).length
      },
      mobility: undefined,
      tools: this.toolNames(),
      events: this.memory.state.episodic.slice(-5).map((event) => event.type),
      plugins: []
    }
  }
}

export function createGeminiMinecraftController(options) {
  return new GeminiMinecraftController(options)
}
