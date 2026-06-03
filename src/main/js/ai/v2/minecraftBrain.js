import { normalizeName } from './utils'

export class MinecraftBrain {
  constructor({ bot } = {}) {
    this.bot = bot
    this.goalTemplates = this.createGoalTemplates()
    this.oreCatalog = this.createOreCatalog()
  }

  createOreCatalog() {
    return {
      coal: {
        aliases: ['komur', 'fuel'],
        blocks: ['coal_ore', 'deepslate_coal_ore'],
        drops: ['coal'],
        requiredTool: 'wooden_pickaxe',
        minPickaxeTier: 1,
        startAfter: ['wooden_pickaxe'],
        tier: 1,
        priority: 55,
        use: 'fuel_torches'
      },
      copper: {
        aliases: ['bakir'],
        blocks: ['copper_ore', 'deepslate_copper_ore'],
        drops: ['raw_copper'],
        requiredTool: 'stone_pickaxe',
        minPickaxeTier: 2,
        startAfter: ['stone_pickaxe'],
        tier: 2,
        priority: 35,
        use: 'building_utility'
      },
      iron: {
        aliases: ['demir'],
        blocks: ['iron_ore', 'deepslate_iron_ore'],
        drops: ['raw_iron'],
        requiredTool: 'stone_pickaxe',
        minPickaxeTier: 2,
        startAfter: ['stone_pickaxe'],
        tier: 2,
        priority: 90,
        use: 'tools_armor_progression'
      },
      gold: {
        aliases: ['altin'],
        blocks: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
        drops: ['raw_gold', 'gold_nugget'],
        requiredTool: 'iron_pickaxe',
        minPickaxeTier: 3,
        startAfter: ['iron_pickaxe'],
        tier: 3,
        priority: 60,
        use: 'barter_powered_rails'
      },
      redstone: {
        aliases: ['kiziltas', 'red'],
        blocks: ['redstone_ore', 'deepslate_redstone_ore'],
        drops: ['redstone'],
        requiredTool: 'iron_pickaxe',
        minPickaxeTier: 3,
        startAfter: ['iron_pickaxe'],
        tier: 3,
        priority: 50,
        use: 'automation'
      },
      lapis: {
        aliases: ['lapis_lazuli'],
        blocks: ['lapis_ore', 'deepslate_lapis_ore'],
        drops: ['lapis_lazuli'],
        requiredTool: 'stone_pickaxe',
        minPickaxeTier: 2,
        startAfter: ['stone_pickaxe'],
        tier: 2,
        priority: 45,
        use: 'enchanting'
      },
      diamond: {
        aliases: ['elmas'],
        blocks: ['diamond_ore', 'deepslate_diamond_ore'],
        drops: ['diamond'],
        requiredTool: 'iron_pickaxe',
        minPickaxeTier: 3,
        startAfter: ['iron_pickaxe'],
        tier: 3,
        priority: 100,
        use: 'endgame_tools_armor'
      },
      emerald: {
        aliases: ['zumrut'],
        blocks: ['emerald_ore', 'deepslate_emerald_ore'],
        drops: ['emerald'],
        requiredTool: 'iron_pickaxe',
        minPickaxeTier: 3,
        startAfter: ['iron_pickaxe'],
        tier: 3,
        priority: 70,
        use: 'villager_trading'
      },
      quartz: {
        aliases: ['kuvars', 'nether_quartz'],
        blocks: ['nether_quartz_ore'],
        drops: ['quartz'],
        requiredTool: 'wooden_pickaxe',
        minPickaxeTier: 1,
        startAfter: ['wooden_pickaxe', 'nether_access'],
        tier: 1,
        priority: 40,
        dimension: 'nether',
        use: 'redstone_building'
      },
      ancient_debris: {
        aliases: ['ancient', 'netherite', 'netherit'],
        blocks: ['ancient_debris'],
        drops: ['ancient_debris'],
        requiredTool: 'diamond_pickaxe',
        minPickaxeTier: 4,
        startAfter: ['diamond_pickaxe', 'nether_access'],
        tier: 4,
        priority: 110,
        dimension: 'nether',
        use: 'netherite_progression'
      }
    }
  }

