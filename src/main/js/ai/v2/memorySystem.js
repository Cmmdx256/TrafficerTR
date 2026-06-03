import fs from 'node:fs'
import path from 'node:path'
import { now } from './utils'

export class MemorySystem {
  constructor({ basePath, memory } = {}) {
    this.basePath = basePath || path.join(process.cwd(), 'trafficer-ai-v2-memory.json')
    this.externalMemory = memory
    this.state = {
      shortTerm: {},
      longTerm: {
        discoveries: [],
        failures: [],
        successes: [],
        deaths: [],
        lessons: [],
        knownLocations: {},
        knownResources: {}
      },
      learning: []
    }
    this.load()
  }

  load() {
    try {
      if (fs.existsSync(this.basePath)) {
        this.state = {
          ...this.state,
          ...JSON.parse(fs.readFileSync(this.basePath, 'utf8'))
        }
      }
    } catch {
      
    }
  }

  save() {
    try {
      fs.writeFileSync(this.basePath, JSON.stringify(this.state, null, 2))
    } catch {
      
    }
  }

  setWorking(key, value) {
    this.state.shortTerm[key] = value
    this.externalMemory?.setWorking?.(key, value)
  }

  rememberLocation(key, value) {
    this.state.longTerm.knownLocations[key] = { ...value, at: now() }
    this.save()
  }

  rememberResource(key, value) {
    this.state.longTerm.knownResources[key] = { ...value, at: now() }
    this.save()
  }

  rememberSuccess(reason, context = {}) {
    this.state.longTerm.successes.push({ reason, context, at: now() })
    this.externalMemory?.rememberSuccess?.(reason, context)
    this.prune()
  }

  rememberFailure(reason, context = {}) {
    this.state.longTerm.failures.push({ reason, context, at: now() })
    this.externalMemory?.rememberFailure?.(reason, context)
    this.prune()
  }

  rememberLesson(reason, context = {}) {
    this.state.longTerm.lessons.push({ reason, context, at: now() })
    this.prune()
  }

  recordExperience(experience) {
    this.state.learning.push({ ...experience, at: now() })
    this.prune()
  }

  prune() {
    for (const key of ['discoveries', 'failures', 'successes', 'deaths', 'lessons']) {
      if (this.state.longTerm[key].length > 300) this.state.longTerm[key].splice(0, this.state.longTerm[key].length - 300)
    }
    if (this.state.learning.length > 500) this.state.learning.splice(0, this.state.learning.length - 500)
    this.save()
  }

  summary() {
    return {
      locations: Object.keys(this.state.longTerm.knownLocations).length,
      resources: Object.keys(this.state.longTerm.knownResources).length,
      failures: this.state.longTerm.failures.length,
      successes: this.state.longTerm.successes.length,
      lessons: this.state.longTerm.lessons.length,
      experiences: this.state.learning.length
    }
  }
}
