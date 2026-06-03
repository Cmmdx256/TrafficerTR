export class SurvivalEngine {
  constructor({ bot, skills } = {}) {
    this.bot = bot
    this.skills = skills
  }

  risk() {
    const health = Number(this.bot?.health || 0)
    const food = Number(this.bot?.food || 20)
    return {
      health,
      food,
      critical: health > 0 && (health <= 8 || food <= 4),
      hungry: food <= 12
    }
  }

  async overrideIfNeeded(context = {}) {
    const risk = this.risk()
    if (!risk.critical) return undefined
    if (risk.hungry) return this.skills.execute('eat_food', {}, context)
    return this.skills.execute('explore', { reason: 'survival retreat' }, context)
  }

  status() {
    return this.risk()
  }
}
