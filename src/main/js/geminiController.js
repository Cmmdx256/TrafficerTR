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
      model: model || process.env.GEMINI_MODEL || 'gemini-flash-latest',
      apiKey: apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      timeoutMs: 45000,
      retries: 2
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
        reflections: [],
        actions: []
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
        successes: this.memory.state.successes.length,
        actions: this.memory.state.actions.length
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

  setAgentRuntime(runtime) {
    this.agentRuntime = runtime
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
      'come_to_player',
      'follow_player',
      'protect_player',
      'gather_wood',
      'explore_cave',
      'obtain_iron',
      'obtain_diamond',
      'build_house',
      'farm_crop',
      'trade_villager',
      'gather_resource',
      'stop',
      'craft_item',
      'equip_item',
      'eat_food',
      'use_item',
      'give_items',
      'make_crafting_table_for_player',
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
      availableIntents: this.toolNames(),
      rules: [
        'You are an intent planner for a Mineflayer Minecraft bot.',
        'Return JSON only.',
        'Do not output markdown.',
        'Return high-level intents, not raw movement, coordinates, camera control, or pathfinder commands.',
        'Never choose raw coordinates for ordinary commands like come, follow, protect, gather, explore, mine, or build. Let the Skill Engine and Mobility Engine select entities, coordinates, routes, obstacles, and retries.',
        'If the player gives a command, choose intents to execute it.',
        'If the command is actionable, use intents instead of only replying.',
        'If the message is casual talk, a question, a greeting, or acknowledgement without an explicit Minecraft action command, use only say and do not move, follow, explore, mine, place, attack, or use tools.',
        'For identity questions, never say the player has the bot name. Your bot name is observation.botName if provided. The speaker/player name is speaker. If asked "what is your name", answer with the bot name. If asked "what is my name", answer with the speaker name.',
        'Never move randomly. Only use movement-related intents when the player explicitly asks you to come, follow, go somewhere, walk, move, or explore.',
        'Never return an empty intent for a clear Minecraft command. If the request can be acted on, return one intent object.',
        'If the exact target is uncertain but the intent is clear, choose the closest safe tool and use semantic args from the message and observation.',
        'If you need to answer only, use intent "say".',
        'Prefer one primary intent. Use an intents array only when the player asked for a compound task.',
        'Override older mining wording: for Turkish "odun kir/agac kes" return gather_wood, for "tas kir" return gather_resource target stone, and for "ot kir/cimen kir" return gather_resource target grass.',
        'For mining intelligence requests like "maden kaz", "madenleri topla", "ore bul", return gather_resource with target "ore". For specific ores use target coal, copper, iron, gold, redstone, lapis, diamond, emerald, quartz, or ancient_debris.',
        'For Turkish commands: "odun kır", "ağaç kes", "agac kes" means mine_block with block "wood"; "taş kır" means mine_block with block "stone"; "keşfet", "kesfet", "explore" means explore.',
        'Use observation.local3dModel as your compact 3D world model. Interpret nearby trees, dirt, ores, stone, water, utility blocks, terrain, and structures from categories and coordinates.',
        'Do not treat natural-language object words as only exact Minecraft block IDs. For example, tree means nearby trunk plus leaves in local3dModel.',
        'For semantic requests like wood, tree, ore, mine, stone, dirt, ground, farm, water, or cave, infer the target from local3dModel.categoryCounts, nearestByCategory, likelyTrees, visibleOres, and block coordinates.',
        'When a nearby category target exists, choose a tool action for that target instead of saying you cannot find the exact block name.',
        'Do not invent random move_to coordinates. Prefer come_to_player, follow_player, protect_player, gather_resource, gather_wood, explore_cave, craft_item, or make_crafting_table_for_player.',
        'Intent-only override: do not output move_to, mine_block, place_block, attack_entity, look_at, x/y/z, yaw, pitch, or pathfinder goals. Output semantic intents such as come_to_player, follow_player, protect_player, gather_wood, gather_resource, explore_cave, craft_item, eat_food, sleep, smelt_item, or say.',
        'For wood/tree/ore/stone/dirt/ground/cave requests, output gather_wood, gather_resource, or explore_cave with semantic target names, never coordinates.',
        'For resource commands, prefer gather_resource, gather_wood, craft_item, eat_food, protect_player, or explore over raw movement.',
        'This semantic interpretation applies to every Minecraft request, not only wood or stone. The player may refer to any block, item, mob, player, terrain feature, structure, resource, fluid, tool, food, or action in Turkish or English.',
        'For any requested object, first infer the intended target from local3dModel, nearbyEntities, inventory, exact block names, categories, and coordinates.',
        'For mining/digging requests, use gather_resource or gather_wood with semantic target names. Do not return coordinates.',
        'For Turkish come/follow commands like "gel", "yanima gel", "beni takip et", "takip et", "arkamdan gel", "beni izle", use come_to_player or follow_player with args {player: speaker, near: 2}.',
        'For English come/follow commands like "come", "come to me", "follow me", use come_to_player or follow_player with args {player: speaker, near: 2}.',
        'For protect commands like "beni koru", "protect me", use protect_player with args {player: speaker}.',
        'For give/drop commands, use give_items with args {player: speaker, item: requested item}. If the player says "kilici ver", "kılıcı ver", "topragi ver", or "toprağı ver", item must be the specific requested item, not all.',
        'Only set item to "all" when the player explicitly says all, hepsi, hepsini, tum, tüm, everything, or an equivalent all-items phrase. Never omit item for give_items.',
        'For compound requests like collect wood, craft planks, craft a crafting table, and give it to the speaker, use make_crafting_table_for_player with args {logs: requested log count or 3, player: speaker}.',
        'For non-mining requests, select the matching intent: come_to_player, follow_player, protect_player, gather_resource, gather_wood, explore_cave, craft_item, equip_item, eat_food, use_item, explore, smelt_item, sleep, or say.',
        'Never request shell, filesystem, network, or arbitrary JavaScript execution.'
      ],
      responseShape: {
        reply: 'short optional chat reply',
        intent: 'intent_name',
        target: 'semantic target or speaker',
        parameters: {},
        reason: 'short visible reason, not hidden chain of thought'
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
    let actions = []
    if (Array.isArray(response.json?.intents)) {
      actions = response.json.intents.map((intent) => this.intentObjectToAction(intent, username))
    } else if (response.json?.intent && typeof response.json.intent === 'string') {
      actions = [this.intentObjectToAction(response.json, username)]
    } else if (Array.isArray(response.json?.actions)) {
      actions = response.json.actions
    } else if (Array.isArray(response.json)) {
      actions = response.json
    } else if (response.json?.tool) {
      actions = [response.json]
    } else if (response.json?.action?.tool) {
      actions = [response.json.action]
    }
    return {
      ok: true,
      reply: response.json?.reply,
      intent: response.json?.intent || response.json?.reason || response.json?.plan,
      actions,
      raw: response.json
    }
  }

  intentObjectToAction(intentObject = {}, username) {
    const intent = String(intentObject.intent || intentObject.tool || '').trim()
    const parameters =
      intentObject.parameters && typeof intentObject.parameters === 'object'
        ? intentObject.parameters
        : intentObject.args && typeof intentObject.args === 'object'
          ? intentObject.args
          : {}
    const target = intentObject.target ?? parameters.target
    return {
      tool: intent,
      args: {
        ...parameters,
        target,
        player: parameters.player || (target === 'speaker' ? username : undefined)
      },
      reason: intentObject.reason || intentObject.intentReason || 'intent selected by Gemini'
    }
  }

  async repairEmptyAction({ username, message, observation, previous }) {
    this.metrics.requests++
    this.debug.executionState = 'THINKING'
    const prompt = {
      task: 'minecraft_chat_control_repair',
      speaker: username,
      message,
      observation,
      previous,
      availableIntents: this.toolNames(),
      rules: [
        'The previous response did not include a usable intent.',
        'If the player command is actionable in Minecraft, return JSON with one high-level intent.',
        'Use only availableIntents.',
        'Return JSON only. No markdown.',
        'Do not reveal hidden chain of thought. Provide only a short intent summary and action reasons.',
        'For uncertain targets, choose the safest closest semantic intent from the observation.',
        'Never return coordinates, pathfinder commands, camera control, or direct movement instructions.'
      ],
      responseShape: {
        reply: 'short optional chat reply',
        intent: 'intent_name',
        target: 'semantic target or speaker',
        parameters: {},
        reason: 'short visible reason'
      }
    }
    const response = await this.llm.complete(safeJson(prompt), { format: 'json' })
    this.debug.lastGeminiResponse = response.raw || response.text
    this.debug.executionState = response.ok ? 'ACTING' : 'FAILED'
    if (!response.ok) {
      this.debug.lastError = response.error
      return { ok: false, error: response.error, actions: [] }
    }

    let actions = []
    if (Array.isArray(response.json?.intents)) {
      actions = response.json.intents.map((intent) => this.intentObjectToAction(intent, username))
    } else if (response.json?.intent && typeof response.json.intent === 'string') {
      actions = [this.intentObjectToAction(response.json, username)]
    } else if (Array.isArray(response.json?.actions)) actions = response.json.actions
    else if (Array.isArray(response.json)) actions = response.json
    else if (response.json?.tool) actions = [response.json]
    else if (response.json?.action?.tool) actions = [response.json.action]

    return {
      ok: true,
      reply: response.json?.reply,
      intent: response.json?.intent || response.json?.reason || response.json?.plan,
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
      agentRuntime: this.agentRuntime?.status?.(),
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
