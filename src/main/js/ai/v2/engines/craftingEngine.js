export class CraftingEngine {
  constructor({ skills, knowledgeGraph } = {}) {
    this.skills = skills
    this.knowledgeGraph = knowledgeGraph
  }

  async craft(item, args = {}, context = {}) {
    return this.skills.execute('craft_item', { ...args, item, dependencies: this.knowledgeGraph?.dependencies?.(item) || [] }, context)
  }
}
