import { now, normalizeName } from './utils'

/**
 * Curriculum System - Self-Generated Progression Goals
 *
 * Inspired by Voyager, generates self-improvement objectives.
 * Automatically progresses through Minecraft achievement chain.
 */
export class CurriculumSystem {
  constructor({ memory, knowledgeGraph } = {}) {
    this.memory = memory
    this.knowledgeGraph = knowledgeGraph
    this.tiers = this.generateTiers()
    this.completedGoals = new Set()
    this.currentTier = 0
    this.load()
  }

  /**
   * Generate 4-tier progression system
   */
  generateTiers() {
    return [
      // TIER 1: Survival Foundation (Hour 0)
      {
        name: 'Survival Foundation',
        tier: 1,
        goals: [
          {
            id: 'gather_wood:8',
            name: 'Gather Wood',
            description: 'Collect 8 logs from trees',
            objective: 'obtain 8 wood',
            reward: 10,
            timeEstimate: 300,
            prerequisites: [],
            skills: ['harvest_tree'],
            validation: (context) => this.hasItem(context, 'wood', 8)
          },
          {
            id: 'craft_crafting_table',
            name: 'Craft Crafting Table',
            description: 'Create a crafting table from 4 planks',
            objective: 'obtain crafting_table',
            reward: 15,
            timeEstimate: 100,
            prerequisites: ['gather_wood:8'],
            skills: ['craft_item'],
            validation: (context) => this.hasItem(context, 'crafting_table', 1)
          },
          {
            id: 'craft_wooden_pickaxe',
            name: 'Craft Wooden Pickaxe',
            description: 'Create a wooden pickaxe at crafting table',
            objective: 'obtain wooden_pickaxe',
            reward: 20,
            timeEstimate: 100,
            prerequisites: ['craft_crafting_table'],
            skills: ['craft_item'],
            validation: (context) => this.hasItem(context, 'wooden_pickaxe', 1)
          },
          {
            id: 'craft_wooden_sword',
            name: 'Craft Wooden Sword',
            description: 'Create a wooden sword for defense',
            objective: 'obtain wooden_sword',
            reward: 15,
            timeEstimate: 50,
            prerequisites: ['craft_crafting_table'],
            skills: ['craft_item'],
            validation: (context) => this.hasItem(context, 'wooden_sword', 1)
          },
          {
            id: 'place_furnace',
            name: 'Place Furnace',
            description: 'Craft and place a furnace',
            objective: 'place furnace',
            reward: 20,
            timeEstimate: 100,
            prerequisites: ['craft_crafting_table'],
            skills: ['craft_item', 'place_block'],
            validation: (context) => this.hasUtility(context, 'furnace')
          }
        ],
        completionThreshold: 0.5
      },

      // TIER 2: Stone Age (Hour 1)
      {
        name: 'Stone Age',
        tier: 2,
        goals: [
          {
            id: 'mine_stone:32',
            name: 'Mine Stone',
            description: 'Mine 32 cobblestone blocks',
            objective: 'obtain 32 cobblestone',
            reward: 20,
            timeEstimate: 600,
            prerequisites: ['craft_wooden_pickaxe'],
            skills: ['mine_ore'],
            validation: (context) => this.hasItem(context, 'cobblestone', 32)
          },
          {
            id: 'craft_stone_pickaxe',
            name: 'Craft Stone Pickaxe',
            description: 'Upgrade to stone pickaxe',
            objective: 'obtain stone_pickaxe',
            reward: 25,
            timeEstimate: 100,
            prerequisites: ['mine_stone:32'],
            skills: ['craft_item'],
            validation: (context) => this.hasItem(context, 'stone_pickaxe', 1)
          },
          {
            id: 'craft_furnace',
            name: 'Craft Furnace',
            description: 'Create a furnace from cobblestone',
            objective: 'have working furnace',
            reward: 15,
            timeEstimate: 200,
            prerequisites: ['mine_stone:32'],
            skills: ['craft_item', 'place_block'],
            validation: (context) => this.hasUtility(context, 'furnace')
          },
          {
            id: 'mine_coal:8',
            name: 'Mine Coal',
            description: 'Collect 8 coal or charcoal for fuel',
            objective: 'obtain 8 coal',
            reward: 20,
            timeEstimate: 300,
            prerequisites: ['craft_stone_pickaxe'],
            skills: ['mine_ore'],
            validation: (context) =>
              this.hasItem(context, 'coal', 8) || this.hasItem(context, 'charcoal', 8)
          },
          {
            id: 'build_basic_shelter',
            name: 'Build Basic Shelter',
            description: 'Create a 5x5x3 shelter with roof',
            objective: 'complete shelter',
            reward: 30,
            timeEstimate: 600,
            prerequisites: ['mine_stone:32', 'craft_furnace'],
            skills: ['place_block', 'build_structure'],
            validation: (context) => this.hasUtility(context, 'bed')
          }
        ],
        completionThreshold: 0.4
      },

      // TIER 3: Iron Age (Hour 2)
      {
        name: 'Iron Age',
        tier: 3,
        goals: [
          {
            id: 'mine_iron:16',
            name: 'Mine Iron',
            description: 'Collect 16 iron ore blocks',
            objective: 'obtain 16 raw_iron',
            reward: 30,
            timeEstimate: 900,
            prerequisites: ['craft_stone_pickaxe'],
            skills: ['mine_ore'],
            validation: (context) => this.hasItem(context, 'raw_iron', 16)
          },
          {
            id: 'smelt_iron:16',
            name: 'Smelt Iron',
            description: 'Smelt iron ore into ingots',
            objective: 'obtain 16 iron_ingot',
            reward: 25,
            timeEstimate: 600,
            prerequisites: ['mine_iron:16', 'craft_furnace'],
            skills: ['smelt_item'],
            validation: (context) => this.hasItem(context, 'iron_ingot', 16)
          },
          {
            id: 'craft_iron_pickaxe',
            name: 'Craft Iron Pickaxe',
            description: 'Create iron pickaxe for mining diamond',
            objective: 'obtain iron_pickaxe',
            reward: 30,
            timeEstimate: 100,
            prerequisites: ['smelt_iron:16'],
            skills: ['craft_item'],
            validation: (context) => this.hasItem(context, 'iron_pickaxe', 1)
          },
          {
            id: 'craft_iron_sword',
            name: 'Craft Iron Sword',
            description: 'Upgrade to iron sword for combat',
            objective: 'obtain iron_sword',
            reward: 20,
            timeEstimate: 100,
            prerequisites: ['smelt_iron:16'],
            skills: ['craft_item'],
            validation: (context) => this.hasItem(context, 'iron_sword', 1)
          },
          {
            id: 'craft_iron_armor',
            name: 'Craft Iron Armor',
            description: 'Create full iron armor set',
            objective: 'obtain iron armor',
            reward: 40,
            timeEstimate: 300,
            prerequisites: ['smelt_iron:16'],
            skills: ['craft_item'],
            validation: (context) => this.hasArmor(context, 'iron', 4)
          },
          {
            id: 'find_village',
            name: 'Find Village',
            description: 'Locate and trade with villagers (optional)',
            objective: 'find village',
            reward: 25,
            timeEstimate: 1200,
            prerequisites: ['build_basic_shelter'],
            skills: ['explore', 'search_structure'],
            validation: () => this.memory?.state?.longTerm?.knownLocations?.village?.length > 0,
            optional: true
          }
        ],
        completionThreshold: 0.6
      },

      // TIER 4: Diamond & Beyond (Hour 3+)
      {
        name: 'Diamond & Beyond',
        tier: 4,
        goals: [
          {
            id: 'mine_diamond:5',
            name: 'Mine Diamond',
            description: 'Collect 5 diamonds from deep caves',
            objective: 'obtain 5 diamond',
            reward: 50,
            timeEstimate: 1800,
            prerequisites: ['craft_iron_pickaxe'],
            skills: ['mine_ore', 'explore_cave'],
            validation: (context) => this.hasItem(context, 'diamond', 5)
          },
          {
            id: 'craft_diamond_pickaxe',
            name: 'Craft Diamond Pickaxe',
            description: 'Create diamond pickaxe',
            objective: 'obtain diamond_pickaxe',
            reward: 50,
            timeEstimate: 100,
            prerequisites: ['mine_diamond:5'],
            skills: ['craft_item'],
            validation: (context) => this.hasItem(context, 'diamond_pickaxe', 1)
          },
          {
            id: 'find_nether_portal',
            name: 'Find Nether Portal',
            description: 'Locate a ruined nether portal',
            objective: 'find nether portal',
            reward: 40,
            timeEstimate: 1200,
            prerequisites: ['craft_iron_pickaxe'],
            skills: ['explore', 'search_structure'],
            validation: (context) => this.hasBlock(context, 'obsidian', 6)
          },
          {
            id: 'enter_nether',
            name: 'Enter Nether',
            description: 'Build and activate nether portal',
            objective: 'reach nether',
            reward: 60,
            timeEstimate: 300,
            prerequisites: ['find_nether_portal'],
            skills: ['place_block', 'build_structure'],
            validation: (context) => context.dimension === 'nether'
          },
          {
            id: 'defeat_ender_dragon',
            name: 'Defeat Dragon',
            description: 'Find and defeat the ender dragon',
            objective: 'slay dragon',
            reward: 100,
            timeEstimate: 3600,
            prerequisites: ['craft_diamond_pickaxe', 'enter_nether'],
            skills: ['hunt_mob', 'fight'],
            validation: (context) => context.achievements?.enderDragon
          }
        ],
        completionThreshold: 0.2
      }
    ]
  }

