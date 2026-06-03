export class MiningEngine {
  constructor({ skills, brain } = {}) {
    this.skills = skills
    this.brain = brain
  }

  async gather(resource, args = {}, context = {}) {
    const plan = this.plan(resource, args, context)
    return this.skills.execute('gather_resource', { ...args, ...plan }, context)
  }

  plan(resource = 'ore', args = {}, context = {}) {
    const normalized = this.brain?.normalizeMiningResource?.(resource || args.resource || args.target) || resource
    const requiredTool = this.brain?.requiredToolFor?.(normalized)
    const ore = this.brain?.oreProfile?.(normalized)
    const inventory = context.observation?.world?.inventory || context.observation?.local?.inventorySummary || undefined
    const readiness = ore ? this.brain?.canMineOre?.(ore, inventory) : this.brain?.miningReadiness?.(normalized, inventory)
    return {
      resource: normalized,
      requiredTool,
      ore,
      readiness,
      prerequisiteGoal: readiness?.ok === false ? readiness.prerequisiteGoal : undefined,
      blocks: this.brain?.oreBlockNames?.(normalized) || [normalized],
      strategy: ore ? 'ore_catalog_guided_mining' : 'semantic_resource_mining'
    }
  }

  catalog() {
    return this.brain?.oreCatalog || {}
  }

  readiness(resource = 'ore', context = {}) {
    const inventory = context.observation?.world?.inventory || context.observation?.local?.inventorySummary || undefined
    return this.brain?.miningReadiness?.(resource, inventory)
  }
}
