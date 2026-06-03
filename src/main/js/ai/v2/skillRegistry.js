export class SkillRegistry {
  constructor() {
    this.skills = new Map()
  }

  register({ name, description, argumentsSchema = {}, execute }) {
    if (!name || typeof execute !== 'function') throw new Error(`Invalid skill registration: ${name}`)
    this.skills.set(name, { name, description, argumentsSchema, execute })
  }

  has(name) {
    return this.skills.has(name)
  }

  list() {
    return Array.from(this.skills.values()).map(({ name, description, argumentsSchema }) => ({
      name,
      description,
      arguments: argumentsSchema
    }))
  }

  async execute(name, args = {}, context = {}) {
    const skill = this.skills.get(name)
    if (!skill) return { ok: false, reason: `skill_not_registered:${name}` }
    const startedAt = Date.now()
    try {
      const result = await skill.execute(args, context)
      return { ok: result?.ok !== false, ...result, skill: name, durationMs: Date.now() - startedAt }
    } catch (error) {
      return { ok: false, reason: error.message, skill: name, durationMs: Date.now() - startedAt }
    }
  }
}
