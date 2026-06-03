export function now() {
  return Date.now()
}

export function clamp(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

export function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^minecraft:/, '')
    .replace(/[-\s]+/g, '_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function formatPosition(position) {
  if (!position) return undefined
  return {
    x: Math.floor(Number(position.x)),
    y: Math.floor(Number(position.y)),
    z: Math.floor(Number(position.z))
  }
}

export function distance(a, b) {
  if (!a || !b) return Infinity
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
}

export function compactInventory(bot) {
  return (bot?.inventory?.items?.() || []).map((item) => ({
    name: item.name,
    count: item.count
  }))
}

export function compactEntity(bot, entity) {
  if (!entity?.position) return undefined
  return {
    name: entity.username || entity.name || entity.type,
    type: entity.type,
    kind: entity.kind,
    distance: Number(distance(bot?.entity?.position, entity.position).toFixed(1)),
    position: formatPosition(entity.position)
  }
}