  miningProgression() {
    return [
      { stage: 'bootstrap', goal: 'wooden_pickaxe', reason: 'stone and coal require at least a wooden pickaxe' },
      { stage: 'stone_tools', goal: 'stone_pickaxe', reason: 'iron, copper, and lapis require stone tier mining' },
      { stage: 'fuel', goal: 'coal', reason: 'fuel and torches make deeper mining safer' },
      { stage: 'iron', goal: 'iron', reason: 'iron unlocks iron pickaxe and armor progression' },
      { stage: 'iron_tools', goal: 'iron_pickaxe', reason: 'diamond, redstone, gold, and emerald require iron tier mining' },
      { stage: 'diamond', goal: 'diamond', reason: 'diamond unlocks obsidian and netherite progression' },
      { stage: 'diamond_tools', goal: 'diamond_pickaxe', reason: 'ancient debris requires diamond tier mining' },
      { stage: 'netherite', goal: 'ancient_debris', reason: 'highest mining progression target' }
    ]
  }

  createGoalTemplates() {
    return {
      build_house: {
        aliases: ['house', 'starter_house', 'ev_yap', 'build_starter_house'],
        solutions: [
          {
            name: 'build_starter_house',
            requires: [
              'log:12',
              'cobblestone:32',
              'glass:6',
              'torch:4',
              'oak_door:1',
              'crafting_table',
              'furnace'
            ],
            action: { skill: 'build_house', args: { structure: 'starter_house' } },
            risk: 2,
            time: 8,
            efficiency: 8
          }
        ]
      },
      build_shelter: {
        aliases: ['shelter', 'barinak', 'sigınak', 'siginak'],
        solutions: [
          {
            name: 'build_emergency_shelter',
            requires: ['dirt:24', 'torch:2'],
            action: { skill: 'build_structure', args: { structure: 'emergency_shelter', block: 'dirt' } },
            risk: 1,
            time: 3,
            efficiency: 7
          }
        ]
      },
      make_farm: {
        aliases: ['farm', 'crop_farm', 'tarla', 'build_farm'],
        solutions: [
          {
            name: 'build_crop_farm',
            requires: ['dirt:16', 'seed:4', 'water_bucket', 'hoe'],
            action: { skill: 'farm_crop', args: { mode: 'build_farm' } },
            risk: 2,
            time: 7,
            efficiency: 7
          }
        ]
      }
    }
  }

  item(name) {
    const key = normalizeName(name)
    return this.bot?.registry?.itemsByName?.[key]
  }

  block(name) {
    const key = normalizeName(name)
    return this.bot?.registry?.blocksByName?.[key]
  }

  itemById(id) {
    return this.bot?.registry?.items?.[id] || this.bot?.registry?.itemsArray?.find?.((item) => item.id === id)
  }

  hasItem(name) {
    const key = normalizeName(name)
    return Boolean(this.item(key))
  }

  resolveProgression(goal) {
    const key = normalizeName(goal)
    if (key === 'survive_night') return ['eat_food', 'sleep']
    return []
  }

  dynamicDefinition(target) {
    const key = this.resolveAlias(target)
    const template = this.goalTemplates[key]
    if (template) return { ...template, name: key }

    if (key === 'ore') {
      const readiness = this.miningReadiness('ore')
      const mineable = readiness.ores.find((ore) => ore.canMine)
      const missing = readiness.ores.find((ore) => !ore.canMine)?.missing
      const resource = mineable?.name || 'coal'
      return {
        name: key,
        solutions: [
          {
            name: mineable ? `mine_best_available_${resource}` : `prepare_for_mining_${missing?.requiredTool || 'wooden_pickaxe'}`,
            requires: mineable ? [] : [missing?.requiredTool || 'wooden_pickaxe'],
            action: { skill: 'gather_resource', args: { resource: mineable ? resource : 'ore', count: 1, range: 96 } },
            risk: mineable ? 3 : 1,
            time: mineable ? 5 : 2,
            efficiency: mineable ? 8 : 5
          }
        ]
      }
    }

    if (key === 'glass') {
      return {
        name: key,
        solutions: [
          {
            name: 'smelt_glass',
            requires: [{ item: 'sand', count: 1, scale: true }, 'furnace', 'fuel'],
            action: { skill: 'smelt_item', args: { item: 'sand', output: 'glass' } },
            risk: 1,
            time: 4,
            efficiency: 8
          }
        ]
      }
    }

    const oreTarget = this.oreProfile(key)
    if (oreTarget) {
      const resource = this.normalizeMiningResource(key)
      return {
        name: resource,
        solutions: [
          {
            name: `mine_${resource}`,
            requires: oreTarget.requiredTool ? [oreTarget.requiredTool] : [],
            action: { skill: 'gather_resource', args: { resource, count: 1, range: 96 } },
            risk: Math.max(1, oreTarget.tier),
            time: oreTarget.dimension === 'nether' ? 8 : 4,
            efficiency: Math.max(4, Math.round(oreTarget.priority / 12))
          }
        ]
      }
    }

    const recipe = this.bestRecipeFor(key)
    if (recipe) {
      return {
        name: key,
        solutions: [
          {
            name: `craft_${key}`,
            requires: this.recipeRequirements(recipe),
            action: { skill: 'craft_item', args: { item: key, count: recipe.result?.count || 1 } },
            produces: Number(recipe.result?.count || 1),
            scaleRequirements: true,
            risk: 1,
            time: 2,
            efficiency: 8
          }
        ]
      }
    }

    if (this.block(key) || this.item(key)) {
      const ore = this.oreProfile(key)
      return {
        name: key,
        solutions: [
          {
            name: `gather_${key}`,
            requires: ore?.requiredTool ? [ore.requiredTool] : [],
            action: { skill: this.isWood(key) ? 'gather_wood' : 'gather_resource', args: this.isWood(key) ? { count: 1, range: 96 } : { resource: this.normalizeMiningResource(key), count: 1, range: 96 } },
            risk: ore ? Math.max(1, ore.tier) : this.requiredToolFor(key) ? 3 : 1,
            time: ore?.dimension === 'nether' ? 8 : 3,
            efficiency: ore ? Math.max(4, Math.round(ore.priority / 12)) : 6
          }
        ]
      }
    }

    return undefined
  }

