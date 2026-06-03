export class LearningInterface {
  constructor({ memory } = {}) {
    this.memory = memory
  }

  record({ action, context, result, reward = 0, penalty = 0, outcome }) {
    const experience = { action, context, result, reward, penalty, outcome }
    this.memory?.recordExperience?.(experience)
    return experience
  }
}
