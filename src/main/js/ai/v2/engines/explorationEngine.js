export class ExplorationEngine {
  constructor({ skills } = {}) {
    this.skills = skills
  }

  async explore(reason = 'exploration', context = {}) {
    return this.skills.execute('explore', { reason }, context)
  }

  async cave(context = {}) {
    return this.skills.execute('explore_cave', { reason: 'find cave' }, context)
  }
}
