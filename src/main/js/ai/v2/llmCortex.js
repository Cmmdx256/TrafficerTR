import { normalizeName, now } from './utils'

/**
 * LLM Cortex - Strategic Decision Making
 *
 * Responsibility: "What should I do next?"
 * NEVER: "How should I do it?"
 *
 * The LLM only decides INTENT.
 * The system executes HOW.
 */
export class LLMCortex {
  constructor({ llmProvider, curriculum, memory, worldModel, reflection } = {}) {
    this.llmProvider = llmProvider
    this.curriculum = curriculum
    this.memory = memory
    this.worldModel = worldModel
    this.reflection = reflection
    this.lastIntentAt = 0
    this.intentBuffer = []
    this.debounceMs = 3000
  }

  /**
   * Generate next strategic intent based on world state
   *
   * @param {Object} context - Current game state
   * @returns {Promise<Object>} Intent: { intent, reason, priority, parameters }
   */
  async generateIntent(context = {}) {
    const now_ms = now()
    if (now_ms - this.lastIntentAt < this.debounceMs) {
      return this.intentBuffer[0] || { intent: 'idle', reason: 'debounced' }
    }

    const snapshot = this.buildSnapshot(context)
    const prompt = this.buildPrompt(snapshot)

    try {
      const response = await this.callLLM(prompt)
      const intent = this.parseIntent(response)

      this.lastIntentAt = now_ms
      this.intentBuffer.unshift(intent)
      if (this.intentBuffer.length > 10) this.intentBuffer.pop()

      this.memory?.setWorking?.('lastIntent', intent)
      return intent
    } catch (error) {
      console.error('LLM Cortex error:', error.message)
      return this.fallbackIntent(context)
    }
  }

  /**
   * Build compact world snapshot for LLM context
   */
  buildSnapshot(context = {}) {
    const inventory = context.inventory || []
    const threats = context.threats || []
    const health = context.health || 20
    const food = context.food || 20
    const position = context.position || { x: 0, y: 64, z: 0 }

    const critical = {
      health: health <= 8,
      food: food <= 4,
      threatening: threats.length > 0 && threats[0].distance < 10
    }

    return {
      position,
      health,
      food,
      inventory: this.compactInventory(inventory),
      threats: threats.slice(0, 3).map((t) => ({ name: t.name, distance: t.distance })),
      nearbyResources: context.nearbyResources || [],
      utilities: context.utilities || [],
      currentGoal: this.memory?.getWorking?.('currentGoal'),
      recentFailures: this.memory?.state?.longTerm?.failures?.slice(-3) || [],
      recentSuccesses: this.memory?.state?.longTerm?.successes?.slice(-3) || [],
      lessons: this.memory?.state?.longTerm?.lessons?.slice(-3) || [],
      knownLocations: Object.keys(this.memory?.state?.longTerm?.knownLocations || {}).slice(0, 5),
      critical,
      availableGoals: this.curriculum?.nextTiers?.() || [],
      timeElapsed: context.timeElapsed || 0
    }
  }

