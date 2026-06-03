import { formatPosition } from './utils'

export class LocalWorldSnapshotSystem {
  constructor({ bot, spatialReasoning } = {}) {
    this.bot = bot
    this.spatialReasoning = spatialReasoning
  }

  snapshot({ goal, recentFailures } = {}) {
    const bot = this.bot
    return {
      position: formatPosition(bot?.entity?.position),
      health: Math.round(bot?.health || 0),
      food: bot?.food,
      inventorySummary: (bot?.inventory?.items?.() || []).slice(0, 32).map((item) => ({
        name: item.name,
        count: item.count
      })),
      threatSummary: this.spatialReasoning?.threatSummary?.() || [],
      terrainSummary: this.spatialReasoning?.terrainSummary?.() || {},
      navigation: this.spatialReasoning?.navigationSummary?.() || {},
      currentGoal: goal,
      recentFailures: (recentFailures || []).slice(-5)
    }
  }
}
