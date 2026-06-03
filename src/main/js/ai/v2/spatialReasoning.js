import { formatPosition } from './utils'

const HAZARDS = new Set(['lava', 'fire', 'soul_fire', 'magma_block', 'cactus'])

export class SpatialReasoningLayer {
  constructor({ bot, mobility } = {}) {
    this.bot = bot
    this.mobility = mobility
  }

  blockAt(dx, dy, dz) {
    const base = this.bot?.entity?.position
    if (!base) return undefined
    return this.bot.blockAt(base.offset(dx, dy, dz))
  }

  navigationSummary() {
    const checks = {
      forward: this.blockAt(0, 0, 1),
      back: this.blockAt(0, 0, -1),
      left: this.blockAt(-1, 0, 0),
      right: this.blockAt(1, 0, 0)
    }
    return Object.fromEntries(
      Object.entries(checks).map(([direction, block]) => [
        direction,
        {
          blocked: Boolean(block && block.boundingBox !== 'empty'),
          block: block?.name || 'air'
        }
      ])
    )
  }

  terrainSummary() {
    const below = this.blockAt(0, -1, 0)
    const feet = this.blockAt(0, 0, 0)
    const head = this.blockAt(0, 1, 0)
    const nearby = [below, feet, head].filter(Boolean)
    return {
      position: formatPosition(this.bot?.entity?.position),
      below: below?.name,
      feet: feet?.name,
      head: head?.name,
      hazard: nearby.find((block) => HAZARDS.has(block.name))?.name,
      mobility: this.mobility?.status?.()?.analysis
    }
  }

  threatSummary(radius = 10) {
    const origin = this.bot?.entity?.position
    if (!origin) return []
    return Object.values(this.bot?.entities || {})
      .filter((entity) => entity?.position && entity !== this.bot.entity && entity.type !== 'player')
      .map((entity) => ({
        name: entity.name || entity.type,
        distance: Number(origin.distanceTo(entity.position).toFixed(1)),
        position: formatPosition(entity.position)
      }))
      .filter((entity) => entity.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
  }
}
