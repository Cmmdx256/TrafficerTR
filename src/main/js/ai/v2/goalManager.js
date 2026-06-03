import { normalizeName, now } from './utils'

export class GoalManager {
  constructor({ knowledgeGraph } = {}) {
    this.knowledgeGraph = knowledgeGraph
    this.goals = []
  }

  add(goal) {
    const normalized = {
      id: goal.id || `${normalizeName(goal.name || goal.intent || 'goal')}:${now()}`,
      name: normalizeName(goal.name || goal.intent || goal.id),
      priority: Number(goal.priority || 50),
      reward: Number(goal.reward || 1),
      risk: Number(goal.risk || 0),
      urgency: Number(goal.urgency || 0),
      dependencies: goal.dependencies || this.knowledgeGraph?.dependencies?.(goal.name || goal.intent) || [],
      status: 'queued',
      createdAt: now(),
      ...goal
    }
    this.goals.push(normalized)
    return normalized
  }

  next() {
    return this.goals
      .filter((goal) => goal.status === 'queued' || goal.status === 'active')
      .sort((a, b) => b.priority + b.reward + b.urgency - b.risk - (a.priority + a.reward + a.urgency - a.risk))[0]
  }

  complete(id) {
    const goal = this.goals.find((entry) => entry.id === id)
    if (goal) goal.status = 'completed'
    return goal
  }

  fail(id, reason) {
    const goal = this.goals.find((entry) => entry.id === id)
    if (goal) {
      goal.status = 'failed'
      goal.failureReason = reason
    }
    return goal
  }

  status() {
    return {
      queued: this.goals.filter((goal) => goal.status === 'queued').length,
      active: this.goals.filter((goal) => goal.status === 'active').length,
      completed: this.goals.filter((goal) => goal.status === 'completed').length,
      failed: this.goals.filter((goal) => goal.status === 'failed').length
    }
  }
}
