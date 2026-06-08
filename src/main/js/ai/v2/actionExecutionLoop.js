import { now } from './utils'

/**
 * Action Execution Loop
 *
 * Core execution pattern: Execute → Verify → Recover → Remember
 *
 * Ensures deterministic, recoverable action execution with learning.
 */
export class ActionExecutionLoop {
  constructor({ skillRegistry, reflection, memory, learning, maxRetries = 3 } = {}) {
    this.skillRegistry = skillRegistry
    this.reflection = reflection
    this.memory = memory
    this.learning = learning
    this.maxRetries = maxRetries
    this.executionHistory = []
  }

  /**
   * Execute an action with full feedback loop
   *
   * Flow:
   * 1. EXECUTE - Attempt skill
   * 2. VERIFY - Check if successful
   * 3. RECOVER - If failed, try alternative
   * 4. RETRY - Up to maxRetries
   * 5. REMEMBER - Log outcome for learning
   *
   * @param {string} skillName - Skill to execute
   * @param {Object} args - Skill arguments
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async execute(skillName, args = {}, context = {}) {
    const executionId = `exec_${now()}_${Math.random().toString(36).slice(2, 9)}`
    const startTime = Date.now()

    const execution = {
      id: executionId,
      skill: skillName,
      args,
      startTime,
      attempts: 0,
      status: 'pending',
      history: []
    }

    try {
      // Phase 1: EXECUTE with retries
      let result
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        execution.attempts = attempt

        // Execute skill
        const attemptStart = Date.now()
        result = await this.skillRegistry.execute(skillName, args, context)
        const attemptDuration = Date.now() - attemptStart

        execution.history.push({
          attempt,
          startedAt: attemptStart,
          duration: attemptDuration,
          status: result?.ok ? 'success' : 'failed',
          reason: result?.reason || result?.error,
          result
        })

        // Phase 2: VERIFY
        if (result?.ok) {
          execution.status = 'success'
          break
        }

        // If not success, Phase 3: RECOVER
        if (attempt < this.maxRetries) {
          const recovery = await this.attemptRecovery(skillName, args, result, context)
          if (recovery?.recovered) {
            result = recovery
            execution.history[execution.history.length - 1].recovery = recovery
            if (result?.ok) {
              execution.status = 'success_recovered'
              break
            }
          }
        } else {
          execution.status = 'failed'
        }
      }

      // Phase 4: REMEMBER - Record experience
      const finalResult = this.recordExecution(execution, result, context)

      // If failed, trigger reflection
      if (!result?.ok) {
        this.reflection?.reflect?.('skill_failed', {
          skill: skillName,
          reason: result?.reason,
          attempts: execution.attempts,
          execution
        })
      }

      return finalResult
    } catch (error) {
      execution.status = 'error'
      execution.error = error.message

      this.recordExecution(execution, { ok: false, error: error.message }, context)
      this.reflection?.reflect?.('execution_error', {
        skill: skillName,
        error: error.message
      })

      return {
        ok: false,
        reason: `execution_error: ${error.message}`,
        skill: skillName,
        execution
      }
    } finally {
      execution.endTime = Date.now()
      execution.duration = execution.endTime - execution.startTime

      // Store in history
      this.executionHistory.unshift(execution)
      if (this.executionHistory.length > 1000) this.executionHistory.pop()

      this.memory?.setWorking?.('lastExecution', execution)
    }
  }

  /**
   * Attempt recovery from failure
   *
   * Strategies:
   * 1. Try again (sometimes transient)
   * 2. Try alternative skill with same goal
   * 3. Reset context and retry
   * 4. Abandon and report
   */
  async attemptRecovery(skillName, args, failureResult, context) {
    const reason = String(failureResult?.reason || '').toLowerCase()

    // Strategy 1: Transient failures - try again
    if (reason.includes('timeout') || reason.includes('busy')) {
      await this.delay(500)
      return { recovered: true, strategy: 'retry_after_delay' }
    }

    // Strategy 2: Missing prerequisites
    if (reason.includes('missing') || reason.includes('prerequisite')) {
      const recovery = await this.resolvePrerequisites(skillName, args, context)
      if (recovery.ok) {
        return { recovered: true, strategy: 'resolved_prerequisites' }
      }
    }

    // Strategy 3: Path/movement issues
    if (reason.includes('path') || reason.includes('stuck') || reason.includes('blocked')) {
      await this.delay(1000)
      return { recovered: true, strategy: 'reset_pathfinding' }
    }

    // Strategy 4: Threat detected
    if (reason.includes('threat') || reason.includes('mob')) {
      return { recovered: false, strategy: 'threat_requires_combat' }
    }

    return { recovered: false }
  }

