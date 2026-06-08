export class BuildingEngine {
  constructor({ skills } = {}) {
    this.skills = skills
  }

  async build(template, args = {}, context = {}) {
    if (template === 'crafting_table')
      return this.skills.execute('make_crafting_table_for_player', args, context)
    return this.skills.execute('build_structure', { ...args, template }, context)
  }
}
