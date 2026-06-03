export class RLInterface {
  constructor({ learning } = {}) {
    this.learning = learning
    this.ready = false
  }

  reward(event) {
    if (event?.ok) return 1
    if (event?.reason) return -1
    return 0
  }

  collectExperience(action, context, result) {
    return this.learning?.record?.({
      action,
      context,
      result,
      reward: this.reward(result),
      penalty: result?.ok ? 0 : 1,
      outcome: result?.ok ? 'success' : 'failure'
    })
  }

  status() {
    return { ready: this.ready, mode: 'interface_only' }
  }
}
