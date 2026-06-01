const MOVEMENT_CONTROLS = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak']
const HAZARD_BLOCKS = new Set(['lava', 'fire', 'soul_fire', 'magma_block', 'cactus', 'campfire'])
const WATER_BLOCKS = new Set(['water', 'bubble_column', 'kelp', 'seagrass', 'tall_seagrass'])
const CLIMBABLE_BLOCKS = new Set([
  'ladder',
  'vine',
  'scaffolding',
  'twisting_vines',
  'weeping_vines'
])
const REPLACEABLE_BLOCKS = new Set([
  'air',
  'cave_air',
  'void_air',
  'water',
  'lava',
  'grass',
  'tall_grass',
  'fern',
  'large_fern',
  'snow'
])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clamp(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function blockName(block) {
  return block?.name || 'air'
}

function keyFromPosition(position) {
  if (!position) return 'unknown'
  return `${Math.floor(position.x)}:${Math.floor(position.y)}:${Math.floor(position.z)}`
}

function normalizePosition(position) {
  if (!position) return undefined
  return {
    x: Math.floor(Number(position.x)),
    y: Math.floor(Number(position.y)),
    z: Math.floor(Number(position.z))
  }
}

export class GeminiMobilityEngine {
  constructor({ bot, goals, memory, eventBus, sendEvent, helpers = {} }) {
    this.bot = bot
    this.goals = goals
    this.memory = memory
    this.eventBus = eventBus
    this.sendEvent = sendEvent
    this.helpers = helpers
    this.skillXp = {
      basicWalking: 0,
      advancedNavigation: 0,
      bridging: 0,
      towering: 0,
      stairBuilding: 0,
      tunnelMining: 0,
      combatStrafing: 0,
      waterEscape: 0,
      mountainClimbing: 0,
      resourceMovement: 0,
      parkour: 0,
      advancedExploration: 0
    }
    this.skillStats = {}
    this.lastPosition = undefined
    this.stuckTicks = 0
    this.lastReactionAt = 0
    this.version = 'v2'
    this.activeSession = undefined
    this.routeBlacklist = new Map()
    this.pathUpdate = undefined
    this.recoveryHistory = []
    this.bindPathfinderEvents()
  }

  bindPathfinderEvents() {
    if (!this.bot?.on || this.pathEventsBound) return
    this.pathEventsBound = true
    this.bot.on('path_update', (result) => {
      this.pathUpdate = {
        status: result?.status,
        pathLength: result?.path?.length,
        time: Date.now()
      }
      if (result?.status) this.emit('path_update', this.pathUpdate)
    })
    this.bot.on('goal_reached', () => {
      this.pathUpdate = { status: 'goal_reached', time: Date.now() }
      this.emit('goal_reached')
    })
  }

  emit(type, payload = {}) {
    this.eventBus?.emit?.(`mobility.${type}`, payload)
  }

  remember(kind, key, value) {
    if (kind === 'route') {
      this.memory?.rememberLocation?.(`route:${key}`, value)
    } else if (kind === 'hazard') {
      this.memory?.rememberLocation?.(`hazard:${key}`, value)
    } else if (kind === 'dead_end') {
      this.memory?.rememberLocation?.(`dead_end:${key}`, value)
    }
  }

  rememberRecovery(type, payload = {}) {
    const record = { type, payload, at: Date.now() }
    this.recoveryHistory.push(record)
    if (this.recoveryHistory.length > 80) this.recoveryHistory.shift()
    this.memory?.setWorking?.('mobilityRecoveries', this.recoveryHistory.slice(-20))
    this.emit('recovery', record)
  }

  normalizeControl(control) {
    const aliases = {
      w: 'forward',
      ileri: 'forward',
      forward: 'forward',
      fwd: 'forward',
      s: 'back',
      geri: 'back',
      back: 'back',
      backward: 'back',
      a: 'left',
      sol: 'left',
      left: 'left',
      d: 'right',
      sag: 'right',
      sağ: 'right',
      right: 'right',
      zipla: 'jump',
      zıpla: 'jump',
      jump: 'jump',
      kos: 'sprint',
      koş: 'sprint',
      sprint: 'sprint',
      egil: 'sneak',
      eğil: 'sneak',
      sneak: 'sneak'
    }
    return aliases[String(control || '').toLowerCase()]
  }

  input(control, state = true) {
    const normalized = this.normalizeControl(control)
    if (!normalized) return false
    this.bot.setControlState(normalized, Boolean(state))
    this.emit('input', { control: normalized, state: Boolean(state) })
    return true
  }

  async pulse(control, duration = 450, options = {}) {
    const normalized = this.normalizeControl(control)
    if (!normalized) return false

    const durationMs = clamp(duration, 80, 5000, 450)
    if (options.sprint) this.bot.setControlState('sprint', true)
    if (options.sneak) this.bot.setControlState('sneak', true)
    this.bot.setControlState(normalized, true)
    await sleep(durationMs + Math.floor(Math.random() * 45))
    this.bot.setControlState(normalized, false)
    if (options.sprint) this.bot.setControlState('sprint', false)
    if (options.sneak) this.bot.setControlState('sneak', false)
    this.emit('pulse', { control: normalized, duration: durationMs, options })
    return true
  }

  reset() {
    MOVEMENT_CONTROLS.forEach((control) => this.bot.setControlState(control, false))
    this.emit('reset')
  }

  async lookAt(position, force = true) {
    if (!position) return false
    await this.bot.lookAt(position, force)
    this.emit('look_at', { position: this.formatPosition(position) })
    return true
  }

  async rotate(yaw, pitch = 0, force = true) {
    await this.bot.look(yaw, pitch, force)
    this.emit('rotate', { yaw, pitch })
    return true
  }

  leftClick() {
    this.bot.swingArm('right')
    this.emit('left_click')
    return true
  }

  rightClick() {
    this.bot.activateItem()
    this.emit('right_click')
    return true
  }

  formatPosition(position) {
    if (!position) return 'unknown'
    return `${Math.floor(position.x)} ${Math.floor(position.y)} ${Math.floor(position.z)}`
  }

  getBlockAtOffset(dx, dy, dz) {
    const base = this.bot.entity?.position
    if (!base) return undefined
    return this.bot.blockAt(base.offset(dx, dy, dz))
  }

  getYawVector(distance = 1) {
    const yaw = this.bot.entity?.yaw || 0
    return {
      x: -Math.sin(yaw) * distance,
      z: -Math.cos(yaw) * distance
    }
  }

  getFrontBlock(distance = 1, y = 0) {
    const base = this.bot.entity?.position
    if (!base) return undefined
    const vector = this.getYawVector(distance)
    return this.bot.blockAt(base.offset(vector.x, y, vector.z))
  }

  getNearbyThreats(radius = 8) {
    const hostile = new Set([
      'zombie',
      'skeleton',
      'creeper',
      'spider',
      'cave_spider',
      'enderman',
      'witch',
      'slime',
      'drowned',
      'husk',
      'stray',
      'phantom',
      'pillager',
      'vindicator',
      'ravager',
      'blaze',
      'ghast',
      'magma_cube',
      'hoglin',
      'piglin_brute',
      'warden'
    ])
    const origin = this.bot.entity?.position
    if (!origin) return []
    return Object.values(this.bot.entities || {})
      .filter((entity) => {
        return (
          entity?.position &&
          hostile.has(entity.name) &&
          origin.distanceTo(entity.position) <= radius
        )
      })
      .sort((a, b) => origin.distanceTo(a.position) - origin.distanceTo(b.position))
  }

  analyzeEnvironment(target) {
    const position = this.bot.entity?.position
    if (!position) return { ready: false }

    const below = this.getBlockAtOffset(0, -1, 0)
    const feet = this.getBlockAtOffset(0, 0, 0)
    const head = this.getBlockAtOffset(0, 1, 0)
    const front = this.getFrontBlock(1, 0)
    const frontBelow = this.getFrontBlock(1, -1)
    const frontHead = this.getFrontBlock(1, 1)
    const aboveHead = this.getBlockAtOffset(0, 2, 0)
    const threats = this.getNearbyThreats()
    const targetDistance = target?.distanceTo ? position.distanceTo(target) : undefined
    const blocks = [below, feet, head, front, frontBelow, frontHead].filter(Boolean)
    const hazard = blocks.find((block) => HAZARD_BLOCKS.has(block.name))
    const water = blocks.some((block) => WATER_BLOCKS.has(block.name))
    const climbable = blocks.some((block) => CLIMBABLE_BLOCKS.has(block.name))
    const gapAhead = frontBelow && frontBelow.boundingBox === 'empty'
    const frontBlocked = front && front.boundingBox !== 'empty' && !CLIMBABLE_BLOCKS.has(front.name)
    const dark = Number.isFinite(feet?.light) ? feet.light < 7 : false
    const terrainHeight = frontBelow?.position?.y - below?.position?.y || 0
    const fallRisk = this.estimateFallRisk()
    const resources = this.resourceSnapshot()
    const pathStatus =
      this.pathUpdate && Date.now() - this.pathUpdate.time < 5000
        ? this.pathUpdate.status
        : undefined

    if (hazard) {
      this.remember('hazard', keyFromPosition(hazard.position), {
        block: hazard.name,
        position: this.formatPosition(hazard.position)
      })
    }

    return {
      ready: true,
      position: this.formatPosition(position),
      targetDistance,
      below: blockName(below),
      feet: blockName(feet),
      head: blockName(head),
      front: blockName(front),
      frontBelow: blockName(frontBelow),
      frontHead: blockName(frontHead),
      aboveHead: blockName(aboveHead),
      frontBlocked,
      gapAhead,
      hazard: hazard?.name,
      water,
      climbable,
      dark,
      terrainHeight,
      fallRisk,
      pathStatus,
      resources,
      threats: threats.map((entity) => ({
        name: entity.name,
        distance: Number(position.distanceTo(entity.position).toFixed(2))
      }))
    }
  }

  evaluateSolutions(analysis = {}) {
    const solutions = []
    const hasBlocks = (analysis.resources?.buildBlocks || 0) > 0
    const hasPickaxe = analysis.resources?.tools?.some((tool) => tool.includes('pickaxe'))
    const hasBoat = analysis.resources?.items?.some((item) => item.includes('boat'))
    if (analysis.threats?.length) solutions.push({ type: 'escape', score: 95 })
    if (analysis.hazard) solutions.push({ type: 'avoid_hazard', score: 90 })
    if (analysis.pathStatus === 'noPath') solutions.push({ type: 'dynamic_replan', score: 88 })
    if (analysis.fallRisk > 3 && hasBlocks) solutions.push({ type: 'bridge_gap', score: 82 })
    if (analysis.water)
      solutions.push({ type: hasBoat ? 'boat_navigation' : 'water_navigation', score: 75 })
    if (analysis.gapAhead && hasBlocks) solutions.push({ type: 'bridge_gap', score: 72 })
    if (analysis.gapAhead && !hasBlocks) solutions.push({ type: 'find_alternate_route', score: 55 })
    if (analysis.climbable) solutions.push({ type: 'climb', score: 68 })
    if (analysis.frontBlocked && hasPickaxe) solutions.push({ type: 'break_or_climb', score: 64 })
    if (analysis.frontBlocked && hasBlocks) solutions.push({ type: 'build_staircase', score: 60 })
    if (analysis.frontBlocked) solutions.push({ type: 'dig_tunnel', score: hasPickaxe ? 58 : 40 })
    if (analysis.terrainHeight > 1 && hasBlocks) solutions.push({ type: 'tower_up', score: 56 })
    solutions.push({ type: 'smooth_path', score: 50 })
    return solutions.sort((a, b) => b.score - a.score)
  }

  async microCorrect(analysis = {}) {
    const now = Date.now()
    if (now - this.lastReactionAt < 250) return
    this.lastReactionAt = now

    if (analysis.hazard) {
      this.bot.setControlState('sprint', false)
      await this.pulse(Math.random() < 0.5 ? 'left' : 'right', 220, { sneak: true })
      return
    }

    if (analysis.gapAhead) {
      this.bot.setControlState('sneak', true)
      await this.pulse('jump', 120)
      this.bot.setControlState('sneak', false)
      return
    }

    if (analysis.frontBlocked) {
      await this.pulse('jump', 160)
      if (Math.random() < 0.35) await this.pulse(Math.random() < 0.5 ? 'left' : 'right', 180)
      return
    }

    if (Math.random() < 0.18) {
      await this.pulse(Math.random() < 0.5 ? 'left' : 'right', 90)
    }
  }

  updateStuckState() {
    const position = this.bot.entity?.position
    if (!position) return 0
    if (this.lastPosition && position.distanceTo(this.lastPosition) < 0.18) {
      this.stuckTicks += 1
    } else {
      this.stuckTicks = 0
    }
    this.lastPosition = position.clone()
    return this.stuckTicks
  }

  async solveBlockedStep(analysis = {}) {
    const solutions = this.evaluateSolutions(analysis)
    const selected = solutions[0]?.type || 'smooth_path'
    this.emit('solution_selected', { selected, analysis })

    if (selected === 'escape') return this.escapeDanger()
    if (selected === 'boat_navigation') return this.navigateWater()
    if (selected === 'water_navigation') return this.navigateWater()
    if (selected === 'bridge_gap') return this.bridgeGap()
    if (selected === 'build_staircase') return this.buildStaircase()
    if (selected === 'dig_tunnel') return this.digTunnel()
    if (selected === 'break_or_climb') return this.breakOrClimb()
    if (selected === 'avoid_hazard') return this.avoidHazard()
    if (selected === 'tower_up') return this.towerUp()
    if (selected === 'dynamic_replan') return this.dynamicReplanNudge()

    await this.pulse('jump', 180)
    return true
  }

  async recoverFromStuck(analysis = {}) {
    this.memory?.rememberFailure?.('mobility_stuck', analysis)
    this.emit('stuck', analysis)
    this.rememberRecovery('stuck', analysis)
    await this.solveBlockedStep(analysis)
    if (this.stuckTicks > 4) {
      await this.pulse(Math.random() < 0.5 ? 'left' : 'right', 450)
    }
    if (this.stuckTicks > 6) {
      await this.helpers.placeBlock?.(undefined, ['under']).catch(() => false)
    }
  }

  createGoal(position, near = 2, options = {}) {
    if (!this.goals || !position) return undefined
    const target = normalizePosition(position)
    if (!target) return undefined
    if (options.exact && typeof this.goals.GoalBlock === 'function') {
      return new this.goals.GoalBlock(target.x, target.y, target.z)
    }
    return new this.goals.GoalNear(target.x, target.y, target.z, near)
  }

  distanceTo(position) {
    const current = this.bot.entity?.position
    if (!current || !position) return Infinity
    return current.distanceTo(position)
  }

  isReplaceable(block) {
    return !block || block.boundingBox === 'empty' || REPLACEABLE_BLOCKS.has(block.name)
  }

  isSolidSafe(block) {
    return Boolean(block && block.boundingBox !== 'empty' && !HAZARD_BLOCKS.has(block.name))
  }

  isSafeStandPosition(position) {
    const target = normalizePosition(position)
    if (!target || !this.bot?.blockAt) return false
    const feet = this.bot.blockAt({
      x: target.x,
      y: target.y,
      z: target.z
    })
    const head = this.bot.blockAt({
      x: target.x,
      y: target.y + 1,
      z: target.z
    })
    const below = this.bot.blockAt({
      x: target.x,
      y: target.y - 1,
      z: target.z
    })
    return this.isReplaceable(feet) && this.isReplaceable(head) && this.isSolidSafe(below)
  }

  approachCandidates(position, radius = 5) {
    const target = normalizePosition(position)
    if (!target) return []
    const candidates = []
    for (let ring = 1; ring <= radius; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue
          for (const dy of [0, 1, -1, 2, -2]) {
            const candidate = { x: target.x + dx, y: target.y + dy, z: target.z + dz }
            if (!this.isSafeStandPosition(candidate)) continue
            const key = keyFromPosition(candidate)
            const blacklistedUntil = this.routeBlacklist.get(key) || 0
            if (blacklistedUntil > Date.now()) continue
            candidates.push(candidate)
          }
        }
      }
    }
    return candidates
      .sort((a, b) => this.distanceTo(a) - this.distanceTo(b))
      .slice(0, 12)
  }

  async dynamicReplanNudge() {
    this.rememberRecovery('dynamic_replan_nudge', this.analyzeEnvironment())
    this.bot.pathfinder?.setGoal?.(null)
    this.reset()
    await this.pulse('back', 220, { sneak: true })
    await this.pulse(Math.random() < 0.5 ? 'left' : 'right', 350)
    await this.pulse('jump', 160)
    return true
  }

  async smoothNavigateTo(position, options = {}) {
    if (!this.bot.pathfinder || !this.goals || !position) {
      console.log('[MOBILITY] Path Failure', {
        reason: 'pathfinder_or_target_missing',
        hasPathfinder: Boolean(this.bot.pathfinder),
        hasGoals: Boolean(this.goals),
        hasPosition: Boolean(position)
      })
      return false
    }
    if (![position.x, position.y, position.z].every((value) => Number.isFinite(Number(value)))) {
      console.log('[MOBILITY] Path Failure', { reason: 'invalid_target', position })
      return false
    }
    const near = clamp(options.near, 1, 8, 2)
    const successDistance = clamp(options.successDistance, 0.5, 2, 1.8)
    const timeoutMs = clamp(options.timeoutMs, 1500, 120000, 25000)
    const watchdogMs = clamp(options.watchdogMs, 1000, 15000, 5000)
    const startedAt = Date.now()
    const maxRecoveries = clamp(options.maxRecoveries, 0, 12, 5)
    const targetKey = keyFromPosition(position)
    let lastMovementAt = Date.now()
    let lastLogAt = 0
    let lastWatchdogPosition = this.bot.entity?.position?.clone()
    let movedAtAll = false
    let recoveries = 0
    let lastGoalSetAt = 0

    this.emit('plan_started', {
      target: this.formatPosition(position),
      near,
      mode: 'smooth_path'
    })
    const goal = this.createGoal(position, near, options)
    console.log('[MOBILITY] Pathfinder integration', {
      pathfinderLoaded: Boolean(this.bot.pathfinder),
      goalType: goal.constructor?.name,
      currentPosition: this.formatPosition(this.bot.entity?.position),
      targetPosition: this.formatPosition(position),
      successDistance
    })
    console.log('[MOBILITY] pathfinder.setGoal called')
    this.bot.pathfinder.setGoal(goal, false)
    lastGoalSetAt = Date.now()
    this.activeSession = {
      target: normalizePosition(position),
      startedAt,
      recoveries: 0,
      mode: 'adaptive_path'
    }

    while (Date.now() - startedAt < timeoutMs) {
      const current = this.bot.entity?.position
      if (!current) break
      const distance = current.distanceTo(position)
      const movedSinceWatchdog = lastWatchdogPosition ? current.distanceTo(lastWatchdogPosition) : 0
      if (movedSinceWatchdog > 0.12) {
        movedAtAll = true
        lastMovementAt = Date.now()
        lastWatchdogPosition = current.clone()
      }

      if (Date.now() - lastLogAt > 1000) {
        lastLogAt = Date.now()
        console.log('[MOBILITY] Movement tick', {
          currentPosition: this.formatPosition(current),
          targetPosition: this.formatPosition(position),
          distanceRemaining: Number(distance.toFixed(2)),
          pathStatus: this.bot.pathfinder?.isMoving?.() ? 'MOVING' : 'PLANNING'
        })
      }

      if (distance < successDistance) {
        this.reset()
        this.remember('route', targetKey, {
          target: this.formatPosition(position),
          success: true,
          durationMs: Date.now() - startedAt
        })
        this.memory?.rememberSuccess?.('mobility_route', { target: this.formatPosition(position) })
        this.gainSkill('advancedNavigation', 2)
        this.emit('plan_finished', { target: this.formatPosition(position), distance, movedAtAll })
        this.activeSession = undefined
        console.log('[MOBILITY] Goal Reached', {
          currentPosition: this.formatPosition(current),
          targetPosition: this.formatPosition(position),
          distanceRemaining: Number(distance.toFixed(2)),
          movedAtAll
        })
        return { ok: true, moved: movedAtAll, distance, state: 'SUCCESS' }
      }

      const analysis = this.analyzeEnvironment(position)
      this.bot.setControlState('sprint', !analysis.hazard && !analysis.water && this.bot.food > 6)
      await this.microCorrect(analysis)
      const stuckScore = this.updateStuckState()
      const pathfinderNoPath =
        analysis.pathStatus === 'noPath' && Date.now() - lastGoalSetAt > Math.min(2500, watchdogMs)
      const watchdogExpired = Date.now() - lastMovementAt > watchdogMs

      if ((stuckScore >= 3 || watchdogExpired || pathfinderNoPath) && recoveries < maxRecoveries) {
        recoveries += 1
        this.activeSession.recoveries = recoveries
        this.bot.pathfinder.setGoal(null)
        this.reset()
        this.memory?.rememberFailure?.('movement_recovery', {
          target: this.formatPosition(position),
          current: this.formatPosition(current),
          distance: Number(distance.toFixed(2)),
          stuckScore,
          watchdogExpired,
          pathStatus: analysis.pathStatus,
          recovery: recoveries
        })
        console.log('[MOBILITY] Adaptive Recovery', {
          recovery: recoveries,
          currentPosition: this.formatPosition(current),
          targetPosition: this.formatPosition(position),
          distanceRemaining: Number(distance.toFixed(2)),
          pathStatus: analysis.pathStatus
        })
        await this.recoverFromStuck(analysis)
        const nextGoal = this.createGoal(position, near, options)
        this.bot.pathfinder.setGoal(nextGoal, false)
        lastGoalSetAt = Date.now()
        lastMovementAt = Date.now()
        lastWatchdogPosition = this.bot.entity?.position?.clone()
        continue
      }

      if (watchdogExpired || pathfinderNoPath) {
        this.bot.pathfinder.setGoal(null)
        this.reset()
        this.memory?.rememberFailure?.('movement_watchdog', {
          target: this.formatPosition(position),
          current: this.formatPosition(current),
          distance: Number(distance.toFixed(2)),
          recoveries
        })
        this.emit('plan_failed', {
          target: this.formatPosition(position),
          reason: pathfinderNoPath ? 'no_path_after_recovery' : 'movement_watchdog',
          distance,
          recoveries
        })
        console.log('[MOBILITY] Movement Failure', {
          reason: pathfinderNoPath ? 'No Path After Recovery' : 'Bot Stuck',
          currentPosition: this.formatPosition(current),
          targetPosition: this.formatPosition(position),
          distanceRemaining: Number(distance.toFixed(2)),
          recoveries
        })
        this.activeSession = undefined
        return {
          ok: false,
          reason: pathfinderNoPath ? 'No Path After Recovery' : 'Bot Stuck',
          moved: movedAtAll,
          distance,
          recoveries,
          state: 'FAILED'
        }
      }
      await sleep(250 + Math.floor(Math.random() * 80))
    }

    this.bot.pathfinder.setGoal(null)
    this.reset()
    this.remember('dead_end', targetKey, {
      target: this.formatPosition(position),
      analysis: this.analyzeEnvironment(position)
    })
    this.emit('plan_failed', { target: this.formatPosition(position), reason: 'timeout' })
    this.activeSession = undefined
    console.log('[MOBILITY] Path Failure', {
      reason: 'Path Timeout',
      targetPosition: this.formatPosition(position)
    })
    return { ok: false, reason: 'Path Timeout', moved: movedAtAll, state: 'FAILED' }
  }

  async reach(position, options = {}) {
    const analysis = this.analyzeEnvironment(position)
    this.emit('reach_requested', {
      target: this.formatPosition(position),
      analysis,
      solutions: this.evaluateSolutions(analysis)
    })

    const attempts = []
    const direct = await this.smoothNavigateTo(position, options)
    attempts.push({ type: 'direct', result: direct })
    if (direct?.ok) return { ...direct, attempts }

    const targetKey = keyFromPosition(position)
    this.routeBlacklist.set(targetKey, Date.now() + 20000)
    await this.solveBlockedStep(this.analyzeEnvironment(position))

    const candidates = this.approachCandidates(position, options.approachRadius || 5)
    for (const candidate of candidates.slice(0, clamp(options.maxApproachAttempts, 1, 6, 3))) {
      const result = await this.smoothNavigateTo(candidate, {
        ...options,
        near: Math.max(1, options.near || 2),
        timeoutMs: options.retryTimeoutMs || 14000,
        maxRecoveries: Math.max(2, Math.floor((options.maxRecoveries || 5) / 2))
      })
      attempts.push({ type: 'approach', candidate: this.formatPosition(candidate), result })
      if (result?.ok) {
        const final = await this.smoothNavigateTo(position, {
          ...options,
          timeoutMs: options.finalTimeoutMs || 9000,
          maxRecoveries: 2
        })
        attempts.push({ type: 'final', result: final })
        if (final?.ok) return { ...final, attempts }
      } else {
        this.routeBlacklist.set(keyFromPosition(candidate), Date.now() + 20000)
      }
    }

    const fallback = attempts[attempts.length - 1]?.result || direct
    return {
      ok: false,
      reason: fallback?.reason || 'adaptive_navigation_failed',
      attempts,
      state: 'FAILED'
    }
  }

  async bridgeGap() {
    if (!this.hasBuildBlock()) {
      this.recordSkill('bridging', false)
      return false
    }
    this.bot.setControlState('sneak', true)
    await this.helpers.placeBlock?.(undefined, ['front', 'under']).catch(() => false)
    await this.pulse('forward', 450, { sneak: true })
    this.bot.setControlState('sneak', false)
    this.gainSkill('bridging', 3)
    this.recordSkill('bridging', true)
    return true
  }

  async towerUp() {
    this.bot.setControlState('sneak', true)
    await this.pulse('jump', 220)
    await this.helpers.placeBlock?.(undefined, ['under']).catch(() => false)
    this.bot.setControlState('sneak', false)
    this.gainSkill('towering', 2)
    this.recordSkill('towering', true)
    return true
  }

  async buildStaircase(steps = 3) {
    if (!this.hasBuildBlock()) {
      this.recordSkill('stairBuilding', false)
      return false
    }
    for (let index = 0; index < steps; index++) {
      await this.helpers.placeBlock?.(undefined, ['front', 'under']).catch(() => false)
      await this.pulse('jump', 160)
      await this.pulse('forward', 350, { sneak: true })
    }
    this.gainSkill('stairBuilding', 3)
    this.recordSkill('stairBuilding', true)
    return true
  }

  async breakOrClimb() {
    const front = this.getFrontBlock(1, 0)
    if (front && front.boundingBox !== 'empty') {
      const hardness = Number.isFinite(front.hardness) ? front.hardness : 1
      if (hardness >= 0 && hardness < 12) {
        await this.bot.lookAt(front.position.offset(0.5, 0.5, 0.5), true).catch(() => {})
        await this.bot
          .dig(front, true)
          .catch(() => this.helpers.digBlock?.(front).catch(() => false))
        this.gainSkill('resourceMovement', 1)
        return true
      }
    }
    await this.towerUp()
    return true
  }

  async digTunnel(steps = 3) {
    for (let index = 0; index < steps; index++) {
      const feet = this.getFrontBlock(1, 0)
      const head = this.getFrontBlock(1, 1)
      if (feet && feet.boundingBox !== 'empty') await this.helpers.digBlock?.(feet).catch(() => {})
      if (head && head.boundingBox !== 'empty') await this.helpers.digBlock?.(head).catch(() => {})
      await this.pulse('forward', 450)
    }
    this.gainSkill('tunnelMining', 2)
    this.recordSkill('tunnelMining', true)
    return true
  }

  async navigateWater() {
    const boat = this.bot.inventory?.items?.().find((item) => item.name.includes('boat'))
    if (boat) {
      await this.bot.equip(boat, 'hand').catch(() => {})
      await this.helpers.placeBlock?.(boat.name, ['front']).catch(() => false)
      this.emit('boat_attempt', { boat: boat.name })
    }
    this.bot.setControlState('sprint', true)
    await this.pulse('forward', 900)
    await this.pulse('jump', 240)
    this.gainSkill('waterEscape', 2)
    this.recordSkill('waterEscape', true)
    return true
  }

  async avoidHazard() {
    this.bot.setControlState('sprint', false)
    await this.pulse('back', 400, { sneak: true })
    await this.pulse(Math.random() < 0.5 ? 'left' : 'right', 500)
    return true
  }

  async escapeDanger() {
    const threat = this.getNearbyThreats(10)[0]
    if (threat?.position) {
      await this.bot.lookAt(threat.position.offset(0, threat.height || 1, 0), true).catch(() => {})
      await this.pulse('back', 850, { sprint: true })
      await this.pulse(Math.random() < 0.5 ? 'left' : 'right', 400, { sprint: true })
    } else {
      await this.pulse('forward', 900, { sprint: true })
    }
    this.gainSkill('combatStrafing', 2)
    this.recordSkill('combatStrafing', true)
    return true
  }

  async combatStrafe(target) {
    if (target?.position) await this.lookAt(target.position.offset(0, target.height || 1, 0))
    this.bot.setControlState('sprint', true)
    await this.pulse(Math.random() < 0.5 ? 'left' : 'right', 280)
    this.leftClick()
    this.gainSkill('combatStrafing', 1)
    this.recordSkill('combatStrafing', true)
    return true
  }

  async climb() {
    this.bot.setControlState('jump', true)
    await this.pulse('forward', 700)
    this.bot.setControlState('jump', false)
    this.gainSkill('mountainClimbing', 1)
    return true
  }

  async interactInventory(action = 'snapshot') {
    const items = this.bot.inventory?.items?.() || []
    const snapshot = {
      action,
      slots: this.bot.inventory?.slots?.length || 0,
      used: items.length,
      hotbarStart: this.bot.inventory?.hotbarStart || 36,
      held: this.bot.heldItem?.name
    }
    this.emit('inventory', snapshot)
    this.memory?.setWorking?.('mobilityInventory', snapshot)
    return snapshot
  }

  async interactContainer(container, action = 'inspect') {
    const title = container?.title || container?.type || 'container'
    this.emit('container', { action, title })
    return { action, title }
  }

  gainSkill(skill, amount = 1) {
    if (!Object.prototype.hasOwnProperty.call(this.skillXp, skill)) this.skillXp[skill] = 0
    this.skillXp[skill] += amount
    this.memory?.setWorking?.('mobilitySkills', this.skillXp)
  }

  recordSkill(skill, success) {
    if (!this.skillStats[skill]) this.skillStats[skill] = { attempts: 0, successes: 0 }
    this.skillStats[skill].attempts++
    if (success) this.skillStats[skill].successes++
    this.memory?.setWorking?.('mobilitySkillStats', this.skillStats)
  }

  skillRates() {
    return Object.fromEntries(
      Object.entries(this.skillStats).map(([skill, stats]) => [
        skill,
        {
          ...stats,
          successRate:
            stats.attempts > 0 ? Number((stats.successes / stats.attempts).toFixed(2)) : 0
        }
      ])
    )
  }

  hasBuildBlock() {
    return this.resourceSnapshot().buildBlocks > 0
  }

  resourceSnapshot() {
    const items = this.bot.inventory?.items?.() || []
    const buildBlocks = items
      .filter((item) => {
        return (
          /dirt|cobblestone|stone|planks|netherrack|deepslate|sandstone|scaffolding/.test(
            item.name
          ) && !/slab|stairs|button|pressure_plate/.test(item.name)
        )
      })
      .reduce((sum, item) => sum + item.count, 0)
    return {
      buildBlocks,
      torches: items
        .filter((item) => item.name.includes('torch'))
        .reduce((sum, item) => sum + item.count, 0),
      food: items
        .filter((item) => /bread|beef|pork|chicken|mutton|apple|carrot|potato/.test(item.name))
        .map((item) => item.name),
      tools: items
        .filter((item) => /pickaxe|axe|shovel|sword|shield|bucket/.test(item.name))
        .map((item) => item.name),
      items: items.map((item) => item.name).slice(0, 40)
    }
  }

  estimateFallRisk() {
    const base = this.bot.entity?.position
    if (!base) return 0
    for (let y = -1; y >= -8; y--) {
      const block = this.bot.blockAt(base.offset(0, y, 0))
      if (block && block.boundingBox !== 'empty') return Math.abs(y) > 3 ? Math.abs(y) : 0
    }
    return 8
  }

  status() {
    const analysis = this.analyzeEnvironment()
    return {
      version: this.version,
      skills: this.skillXp,
      skillStats: this.skillRates(),
      stuckTicks: this.stuckTicks,
      activeSession: this.activeSession,
      pathUpdate: this.pathUpdate,
      recentRecoveries: this.recoveryHistory.slice(-8),
      analysis,
      solutions: this.evaluateSolutions(analysis).map((solution) => solution.type)
    }
  }
}

export function createMobilityEngine(options) {
  return new GeminiMobilityEngine(options)
}
