export class LLMProvider {
  constructor({ model = 'gemini-2.5-flash-lite', timeoutMs = 30000 } = {}) {
    this.model = model
    this.timeoutMs = timeoutMs
  }

  async generateGoal() {
    throw new Error('LLMProvider.generateGoal must be implemented')
  }

  async generatePlan() {
    throw new Error('LLMProvider.generatePlan must be implemented')
  }

  async chooseTool() {
    throw new Error('LLMProvider.chooseTool must be implemented')
  }

  async reflect() {
    throw new Error('LLMProvider.reflect must be implemented')
  }

  async chat() {
    throw new Error('LLMProvider.chat must be implemented')
  }

  async research() {
    throw new Error('LLMProvider.research must be implemented')
  }

  async summarize() {
    throw new Error('LLMProvider.summarize must be implemented')
  }
}
