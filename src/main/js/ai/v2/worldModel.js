import { compactEntity, compactInventory, formatPosition, now } from './utils'

const HOSTILES = new Set([
  'zombie',
  'skeleton',
  'creeper',
  'spider',
  'cave_spider',
  'drowned',
  'husk',
  'stray',
  'witch',
  'pillager',
  'vindicator',
  'ravager',
  'blaze',
  'ghast',
  'warden'
])

export class WorldModel {
  constructor({ bot, memory } = {}) {
    this.bot = bot
    this.memory = memory
    this.state = {
      bases: {},
      villages: {},
      mines: {},
      caves: {},
      portals: {},
      dangerZones: {},
      resources: {},
      players: {},
      structures: {}
    }
  }

  observe(radius = 16) {
    const bot = this.bot
    const position = formatPosition(bot?.entity?.position)
    const entities = Object.values(bot?.entities || {})
      .filter((entity) => entity?.position && entity !== bot.entity)
      .map((entity) => compactEntity(bot, entity))
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 24)
    const threats = entities.filter((entity) => HOSTILES.has(entity.name))
    const players = entities.filter((entity) => entity.type === 'player')
    const utilities = this.scanUtilityBlocks(radius)
    for (const player of players) {
      this.state.players[player.name] = { ...player, lastSeenAt: now() }
    }
    for (const threat of threats) {
      const key = `${threat.name}:${threat.position?.x}:${threat.position?.y}:${threat.position?.z}`
      this.state.dangerZones[key] = { ...threat, at: now() }
      this.memory?.rememberLocation?.(`danger:${key}`, threat)
    }
    const snapshot = {
      position,
      health: Math.round(bot?.health || 0),
      food: bot?.food,
      inventory: compactInventory(bot),
      players,
      threats,
      utilities,
      nearbyEntities: entities.slice(0, 12),
      radius
    }
    this.memory?.setWorking?.('worldSnapshot', snapshot)
    return snapshot
  }

  scanUtilityBlocks(radius = 16) {
    const names = ['chest', 'barrel', 'furnace', 'blast_furnace', 'smoker', 'crafting_table', 'bed']
    const ids = names
      .map((name) => this.bot?.registry?.blocksByName?.[name]?.id)
      .filter((id) => Number.isFinite(id))
    if (!ids.length || typeof this.bot?.findBlocks !== 'function' || !this.bot?.entity?.position) return []
    const blocks = this.bot
      .findBlocks({
        point: this.bot.entity.position,
        matching: ids,
        maxDistance: radius,
        count: 16
      })
      .map((position) => this.bot.blockAt(position))
      .filter(Boolean)
      .map((block) => ({
        name: block.name,
        position: formatPosition(block.position)
      }))
    for (const block of blocks) {
      const key = `utility:${block.name}:${block.position.x}:${block.position.y}:${block.position.z}`
      this.state.structures[key] = { ...block, at: now() }
      this.memory?.rememberLocation?.(key, block)
    }
    return blocks
  }

  rememberResource(name, position, detail = {}) {
    const key = `${name}:${position?.x}:${position?.y}:${position?.z}`
    this.state.resources[key] = { name, position, ...detail, at: now() }
    this.memory?.rememberResource?.(key, this.state.resources[key])
  }

  status() {
    return {
      players: Object.keys(this.state.players).length,
      resources: Object.keys(this.state.resources).length,
      dangerZones: Object.keys(this.state.dangerZones).length,
      structures: Object.keys(this.state.structures).length
    }
  }
}
