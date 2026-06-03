import path from 'node:path'
import { MemorySystem } from './memorySystem'
import { WorldModel } from './worldModel'
import { SpatialReasoningLayer } from './spatialReasoning'
import { LocalWorldSnapshotSystem } from './localWorldSnapshot'
import { MinecraftBrain } from './minecraftBrain'
import { KnowledgeGraph } from './knowledgeGraph'
import { GoalManager } from './goalManager'
import { Planner } from './planner'
import { SkillRegistry } from './skillRegistry'
import { SurvivalEngine } from './engines/survivalEngine'
import { MiningEngine } from './engines/miningEngine'
import { CraftingEngine } from './engines/craftingEngine'
import { CombatEngine } from './engines/combatEngine'
import { BuildingEngine } from './engines/buildingEngine'
import { ExplorationEngine } from './engines/explorationEngine'
import { ReflectionEngine } from './reflectionEngine'
import { LearningInterface } from './learningInterface'
import { RLInterface } from './rlInterface'
import { AgentCoordinator } from './agentCoordinator'

export class TrafficerAIV2Runtime {
  constructor({ bot, mobility, memory, adapters = {}, sendEvent } = {}) {
    this.bot = bot
    this.mobility = mobility
    this.sendEvent = sendEvent
    this.memory = new MemorySystem({
      memory,
      basePath: path.join(process.cwd(), 'trafficer-ai-v2-memory.json')
    })
    this.worldModel = new WorldModel({ bot, memory: this.memory })
    this.spatialReasoning = new SpatialReasoningLayer({ bot, mobility })
    this.snapshotSystem = new LocalWorldSnapshotSystem({ bot, spatialReasoning: this.spatialReasoning })
    this.brain = new MinecraftBrain({ bot })
    this.knowledgeGraph = new KnowledgeGraph({ brain: this.brain })
    this.goalManager = new GoalManager({ knowledgeGraph: this.knowledgeGraph })
    this.planner = new Planner({ brain: this.brain, knowledgeGraph: this.knowledgeGraph })
    this.skills = new SkillRegistry()
    this.registerCoreSkills(adapters)
    this.engines = {
      survival: new SurvivalEngine({ bot, skills: this.skills }),
      mining: new MiningEngine({ skills: this.skills, brain: this.brain }),
      crafting: new CraftingEngine({ skills: this.skills, knowledgeGraph: this.knowledgeGraph }),
      combat: new CombatEngine({ skills: this.skills }),
      building: new BuildingEngine({ skills: this.skills }),
      exploration: new ExplorationEngine({ skills: this.skills })
    }
    this.reflection = new ReflectionEngine({ memory: this.memory })
    this.learning = new LearningInterface({ memory: this.memory })
    this.rl = new RLInterface({ learning: this.learning })
    this.coordinator = new AgentCoordinator({
      engines: this.engines,
      goalManager: this.goalManager,
      planner: this.planner,
      knowledgeGraph: this.knowledgeGraph,
      skills: this.skills,
      survival: this.engines.survival,
      learning: this.rl,
      reflection: this.reflection
    })
  }

  registerCoreSkills(adapters = {}) {
    const register = (name, description, execute) => {
      this.skills.register({ name, description, execute: execute || (() => ({ ok: false, reason: `adapter_missing:${name}` })) })
    }
    register('come_to_player', 'Move near a player using Mobility Engine.', adapters.comeToPlayer)
    register('follow_player', 'Continuously follow a player using Mobility Engine.', adapters.followPlayer || adapters.comeToPlayer)
    register('protect_player', 'Protect a player using Combat Engine.', adapters.protectPlayer)
    register('gather_wood', 'Find and gather nearby wood.', adapters.gatherWood)
    register('gather_resource', 'Find and gather a semantic resource.', adapters.gatherResource)
    register('craft_item', 'Craft an item by recipe lookup.', adapters.craftItem)
    register('smelt_item', 'Smelt available resource.', adapters.smeltItem)
    register('eat_food', 'Eat food when hungry.', adapters.eatFood)
    register('sleep', 'Sleep in nearest bed.', adapters.sleep)
    register('explore', 'Explore nearby area.', adapters.explore)
    register('explore_cave', 'Explore for cave entrances.', adapters.exploreCave || adapters.explore)
    register('give_items', 'Give inventory items to a player.', adapters.giveItems)
    register('make_crafting_table_for_player', 'Gather wood, craft table, and give it to player.', adapters.makeCraftingTableForPlayer)
    register('build_structure', 'Build a structure template.', adapters.buildStructure)
    register('build_house', 'Build a starter house template.', adapters.buildHouse || adapters.buildStructure)
    register('farm_crop', 'Farm or harvest crops.', adapters.farmCrop)
    register('trade_villager', 'Trade with a villager.', adapters.tradeVillager)
  }

  observe(context = {}) {
    return {
      world: this.worldModel.observe(),
      local: this.snapshotSystem.snapshot(context)
    }
  }

  async executeIntent(intent, args = {}, context = {}) {
    const observation = this.observe({ goal: intent, recentFailures: this.memory.state.longTerm.failures })
    const result = await this.coordinator.runIntent(intent, args, { ...context, observation })
    if (result?.ok) this.memory.rememberSuccess(`intent:${intent}`, { args })
    else this.memory.rememberFailure(`intent:${intent}`, { args, reason: result?.reason })
    return result
  }

  status() {
    return {
      version: 'TrafficerAI v2',
      memory: this.memory.summary(),
      worldModel: this.worldModel.status(),
      brain: this.brain.status(),
      knowledgeGraph: this.knowledgeGraph.status(),
      goals: this.goalManager.status(),
      skills: this.skills.list().map((skill) => skill.name),
      coordinator: this.coordinator.status(),
      rl: this.rl.status()
    }
  }
}

export function createTrafficerAIV2Runtime(options) {
  return new TrafficerAIV2Runtime(options)
}
