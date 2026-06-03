export class CombatEngine {
  constructor({ skills } = {}) {
    this.skills = skills
  }

  async protect(player, args = {}, context = {}) {
    return this.skills.execute('protect_player', { ...args, player }, context)
  }
}