  resolveAlias(target) {
    const key = normalizeName(target)
    for (const [name, template] of Object.entries(this.goalTemplates)) {
      if (name === key || template.aliases?.map(normalizeName).includes(key)) return name
    }
    const aliases = {
      house: 'build_house',
      ev: 'build_house',
      home: 'build_house',
      shelter: 'build_shelter',
      farm: 'make_farm',
      wheat_seeds: 'seed',
      seeds: 'seed',
      seed: 'wheat_seeds',
      wood: 'log',
      logs: 'log',
      planks: 'oak_planks',
      door: 'oak_door',
      hoe: 'wooden_hoe',
      ores: 'ore',
      maden: 'ore',
      madenler: 'ore'
    }
    for (const [oreName, ore] of Object.entries(this.oreCatalog)) {
      if (oreName === key || ore.aliases?.map(normalizeName).includes(key) || ore.blocks.includes(key) || ore.drops.includes(key)) {
        return oreName
      }
    }
    return aliases[key] || key
  }

  normalizeMiningResource(target) {
    const key = this.resolveAlias(target)
    if (key === 'ore' || key === 'ores' || key === 'maden') return 'ore'
    return this.oreCatalog[key] ? key : normalizeName(target)
  }

  oreProfile(target) {
    const key = normalizeName(target)
    const resolved = this.resolveAlias(key)
    return this.oreCatalog[resolved] || Object.values(this.oreCatalog).find((ore) => {
      return ore.blocks.includes(key) || ore.drops.includes(key) || ore.aliases?.map(normalizeName).includes(key)
    })
  }

  allOreBlockNames() {
    return Object.values(this.oreCatalog).flatMap((ore) => ore.blocks)
  }

  oreBlockNames(target = 'ore') {
    const key = this.normalizeMiningResource(target)
    if (key === 'ore') return this.allOreBlockNames()
    return this.oreCatalog[key]?.blocks || [normalizeName(target)]
  }

  rankOreBlock(blockName, context = {}) {
    const ore = this.oreProfile(blockName)
    if (!ore) return 0
    const hasTool = this.canMineOre(ore, context.inventory).ok
    const toolPenalty = hasTool ? 0 : 45
    const netherPenalty = ore.dimension === 'nether' && !context.inNether ? 30 : 0
    return ore.priority - toolPenalty - netherPenalty
  }

  hasToolTier(requiredTool, inventory = this.bot?.inventory?.items?.()) {
    if (!requiredTool) return true
    const tier = this.toolTier(requiredTool)
    return (inventory || []).some((item) => /pickaxe/.test(item.name) && this.toolTier(item.name) >= tier)
  }

  bestPickaxe(inventory = this.bot?.inventory?.items?.()) {
    return (inventory || [])
      .filter((item) => /pickaxe/.test(item.name))
      .map((item) => ({ name: item.name, tier: this.toolTier(item.name) }))
      .sort((a, b) => b.tier - a.tier)[0]
  }