  /**
   * Build LLM prompt
   */
  buildPrompt(snapshot) {
    const urgency = this.assessUrgency(snapshot)

    const prompt = `You are an autonomous Minecraft agent making strategic decisions.

CURRENT STATE:
Position: [${Math.floor(snapshot.position.x)}, ${Math.floor(snapshot.position.y)}, ${Math.floor(snapshot.position.z)}]
Health: ${snapshot.health}/20
Food: ${snapshot.food}/20
Inventory: ${snapshot.inventory.join(', ') || 'empty'}
Threats: ${snapshot.threats.map((t) => `${t.name} (${t.distance}m)`).join(', ') || 'none'}

SITUATION:
${urgency.critical ? '🚨 CRITICAL: ' + urgency.reason : '📍 Normal'}

RECENT OUTCOMES:
Successes: ${snapshot.recentSuccesses.map((s) => s.reason).join(', ') || 'none'}
Failures: ${snapshot.recentFailures.map((f) => f.reason).join(', ') || 'none'}
Lessons: ${snapshot.lessons.map((l) => l.reason).join(', ') || 'none'}

PROGRESSION GOALS (Complete in order):
${snapshot.availableGoals
  .slice(0, 5)
  .map((g, i) => `${i + 1}. ${g}`)
  .join('\n')}

YOUR TASK:
Respond with ONLY a JSON object (no markdown, no explanation):
{
  "intent": "action_name",
  "reason": "brief explanation",
  "priority": 1-100,
  "parameters": { "key": "value" }
}

IMPORTANT RULES:
- Do NOT include movement, pathfinding, or combat execution details
- Do NOT generate coordinates or commands
- Only decide WHAT to do, not HOW
- If health < 8 or food < 4: prioritize eating and hiding
- If threats nearby: decide to fight or flee, don't fight directly
- Reference lessons from recent failures
- Choose from: gather_*, craft_*, mine_*, smelt_*, explore_*, build_*, hunt_*, farm_*, follow_*, protect_*, sleep_*, eat_*, hide_*

RESPOND NOW:`

    return prompt
  }

  /**
   * Assess urgency of current situation
   */
  assessUrgency(snapshot) {
    if (snapshot.critical.health) {
      return { critical: true, reason: 'Health critical', action: 'eat' }
    }
    if (snapshot.critical.food) {
      return { critical: true, reason: 'Starving', action: 'eat' }
    }
    if (snapshot.critical.threatening) {
      return { critical: true, reason: 'Hostile nearby', action: 'fight_or_flee' }
    }
    return { critical: false }
  }

  /**
   * Call LLM provider
   */
  async callLLM(prompt) {
    if (!this.llmProvider) {
      throw new Error('LLM provider not configured')
    }

    return await this.llmProvider.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 256
    })
  }

  /**
   * Parse LLM response into structured intent
   */
  parseIntent(response) {
    try {
      const json = typeof response === 'string' ? JSON.parse(response) : response
      return {
        intent: normalizeName(json.intent || 'idle'),
        reason: String(json.reason || ''),
        priority: Math.max(0, Math.min(100, Number(json.priority || 50))),
        parameters: json.parameters || {},
        generatedAt: now()
      }
    } catch (error) {
      console.error('Failed to parse LLM response:', error.message)
      return {
        intent: 'idle',
        reason: 'parse_error',
        priority: 50,
        parameters: {}
      }
    }
  }

  /**
   * Compact inventory for token efficiency
   */
  compactInventory(inventory) {
    return inventory
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => `${item.count}x ${normalizeName(item.name)}`)
  }

  /**
   * Fallback when LLM unavailable
   */
  fallbackIntent(context = {}) {
    const inventory = context.inventory || []
    const wood = inventory.find((i) => i.name?.includes('wood'))
    const health = context.health || 20
    const food = context.food || 20

    if (health <= 8 || food <= 4) {
      return { intent: 'eat_food', reason: 'critical_survival', priority: 99, parameters: {} }
    }

    if (!wood || wood.count < 5) {
      return { intent: 'gather_wood', reason: 'insufficient_wood', priority: 80, parameters: {} }
    }

    return { intent: 'explore', reason: 'continue_exploration', priority: 50, parameters: {} }
  }

  /**
   * Provide feedback to LLM about outcome
   */
  recordOutcome(intent, outcome) {
    this.memory?.recordExperience?.({
      intent: intent.intent,
      outcome: outcome.ok ? 'success' : 'failed',
      reason: outcome.reason,
      duration: outcome.durationMs,
      priority: intent.priority
    })

    if (!outcome.ok) {
      this.reflection?.reflect?.('intent_failed', {
        intent: intent.intent,
        reason: outcome.reason,
        context: outcome
      })
    }
  }

  status() {
    return {
      lastIntent: this.intentBuffer[0],
      intents: this.intentBuffer.length,
      debounceMs: this.debounceMs
    }
  }
}
