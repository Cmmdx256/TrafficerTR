import { normalizeName } from './utils'

export class KnowledgeGraph {
  constructor({ brain } = {}) {
    this.brain = brain
    this.edges = new Map()
    this.nodes = new Map()
    this.seed()
  }

  seed() {
    this.define('diamond', {
      aliases: ['obtain_diamond'],
      solutions: [
        {
          name: 'mine_diamond_ore',
          requires: ['iron_pickaxe'],
          action: { skill: 'gather_resource', args: { resource: 'diamond', count: 1, range: 96 } },
          risk: 7,
          time: 9,
          efficiency: 8
        },
        {
          name: 'search_structure_loot',
          requires: ['food'],
          action: { skill: 'explore', args: { reason: 'search diamond loot structures' } },
          risk: 6,
          time: 10,
          efficiency: 3
        }
      ]
    })
    this.define('iron_pickaxe', {
      solutions: [
        {
          name: 'craft_iron_pickaxe',
          requires: ['iron_ingot:3', 'stick:2', 'crafting_table'],
          action: { skill: 'craft_item', args: { item: 'iron_pickaxe', count: 1 } },
          risk: 2,
          time: 3,
          efficiency: 9
        }
      ]
    })
    this.define('iron_ingot', {
      aliases: ['iron'],
      solutions: [
        {
          name: 'smelt_raw_iron',
          requires: [{ item: 'raw_iron', count: 1, scale: true }, 'furnace', 'fuel'],
          action: { skill: 'smelt_item', args: { item: 'raw_iron', output: 'iron_ingot' } },
          risk: 3,
          time: 5,
          efficiency: 9
        },
        {
          name: 'loot_iron',
          requires: ['food'],
          action: { skill: 'explore', args: { reason: 'search iron loot' } },
          risk: 5,
          time: 8,
          efficiency: 4
        }
      ]
    })
    this.define('raw_iron', {
      solutions: [
        {
          name: 'mine_iron_ore',
          requires: ['stone_pickaxe'],
          action: { skill: 'gather_resource', args: { resource: 'iron', range: 96 } },
          risk: 4,
          time: 6,
          efficiency: 8
        }
      ]
    })
    this.define('furnace', {
      solutions: [
        {
          name: 'craft_furnace',
          requires: ['cobblestone:8', 'crafting_table'],
          action: { skill: 'craft_item', args: { item: 'furnace', count: 1 } },
          risk: 1,
          time: 3,
          efficiency: 9
        }
      ]
    })
    this.define('stone_pickaxe', {
      solutions: [
        {
          name: 'craft_stone_pickaxe',
          requires: ['cobblestone:3', 'stick:2', 'crafting_table'],
          action: { skill: 'craft_item', args: { item: 'stone_pickaxe', count: 1 } },
          risk: 1,
          time: 3,
          efficiency: 9
        }
      ]
    })
    this.define('wooden_pickaxe', {
      solutions: [
        {
          name: 'craft_wooden_pickaxe',
          requires: ['planks:3', 'stick:2', 'crafting_table'],
          action: { skill: 'craft_item', args: { item: 'wooden_pickaxe', count: 1 } },
          risk: 1,
          time: 2,
          efficiency: 7
        }
      ]
    })
    this.define('crafting_table', {
      solutions: [
        {
          name: 'craft_crafting_table',
          requires: ['planks:4'],
          action: { skill: 'craft_item', args: { item: 'crafting_table', count: 1 } },
          risk: 0,
          time: 1,
          efficiency: 10
        }
      ]
    })
    this.define('stick', {
      solutions: [
        {
          name: 'craft_sticks',
          requires: ['planks:2'],
          action: { skill: 'craft_item', args: { item: 'stick', count: 4 } },
          risk: 0,
          time: 1,
          efficiency: 10
        }
      ]
    })
    this.define('planks', {
      aliases: ['oak_planks'],
      solutions: [
        {
          name: 'craft_planks',
          requires: ['log'],
          action: { skill: 'craft_item', args: { item: 'planks', count: 4 } },
          risk: 0,
          time: 1,
          efficiency: 10
        }
      ]
    })
    this.define('cobblestone', {
      aliases: ['stone'],
      solutions: [
        {
          name: 'mine_stone',
          requires: ['wooden_pickaxe'],
          action: { skill: 'gather_resource', args: { resource: 'stone', range: 64 } },
          risk: 1,
          time: 3,
          efficiency: 9
        }
      ]
    })
    this.define('fuel', {
      solutions: [
        {
          name: 'mine_coal',
          requires: ['wooden_pickaxe'],
          action: { skill: 'gather_resource', args: { resource: 'coal', count: 1, range: 96 } },
          risk: 2,
          time: 4,
          efficiency: 8
        },
        {
          name: 'use_planks_as_fuel',
          requires: ['planks'],
          action: { skill: 'gather_wood', args: { count: 1, range: 96 } },
          risk: 1,
          time: 2,
          efficiency: 5
        },
        {
          name: 'make_charcoal',
          requires: ['log', 'furnace', 'fuel'],
          action: { skill: 'smelt_item', args: { item: 'log', output: 'charcoal' } },
          risk: 1,
          time: 5,
          efficiency: 6
        }
      ]
    })
    this.define('food', {
      solutions: [
        {
          name: 'hunt_animals',
          action: { skill: 'gather_resource', args: { resource: 'food', count: 3, range: 96 } },
          risk: 3,
          time: 4,
          efficiency: 7
        },
        {
          name: 'farm_crops',
          action: { skill: 'farm_crop', args: { crop: 'wheat', range: 96 } },
          risk: 1,
          time: 7,
          efficiency: 6
        },
        {
          name: 'fish',
          action: { skill: 'gather_resource', args: { resource: 'fish', count: 3, range: 96 } },
          risk: 1,
          time: 8,
          efficiency: 4
        }
      ]
    })
    this.define('log', {
      aliases: ['wood'],
      solutions: [
        {
          name: 'chop_tree',
          action: { skill: 'gather_wood', args: { count: 1, range: 96 } },
          risk: 1,
          time: 2,
          efficiency: 10
        }
      ]
    })
  }