  /**
   * Get current tier's available goals
   */
  nextGoals() {
    const tier = this.tiers[this.currentTier]
    if (!tier) return []

    return tier.goals.filter((goal) => {
      // Already completed?
      if (this.completedGoals.has(goal.id)) return false

      // Prerequisites satisfied?
      return goal.prerequisites.every((prereq) => this.completedGoals.has(prereq))
    })
  }

  /**
   * Get next goals to present to LLM
   */
  nextTiers(limit = 5) {
    const available = this.nextGoals()
    return available.slice(0, limit).map((goal) => ({
      name: goal.name,
      description: goal.description,
      objective: goal.objective,
      reward: goal.reward,
      skills: goal.skills,
      timeEstimate: goal.timeEstimate,
      optional: goal.optional
    }))
  }

  /**
   * Mark goal as completed
   */
  completeGoal(goalId) {
    this.completedGoals.add(goalId)
    this.memory?.rememberSuccess?.(goalId, { tier: this.currentTier })

    // Check if tier is complete
    this.checkTierCompletion()
  }

  /**
   * Check if current tier is complete (above threshold)
   */
  checkTierCompletion() {
    const tier = this.tiers[this.currentTier]
    if (!tier) return

    const completed = tier.goals.filter((g) => this.completedGoals.has(g.id)).length
    const requiredGoals = tier.goals.filter((g) => !g.optional).length
    const completionRate = completed / requiredGoals

    if (completionRate >= tier.completionThreshold) {
      this.advanceTier()
    }
  }

