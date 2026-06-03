import { normalizeName } from './utils'

/**
 * Intent Router - Dispatch intents to appropriate engines
 *
 * Routes LLM intents to specialized handlers:
 * - Mining/Harvesting → Mining Engine
 * - Crafting/Smelting → Crafting Engine
 * - Combat/Hunting → Combat Engine
 * - Building → Building Engine
 * - Exploration → Exploration Engine
 * - Mobility → Mobility Engine
 * - Survival → Survival Engine (PRIORITY)
 */
export class IntentRouter {
  constructor({ engines = {}, survival, coordinator } = {}) {
    this.engines = engines
    this.survival = survival
    this.coordinator = coordinator
    this.handlers = this.buildHandlers()
    this.executionLog = []
  }

  /**
   * Build intent→handler mapping
   */
  buildHandlers() {
    return {
      // Survival (HIGHEST PRIORITY)
      eat_food: (intent) => ({ type: 'survival', engine: 'survival', action: 'eat' }),
      eat: (intent) => ({ type: 'survival', engine: 'survival', action: 'eat' }),
      sleep: (intent) => ({ type: 'survival', engine: 'survival', action: 'sleep' }),
      hide: (intent) => ({ type: 'survival', engine: 'survival', action: 'hide' }),
      escape: (intent) => ({ type: 'survival', engine: 'survival', action: 'escape' }),

      // Mining & Resource Gathering
      gather_wood: (intent) => ({ type: 'mining', engine: 'mining', skill: 'harvest_tree', args: intent.parameters }),
      gather_stone: (intent) => ({ type: 'mining', engine: 'mining', skill: 'mine_ore', args: { ore: 'stone', ...intent.parameters } }),
      gather_coal: (intent) => ({ type: 'mining', engine: 'mining', skill: 'mine_ore', args: { ore: 'coal', ...intent.parameters } }),
      gather_iron: (intent) => ({ type: 'mining', engine: 'mining', skill: 'mine_ore', args: { ore: 'iron', ...intent.parameters } }),
      gather_copper: (intent) => ({ type: 'mining', engine: 'mining', skill: 'mine_ore', args: { ore: 'copper', ...intent.parameters } }),
      gather_diamond: (intent) => ({ type: 'mining', engine: 'mining', skill: 'mine_ore', args: { ore: 'diamond', ...intent.parameters } }),
      mine_ore: (intent) => ({ type: 'mining', engine: 'mining', skill: 'mine_ore', args: intent.parameters }),
      harvest_resource: (intent) => ({ type: 'mining', engine: 'mining', skill: 'harvest_tree', args: intent.parameters }),
      mine_logs: (intent) => ({ type: 'mining', engine: 'mining', skill: 'harvest_tree', args: intent.parameters }),

      // Crafting & Smelting
      craft_item: (intent) => ({ type: 'crafting', engine: 'crafting', skill: 'craft_item', args: intent.parameters }),
      craft_pickaxe: (intent) => ({ type: 'crafting', engine: 'crafting', skill: 'craft_item', args: { item: 'pickaxe', ...intent.parameters } }),
      craft_table: (intent) => ({ type: 'crafting', engine: 'crafting', skill: 'craft_item', args: { item: 'crafting_table', ...intent.parameters } }),
      craft_furnace: (intent) => ({ type: 'crafting', engine: 'crafting', skill: 'craft_item', args: { item: 'furnace', ...intent.parameters } }),
      craft_chest: (intent) => ({ type: 'crafting', engine: 'crafting', skill: 'craft_item', args: { item: 'chest', ...intent.parameters } }),
      smelt_item: (intent) => ({ type: 'crafting', engine: 'crafting', skill: 'smelt_item', args: intent.parameters }),
      smelt_iron: (intent) => ({ type: 'crafting', engine: 'crafting', skill: 'smelt_item', args: { item: 'iron', ...intent.parameters } }),

      // Combat & Hunting
      hunt_mob: (intent) => ({ type: 'combat', engine: 'combat', skill: 'hunt_mob', args: intent.parameters }),
      hunt_animal: (intent) => ({ type: 'combat', engine: 'combat', skill: 'hunt_mob', args: { target: 'animal', ...intent.parameters } }),
      attack_target: (intent) => ({ type: 'combat', engine: 'combat', skill: 'attack_target', args: intent.parameters }),
      protect_player: (intent) => ({ type: 'combat', engine: 'combat', skill: 'protect_player', args: intent.parameters }),
      protect: (intent) => ({ type: 'combat', engine: 'combat', skill: 'protect_player', args: intent.parameters }),
      fight: (intent) => ({ type: 'combat', engine: 'combat', skill: 'attack_target', args: intent.parameters }),
      flee: (intent) => ({ type: 'combat', engine: 'combat', skill: 'flee_threat', args: intent.parameters }),

      // Building & Construction
      build_structure: (intent) => ({ type: 'building', engine: 'building', skill: 'build_structure', args: intent.parameters }),
      build_house: (intent) => ({ type: 'building', engine: 'building', skill: 'build_structure', args: { type: 'house', ...intent.parameters } }),
      build_farm: (intent) => ({ type: 'building', engine: 'building', skill: 'build_structure', args: { type: 'farm', ...intent.parameters } }),
      build_bridge: (intent) => ({ type: 'building', engine: 'building', skill: 'build_structure', args: { type: 'bridge', ...intent.parameters } }),
      place_block: (intent) => ({ type: 'building', engine: 'building', skill: 'place_block', args: intent.parameters }),

      // Exploration & Discovery
      explore: (intent) => ({ type: 'exploration', engine: 'exploration', skill: 'explore', args: intent.parameters }),
      explore_cave: (intent) => ({ type: 'exploration', engine: 'exploration', skill: 'explore_cave', args: intent.parameters }),
      explore_biome: (intent) => ({ type: 'exploration', engine: 'exploration', skill: 'explore_biome', args: intent.parameters }),
      search_resource: (intent) => ({ type: 'exploration', engine: 'exploration', skill: 'search_resource', args: intent.parameters }),
      find_structure: (intent) => ({ type: 'exploration', engine: 'exploration', skill: 'find_structure', args: intent.parameters }),

      // Mobility & Movement
      follow_player: (intent) => ({ type: 'mobility', engine: 'mobility', skill: 'follow_player', args: intent.parameters }),
      follow: (intent) => ({ type: 'mobility', engine: 'mobility', skill: 'follow_player', args: intent.parameters }),
      go_to: (intent) => ({ type: 'mobility', engine: 'mobility', skill: 'navigate_to', args: intent.parameters }),
      navigate: (intent) => ({ type: 'mobility', engine: 'mobility', skill: 'navigate_to', args: intent.parameters }),
      teleport: (intent) => ({ type: 'mobility', engine: 'mobility', skill: 'navigate_to', args: intent.parameters }),

      // Farming & Breeding
      farm_crop: (intent) => ({ type: 'farming', engine: 'exploration', skill: 'farm_crop', args: intent.parameters }),
      breed_animal: (intent) => ({ type: 'farming', engine: 'exploration', skill: 'breed_animal', args: intent.parameters }),

      // Utility
      idle: (intent) => ({ type: 'utility', engine: 'none', action: 'idle' }),
      wait: (intent) => ({ type: 'utility', engine: 'none', action: 'wait' })
    }
  }