  define(target, definition = {}) {
    const key = normalizeName(target)
    const normalized = {
      ...definition,
      name: key,
      aliases: (definition.aliases || []).map((alias) => normalizeName(alias)),
      solutions: (definition.solutions || []).map((solution) => ({
        ...solution,
        requires: (solution.requires || []).map((requirement) => this.parseRequirement(requirement))
      }))
    }
    this.nodes.set(key, normalized)
    for (const alias of normalized.aliases) this.nodes.set(alias, normalized)
    for (const solution of normalized.solutions) {
      for (const requirement of solution.requires) this.add(key, requirement.item)
    }
  }

  parseRequirement(requirement) {
    if (typeof requirement === 'object') {
      return {
        item: normalizeName(requirement.item || requirement.name),
        count: Number(requirement.count || 1),
        scale: Boolean(requirement.scale)
      }
    }
    const [item, count] = String(requirement).split(':')
    return { item: normalizeName(item), count: Number(count || 1), scale: false }
  }

  add(target, dependency) {
    const key = normalizeName(target)
    if (!this.edges.has(key)) this.edges.set(key, new Set())
    this.edges.get(key).add(normalizeName(dependency))
  }

  node(target) {
    const key = normalizeName(target)
    const existing = this.nodes.get(key)
    if (existing) return existing
    const dynamic = this.brain?.dynamicDefinition?.(key)
    if (!dynamic) return undefined
    this.define(dynamic.name || key, dynamic)
    return this.nodes.get(key) || this.nodes.get(normalizeName(dynamic.name || key))
  }

  solutions(target) {
    return this.node(target)?.solutions || []
  }

  dependencies(target, seen = new Set()) {
    const key = this.node(target)?.name || normalizeName(target)
    if (seen.has(key)) return []
    seen.add(key)
    const direct = Array.from(this.edges.get(key) || [])
    return direct.flatMap((dependency) => [dependency, ...this.dependencies(dependency, seen)])
  }

  explain(target) {
    const node = this.node(target)
    return {
      target: normalizeName(target),
      dependencies: this.dependencies(target),
      solutions: (node?.solutions || []).map((solution) => ({
        name: solution.name,
        requires: solution.requires,
        risk: solution.risk || 0,
        time: solution.time || 0,
        efficiency: solution.efficiency || 0
      }))
    }
  }

  status() {
    return { nodes: this.nodes.size, dependencyEdges: this.edges.size, dynamic: Boolean(this.brain?.dynamicDefinition) }
  }
}