  /**
   * Advance to next tier
   */
  advanceTier() {
    if (this.currentTier < this.tiers.length - 1) {
      this.currentTier++
      this.memory?.rememberSuccess?.(`tier_${this.currentTier}_unlocked`, {
        tier: this.tiers[this.currentTier]?.name
      })
    }
  }

  /**
   * Validation helpers
   */
  hasItem(context, itemName, minCount = 1) {
    const inventory = context?.inventory || []
    const item = inventory.find((i) => normalizeName(i.name).includes(normalizeName(itemName)))
    return item && item.count >= minCount
  }

  hasUtility(context, utilityName) {
    const utilities = context?.utilities || []
    return utilities.some((u) => normalizeName(u.name || u).includes(normalizeName(utilityName)))
  }

  hasArmor(context, type, minPieces) {
    const inventory = context?.inventory || []
    const armorPieces = inventory.filter(
      (i) => normalizeName(i.name).includes(type) && /helmet|chestplate|leggings|boots/.test(i.name)
    )
    return armorPieces.length >= minPieces
  }

  hasBlock(context, blockName, minCount = 1) {
    return this.hasItem(context, blockName, minCount)
  }

  /**
   * Persist state
   */
  save() {
    this.memory?.setWorking?.('curriculum', {
      currentTier: this.currentTier,
      completedGoals: Array.from(this.completedGoals),
      timestamp: now()
    })
  }

  /**
   * Load state
   */
  load() {
    const saved = this.memory?.getWorking?.('curriculum')
    if (saved) {
      this.currentTier = saved.currentTier || 0
      this.completedGoals = new Set(saved.completedGoals || [])
    }
  }

  /**
   * Get status
   */
  status() {
    const tier = this.tiers[this.currentTier]
    return {
      currentTier: this.currentTier + 1,
      tierName: tier?.name,
      completedGoals: this.completedGoals.size,
      availableGoals: this.nextGoals().length,
      progress: this.getProgressPercent()
    }
  }

  /**
   * Calculate overall progress percentage
   */
  getProgressPercent() {
    const totalGoals = this.tiers.reduce((sum, tier) => sum + tier.goals.length, 0)
    return Math.round((this.completedGoals.size / totalGoals) * 100)
  }
}