  canMineOre(target, inventory = this.bot?.inventory?.items?.()) {
    const ore = typeof target === 'object' ? target : this.oreProfile(target)
    if (!ore) return { ok: true, reason: 'not_cataloged_ore' }
    const best = this.bestPickaxe(inventory)
    const requiredTier = Number(ore.minPickaxeTier || this.toolTier(ore.requiredTool))
    if (best && best.tier >= requiredTier) {
      return { ok: true, tool: best.name, requiredTool: ore.requiredTool, requiredTier }
    }
    return {
      ok: false,
      reason: 'missing_required_pickaxe',
      requiredTool: ore.requiredTool,
      requiredTier,
      currentTool: best?.name,
      currentTier: best?.tier || 0,
      prerequisiteGoal: ore.requiredTool
    }
  }

  miningReadiness(target = 'ore', inventory = this.bot?.inventory?.items?.()) {
    const resource = this.normalizeMiningResource(target)
    const ores = resource === 'ore' ? Object.keys(this.oreCatalog) : [resource]
    const entries = ores
      .map((name) => {
        const ore = this.oreCatalog[name]
        if (!ore) return undefined
        const readiness = this.canMineOre(ore, inventory)
        return {
          name,
          blocks: ore.blocks,
          requiredTool: ore.requiredTool,
          minPickaxeTier: ore.minPickaxeTier,
          priority: ore.priority,
          canMine: readiness.ok,
          missing: readiness.ok ? undefined : readiness
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.canMine !== b.canMine) return a.canMine ? -1 : 1
        return b.priority - a.priority
      })
    return {
      target: resource,
      bestPickaxe: this.bestPickaxe(inventory),
      progression: this.miningProgression(),
      ores: entries
    }
  }

  toolTier(toolName) {
    const key = normalizeName(toolName)
    if (key.includes('netherite')) return 5
    if (key.includes('diamond')) return 4
    if (key.includes('iron')) return 3
    if (key.includes('stone')) return 2
    if (key.includes('wooden') || key.includes('golden')) return 1
    return 0
  }

  bestRecipeFor(target) {
    const key = normalizeName(target)
    const item = this.item(key)
    if (!item) return undefined
    const recipes = this.bot?.registry?.recipes?.[item.id] || []
    return recipes
      .map((recipe) => ({ ...recipe, requirements: this.recipeRequirements(recipe) }))
      .filter((recipe) => recipe.requirements.length > 0)
      .sort((a, b) => a.requirements.length - b.requirements.length)[0]
  }

  recipeRequirements(recipe) {
    const counts = new Map()
    const add = (id, count = 1) => {
      const item = this.itemById(id)
      if (!item?.name) return
      const key = normalizeName(item.name)
      counts.set(key, (counts.get(key) || 0) + Number(count || 1))
    }
    if (Array.isArray(recipe.ingredients)) {
      for (const ingredient of recipe.ingredients) {
        if (Array.isArray(ingredient)) add(ingredient[0], ingredient[1] || 1)
        else if (typeof ingredient === 'object') add(ingredient.id, ingredient.count || 1)
        else add(ingredient, 1)
      }
    }
    if (Array.isArray(recipe.inShape)) {
      for (const row of recipe.inShape) {
        for (const id of row || []) add(id, 1)
      }
    }
    if (Array.isArray(recipe.outShape)) {
      for (const row of recipe.outShape) {
        for (const id of row || []) add(id, 1)
      }
    }
    return Array.from(counts.entries()).map(([item, count]) => ({ item, count, scale: false }))
  }

  isWood(name) {
    const key = normalizeName(name)
    return /log|wood|stem|hyphae/.test(key)
  }

  requiredToolFor(blockName) {
    const key = normalizeName(blockName)
    const ore = this.oreProfile(key)
    if (ore?.requiredTool) return ore.requiredTool
    if (key.includes('diamond')) return 'iron_pickaxe'
    if (key.includes('iron') || key.includes('gold') || key.includes('redstone') || key.includes('lapis')) return 'stone_pickaxe'
    if (key.includes('stone') || key.includes('ore')) return 'wooden_pickaxe'
    return undefined
  }

  status() {
    return {
      items: Object.keys(this.bot?.registry?.itemsByName || {}).length,
      blocks: Object.keys(this.bot?.registry?.blocksByName || {}).length,
      progressionGoals: Object.keys(this.goalTemplates).length,
      recipes: Object.keys(this.bot?.registry?.recipes || {}).length,
      ores: Object.keys(this.oreCatalog).length
    }
  }
}
