export class AgentCoordinator {
  constructor({
    engines,
    goalManager,
    planner,
    knowledgeGraph,
    skills,
    survival,
    learning,
    reflection
  } = {}) {
    this.engines = engines
    this.goalManager = goalManager
    this.planner = planner
    this.knowledgeGraph = knowledgeGraph
    this.skills = skills
    this.survival = survival
    this.learning = learning
    this.reflection = reflection
    this.activeAgent = 'Coordinator'
  }

  selectAgent(intent) {
    if (/protect|attack|combat|guard/.test(intent)) return 'Combat Agent'
    if (/mine|gather|wood|stone|iron|diamond|resource/.test(intent)) return 'Mining Agent'
    if (/build|place|house|base|farm/.test(intent)) return 'Builder Agent'
    if (/explore|cave|find/.test(intent)) return 'Explorer Agent'
    if (/eat|sleep|survive|food/.test(intent)) return 'Survival Agent'
    return 'Coordinator'
  }

  async runIntent(intent, args = {}, context = {}) {
    const name = String(intent || '').toLowerCase()
    this.activeAgent = this.selectAgent(name)
    const survivalResult = await this.survival?.overrideIfNeeded?.(context)
    if (survivalResult) return survivalResult

    const plan = this.expandPlanWithPreflight(
      this.planner.plan({ name, args, ...context }),
      args,
      context
    )
    let lastResult = { ok: true }
    for (const step of plan) {
      if (this.stepAlreadySatisfied(step, context)) {
        lastResult = { ok: true, skipped: true, reason: 'already_available', skill: step.skill }
        continue
      }
      lastResult = await this.skills.execute(
        step.skill,
        { ...args, ...step.args },
        { ...context, agent: this.activeAgent, plan }
      )
      this.learning?.collectExperience?.(step, context, lastResult)
      if (!lastResult?.ok) {
        this.reflection?.reflect?.('skill_failed', lastResult)
        return lastResult
      }
    }
    return lastResult
  }

  expandPlanWithPreflight(plan = [], args = {}, context = {}) {
    const inventory = this.inventory(context)
    const buildBlocks = inventory
      .filter((item) => /dirt|cobblestone|stone|planks|deepslate|netherrack/.test(item.name))
      .reduce((sum, item) => sum + Number(item.count || 0), 0)
    const expanded = []
    for (const step of plan) {
      if ((step.skill === 'build_house' || step.skill === 'build_structure') && buildBlocks < 16) {
        expanded.push({
          skill: 'gather_resource',
          args: { resource: args.block || 'dirt', count: 24, range: 64 },
          success: 'build material available'
        })
      }
      if (
        step.skill === 'craft_item' &&
        step.args?.item &&
        !this.hasAnyCraftInput(step.args.item, inventory)
      ) {
        expanded.push(...this.materialStepsForCraft(step.args.item))
      }
      if (
        (step.skill === 'explore_cave' || step.skill === 'explore') &&
        /cave|mine|maden/i.test(step.args?.reason || args.reason || step.skill)
      ) {
        const hasPickaxe = inventory.some((item) => /pickaxe/.test(item.name))
        if (!hasPickaxe)
          expanded.push(
            ...(this.planner?.stepsFromGoal?.('wooden_pickaxe', {
              observation: context.observation
            }) || [])
          )
      }
      expanded.push(step)
    }
    return expanded
  }

  inventory(context = {}) {
    return (
      context.observation?.world?.inventory || context.observation?.local?.inventorySummary || []
    )
  }

  itemCount(context, target) {
    const normalized = String(target || '').toLowerCase()
    return this.inventory(context)
      .filter((item) => item.name === normalized || item.name.includes(normalized))
      .reduce((sum, item) => sum + Number(item.count || 0), 0)
  }

  stepAlreadySatisfied(step, context) {
    const target = step.args?.resource || step.args?.target || step.args?.item
    if (!target) return false
    if (step.skill === 'gather_wood')
      return this.inventory(context).some((item) => /log|planks/.test(item.name))
    if (step.skill === 'gather_resource') return this.itemCount(context, target) > 0
    if (step.skill === 'craft_item') return this.itemCount(context, target) > 0
    return false
  }

  hasAnyCraftInput(item, inventory) {
    const target = String(item || '').toLowerCase()
    const requirements =
      this.knowledgeGraph?.solutions?.(target)?.flatMap((solution) => solution.requires || []) || []
    if (requirements.length) {
      return requirements.some(
        (requirement) =>
          this.itemCount({ observation: { world: { inventory } } }, requirement.item) >=
          requirement.count
      )
    }
    if (target.includes('plank')) return inventory.some((entry) => /log/.test(entry.name))
    if (target.includes('stick')) return inventory.some((entry) => /planks/.test(entry.name))
    if (target.includes('crafting_table'))
      return inventory.some((entry) => /planks|log/.test(entry.name))
    if (target.includes('pickaxe'))
      return inventory.some((entry) =>
        /planks|stick|cobblestone|iron_ingot|diamond/.test(entry.name)
      )
    return true
  }

  materialStepsForCraft(item) {
    const target = String(item || '').toLowerCase()
    const graphSteps = this.planner?.stepsFromGoal?.(target, {}) || []
    if (graphSteps.length > 1) return graphSteps.slice(0, -1)
    if (target.includes('plank') || target.includes('crafting_table') || target.includes('stick')) {
      return [{ skill: 'gather_wood', args: { count: 1, range: 96 }, success: 'wood available' }]
    }
    if (target.includes('stone') || target.includes('pickaxe')) {
      return [
        { skill: 'gather_wood', args: { count: 1, range: 96 }, success: 'wood available' },
        {
          skill: 'gather_resource',
          args: { resource: 'stone', count: 3, range: 64 },
          success: 'stone available'
        }
      ]
    }
    return []
  }

  status() {
    return { activeAgent: this.activeAgent }
  }
}