  /**
   * Route intent to appropriate handler
   *
   * @param {Object} intent - Intent object from LLM Cortex
   * @returns {Promise<Object>} Execution result
   */
  async route(intent) {
    const normalized = normalizeName(intent.intent || intent)
    const handler = this.handlers[normalized]

    if (!handler) {
      return this.handleUnknownIntent(intent)
    }

    const route = handler(intent)

    const logEntry = {
      timestamp: Date.now(),
      intent: normalized,
      route,
      priority: intent.priority,
      status: 'routing'
    }

    this.executionLog.unshift(logEntry)
    if (this.executionLog.length > 100) this.executionLog.pop()

    try {
      return await this.executeRoute(route, intent)
    } catch (error) {
      logEntry.status = 'error'
      logEntry.error = error.message
      throw error
    }
  }

  /**
   * Execute routed handler
   */
  async executeRoute(route, intent) {
    // Survival always has priority
    if (this.survival) {
      const survivalResult = await this.survival.overrideIfNeeded?.({
        intent,
        route
      })
      if (survivalResult) {
        return survivalResult
      }
    }

    // Get engine
    const engine = this.engines[route.engine]
    if (!engine) {
      throw new Error(`Engine not found: ${route.engine}`)
    }

    // Execute
    return await engine.execute?.(route, intent)
  }

  /**
   * Handle unknown intents
   */
  async handleUnknownIntent(intent) {
    const search = String(intent.intent || '').toLowerCase()

    // Try fuzzy matching
    const similar = Object.keys(this.handlers)
      .filter((key) => search.includes(key) || key.includes(search))
      .slice(0, 1)

    if (similar.length > 0) {
      const handler = this.handlers[similar[0]]
      const route = handler(intent)
      return await this.executeRoute(route, intent)
    }

    // Default: explore
    return await this.executeRoute(
      { type: 'exploration', engine: 'exploration', skill: 'explore', args: {} },
      intent
    )
  }

  /**
   * Get routing status
   */
  status() {
    return {
      handlers: Object.keys(this.handlers).length,
      lastRoute: this.executionLog[0],
      recentRoutes: this.executionLog.slice(0, 10).map((e) => ({
        intent: e.intent,
        route: e.route.type,
        priority: e.priority,
        status: e.status
      }))
    }
  }
}