  /**
   * Resolve missing prerequisites
   */
  async resolvePrerequisites(skillName, args, context) {
    // Check what's missing
    const missing = this.identifyMissing(skillName, args, context)

    if (missing.length === 0) {
      return { ok: true, reason: 'nothing_missing' }
    }

    // Try to acquire first missing item
    const item = missing[0]
    const acquireSkill = this.getAcquisitionSkill(item)

    if (!acquireSkill) {
      return { ok: false, reason: `cannot_acquire_${item}` }
    }

    // Execute acquisition skill
    const acquisitionResult = await this.skillRegistry.execute(
      acquireSkill,
      { target: item },
      context
    )

    return acquisitionResult
  }

  /**
   * Identify what's missing for a skill
   */
  identifyMissing(skillName, args, context) {
    // This would be expanded based on skill registry definitions
    // For now, check inventory against known requirements

    const requirements = this.getSkillRequirements(skillName)
    const inventory = context?.inventory || []
    const missing = []

    for (const req of requirements) {
      const has = inventory.find((i) => i.name?.includes(req))
      if (!has) {
        missing.push(req)
      }
    }

    return missing
  }

  /**
   * Get requirements for a skill
   */
  getSkillRequirements(skillName) {
    const skillMap = {
      mine_ore: ['pickaxe'],
      craft_item: ['crafting_table'],
      smelt_item: ['furnace'],
      harvest_tree: [], // No requirements
      attack_target: ['sword'], // Optional but better with
      build_structure: ['blocks']
    }

    return skillMap[skillName] || []
  }

  /**
   * Get skill to acquire item
   */
  getAcquisitionSkill(item) {
    const acquisitionMap = {
      crafting_table: 'craft_item',
      furnace: 'craft_item',
      pickaxe: 'craft_item',
      wood: 'harvest_tree',
      stone: 'mine_ore',
      coal: 'mine_ore'
    }

    return acquisitionMap[item]
  }

  /**
   * Record execution for learning
   */
  recordExecution(execution, result, context) {
    const experience = {
      timestamp: execution.startTime,
      skill: execution.skill,
      arguments: execution.args,
      attempts: execution.attempts,
      duration: execution.duration,
      status: execution.status,
      success: result?.ok === true,
      outcome: result,
      context: {
        health: context.health,
        food: context.food,
        inventory: context.inventory?.length,
        threats: context.threats?.length,
        location: context.position
      }
    }

    // Record in learning system
    this.learning?.collectExperience?.(experience)
    this.memory?.recordExperience?.(experience)

    return {
      ...result,
      execution: {
        id: execution.id,
        skill: execution.skill,
        attempts: execution.attempts,
        duration: execution.duration,
        status: execution.status
      }
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get execution statistics
   */
  getStats() {
    if (this.executionHistory.length === 0) {
      return { executions: 0 }
    }

    const successful = this.executionHistory.filter(
      (e) => e.status === 'success' || e.status === 'success_recovered'
    )
    const failed = this.executionHistory.filter((e) => e.status === 'failed')
    const errors = this.executionHistory.filter((e) => e.status === 'error')

    return {
      executions: this.executionHistory.length,
      successful: successful.length,
      failed: failed.length,
      errors: errors.length,
      successRate: successful.length / this.executionHistory.length,
      recovered: successful.filter((e) => e.status === 'success_recovered').length,
      avgAttempts:
        this.executionHistory.reduce((sum, e) => sum + e.attempts, 0) /
        this.executionHistory.length,
      avgDuration:
        this.executionHistory.reduce((sum, e) => sum + e.duration, 0) /
        this.executionHistory.length,
      skillBreakdown: this.getSkillBreakdown()
    }
  }

  /**
   * Get breakdown by skill
   */
  getSkillBreakdown() {
    const breakdown = {}

    for (const exec of this.executionHistory) {
      if (!breakdown[exec.skill]) {
        breakdown[exec.skill] = { total: 0, success: 0, failed: 0, avgDuration: 0 }
      }

      breakdown[exec.skill].total++
      if (exec.status === 'success' || exec.status === 'success_recovered') {
        breakdown[exec.skill].success++
      } else {
        breakdown[exec.skill].failed++
      }

      breakdown[exec.skill].avgDuration =
        (breakdown[exec.skill].avgDuration * (breakdown[exec.skill].total - 1) + exec.duration) /
        breakdown[exec.skill].total
    }

    return breakdown
  }

  /**
   * Get recent executions
   */
  recent(limit = 10) {
    return this.executionHistory.slice(0, limit).map((e) => ({
      skill: e.skill,
      status: e.status,
      attempts: e.attempts,
      duration: e.duration,
      reason: e.history[e.history.length - 1]?.reason
    }))
  }
}
