export class ReflectionEngine {
  constructor({ memory } = {}) {
    this.memory = memory
  }

  reflect(event, context = {}) {
    const lesson = this.lessonFrom(event, context)
    this.memory?.rememberLesson?.(lesson, context)
    return { lesson, context }
  }

  lessonFrom(event, context = {}) {
    const reason = String(context.reason || event || '').toLowerCase()
    if (reason.includes('missing')) return 'Check prerequisites before retrying the same action.'
    if (reason.includes('path') || reason.includes('stuck'))
      return 'Use alternative route or terrain modification before repeating movement.'
    if (reason.includes('health') || reason.includes('food'))
      return 'Survival risk overrides normal goals.'
    return `Review outcome: ${event}`
  }
}
