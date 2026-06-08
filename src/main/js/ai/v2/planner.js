import { normalizeName } from './utils'

export class Planner {
  constructor({ brain, knowledgeGraph } = {}) {
    this.brain = brain
    this.knowledgeGraph = knowledgeGraph
  }

  plan(goal) {
    const name = normalizeName(goal?.name || goal?.intent || goal)
    const graphTarget = this.goalTarget(name)
    if (this.knowledgeGraph?.node?.(graphTarget)) {
      const graphPlan = this.stepsFromGoal(name, goal)
      if (graphPlan.length) return graphPlan
    }

    const progression = this.brain?.resolveProgression?.(name) || []
    if (progression.length) return this.stepsFromProgression(name, progression)

    if (name.includes('wood')) return this.stepsFromProgression(name, ['gather_wood'])
    if (name.includes('follow'))
      return [
        { skill: 'follow_player', args: goal.args || {}, success: 'distance_to_player <= near' }
      ]
    if (name.includes('protect'))
      return [
        {
          skill: 'protect_player',
          args: goal.args || {},
          success: 'threat neutralized or player safe'
        }
      ]

    return [{ skill: name, args: goal.args || {}, success: 'skill reports ok' }]
  }

  stepsFromProgression(goal, entries) {
    return entries.flatMap((entry) => {
      const [skill, target] = String(entry).split(':')
      const nested = !target ? this.brain?.resolveProgression?.(skill) || [] : []
      if (nested.length) return this.stepsFromProgression(skill, nested)
      return {
        skill,
        args: target ? { target, item: target, resource: target } : {},
        dependencies: this.knowledgeGraph?.dependencies?.(target || skill) || [],
        success: 'verified by engine'
      }
    })
  }

  canPlan(goal) {
    const name = normalizeName(goal?.name || goal?.intent || goal)
    return Boolean(
      this.knowledgeGraph?.node?.(name) || this.brain?.resolveProgression?.(name)?.length
    )
  }

  stepsFromGoal(goal, root = {}, seen = new Set()) {
    const target = this.goalTarget(goal)
    if (!target || seen.has(target)) return []
    const node = this.knowledgeGraph?.node?.(target)
    if (!node) return this.terminalStep(target, root)

    const nextSeen = new Set(seen)
    nextSeen.add(target)
    const solution = this.selectSolution(target, root)
    if (!solution) return []

    const steps = []
    const batches = Math.max(
      1,
      Math.ceil(Number(root.requiredCount || 1) / Number(solution.produces || 1))
    )
    for (const requirement of solution.requires || []) {
      const count = requirement.scale
        ? requirement.count * Number(root.requiredCount || 1)
        : requirement.count * (solution.scaleRequirements ? batches : 1)
      steps.push(
        ...this.stepsFromGoal(requirement.item, { ...root, requiredCount: count }, nextSeen)
      )
    }
    if (solution.action?.skill) {
      const producedCount = Number(solution.action.args?.count || 1)
      const desiredCount = Number(root.requiredCount || 1)
      const actionCount =
        desiredCount > producedCount
          ? Math.ceil(desiredCount / producedCount) * producedCount
          : producedCount
      steps.push({
        skill: solution.action.skill,
        args: {
          ...(solution.action.args || {}),
          ...(root.requiredCount ? { count: actionCount } : {})
        },
        dependencies: (solution.requires || []).map((requirement) => requirement.item),
        strategy: solution.name,
        score: this.scoreSolution(solution, root),
        success: 'verified by engine'
      })
    }
    return this.dedupeSteps(steps)
  }

  goalTarget(goal) {
    const key = normalizeName(goal)
    if (key.startsWith('obtain_')) return key.replace(/^obtain_/, '')
    if (key.startsWith('get_')) return key.replace(/^get_/, '')
    return key
  }

  selectSolution(target, context = {}) {
    const solutions = this.knowledgeGraph?.solutions?.(target) || []
    return [...solutions].sort(
      (a, b) => this.scoreSolution(b, context) - this.scoreSolution(a, context)
    )[0]
  }

  scoreSolution(solution, context = {}) {
    const inventory = this.inventory(context)
    const availableRequirements = (solution.requires || []).filter((requirement) =>
      this.hasItem(inventory, requirement.item)
    ).length
    const risk = Number(solution.risk || 0)
    const time = Number(solution.time || 0)
    const efficiency = Number(solution.efficiency || 0)
    return efficiency * 3 + availableRequirements * 4 - risk * 2 - time
  }

  inventory(context = {}) {
    return (
      context.observation?.world?.inventory || context.observation?.local?.inventorySummary || []
    )
  }

  hasItem(inventory, target) {
    const key = normalizeName(target)
    return inventory.some(
      (item) => normalizeName(item.name) === key || normalizeName(item.name).includes(key)
    )
  }

  terminalStep(target, root = {}) {
    const key = normalizeName(target)
    if (!key) return []
    if (/log|wood/.test(key))
      return [
        {
          skill: 'gather_wood',
          args: { count: root.requiredCount || 1, range: 96 },
          success: 'wood available'
        }
      ]
    if (/planks|stick|table|pickaxe|furnace/.test(key)) {
      return [
        {
          skill: 'craft_item',
          args: { item: key, count: root.requiredCount || 1 },
          success: `${key} crafted`
        }
      ]
    }
    if (/iron_ingot/.test(key)) return this.stepsFromGoal('iron_ingot', root)
    return [
      {
        skill: 'gather_resource',
        args: { resource: key, count: root.requiredCount || 1, range: 96 },
        success: `${key} available`
      }
    ]
  }

  dedupeSteps(steps) {
    const merged = []
    const seen = new Map()
    for (const step of steps) {
      const key = `${step.skill}:${step.args?.item || step.args?.resource || step.args?.reason || step.strategy || ''}`
      const existingIndex = seen.get(key)
      if (existingIndex === undefined) {
        seen.set(key, merged.length)
        merged.push(step)
        continue
      }
      const existing = merged[existingIndex]
      const currentCount = Number(step.args?.count || 0)
      const existingCount = Number(existing.args?.count || 0)
      if (currentCount || existingCount) {
        existing.args = {
          ...existing.args,
          count: existingCount + currentCount
        }
      }
    }
    return merged
  }
}
