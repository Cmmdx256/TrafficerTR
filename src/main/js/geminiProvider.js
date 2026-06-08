import { LLMProvider } from './llmProvider'

const DEFAULT_SYSTEM_PROMPT = [
  'You are Gemini, the Minecraft bot controller for this Mineflayer client.',
  'You are not the body. You never directly control W/A/S/D, mouse movement, pathfinding, mining, combat, inventory clicking, or crafting.',
  'Execution is deterministic code. Your role is strategy, goal selection, reflection, research, and validated tool decisions.',
  'Respond with JSON only when JSON is requested. No markdown.'
].join(' ')

function extractJson(text) {
  if (!text) return undefined
  const trimmed = String(text).trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return extractJson(fenced[1])
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return undefined
    try {
      return JSON.parse(match[0])
    } catch {
      return undefined
    }
  }
}

function fallbackGoalFromText(text) {
  const normalized = String(text || '').toLowerCase()
  if (/wood|log|tree|plank|agac|odun/.test(normalized)) return 'gather_wood'
  if (/food|eat|hunger|yemek|ac/.test(normalized)) return 'get_food'
  if (/stone|cobble|tas/.test(normalized)) return 'gather_stone'
  if (/iron|demir/.test(normalized)) return 'gather_iron'
  if (/danger|mob|combat|fight|kac/.test(normalized)) return 'survive_threat'
  return 'gather_wood'
}

function fallbackPlanFromText(text, tools = []) {
  const goal = fallbackGoalFromText(text)
  const steps = []
  if (tools.includes('mine_block')) {
    steps.push({
      tool: goal === 'gather_stone' ? 'mine_block' : 'mine_block',
      args: { block: goal === 'gather_stone' ? 'stone' : 'wood', count: 1, range: 64 },
      reason: goal === 'gather_stone' ? 'Collect stone' : 'Find tree and mine wood'
    })
  }
  if (goal !== 'gather_stone' && tools.includes('craft_item')) {
    steps.push({ tool: 'craft_item', args: { item: 'planks', count: 4 }, reason: 'Craft planks' })
  }
  return { goal, priority: 1, activeAgent: 'Strategic Cortex', steps }
}

const GEMINI_QUEUE = {
  chain: Promise.resolve(),
  inflight: new Map(),
  recent: new Map(),
  lastRequestAt: 0,
  minIntervalMs: Number(process.env.GEMINI_MIN_INTERVAL_MS || 1500)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hashText(text) {
  let hash = 0
  const value = String(text || '')
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return String(hash)
}

function explainGeminiError(message) {
  const text = String(message || '')
  if (/denied access|permission denied|api key not valid|api_key_invalid/i.test(text)) {
    return `${text} Check the Gemini API key, AI Studio project access, and billing/quota. Create a fresh key from the same enabled project if needed.`
  }
  return text
}

export class GeminiProvider extends LLMProvider {
  constructor({
    apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
    model = 'gemini-flash-latest',
    fallbackModels = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    timeoutMs = 45000,
    retries = 2
  } = {}) {
    super({ model, timeoutMs })
    this.provider = 'gemini'
    this.apiKey = apiKey
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.fallbackModels = fallbackModels
    this.retries = retries
    this.available = undefined
    this.lastRawResponse = undefined
    this.lastPrompt = undefined
    this.lastParsed = undefined
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      retries: 0,
      totalLatencyMs: 0,
      lastLatencyMs: 0,
      lastError: undefined
    }
  }

  endpoint(path = '', modelName = this.model) {
    const model = String(modelName || '').startsWith('models/') ? modelName : `models/${modelName}`
    return `${this.baseUrl}/${model}${path}`
  }

  modelCandidates() {
    return [this.model, ...this.fallbackModels].filter((model, index, models) => {
      return model && models.indexOf(model) === index
    })
  }

  isRetryableError(response, data = {}) {
    const message = String(data.error?.message || '').toLowerCase()
    return (
      response.status === 429 ||
      response.status === 500 ||
      response.status === 503 ||
      message.includes('high demand') ||
      message.includes('try again later') ||
      message.includes('overloaded') ||
      message.includes('unavailable')
    )
  }

  isRetryableException(error) {
    const message = String(error?.message || error?.name || '').toLowerCase()
    return (
      message.includes('timeout') ||
      message.includes('aborted') ||
      message.includes('network') ||
      message.includes('fetch failed') ||
      error?.name === 'TimeoutError' ||
      error?.name === 'AbortError'
    )
  }

  async health() {
    if (!this.apiKey) {
      this.available = false
      this.metrics.lastError = 'gemini_api_key_missing'
      return false
    }
    this.available = true
    return true
  }

  async complete(prompt, { system = DEFAULT_SYSTEM_PROMPT, format = 'json' } = {}) {
    const key = `${this.model}:${format}:${hashText(system)}:${hashText(prompt)}`
    const recent = GEMINI_QUEUE.recent.get(key)
    if (recent && Date.now() - recent.at < 2500) return recent.response
    if (GEMINI_QUEUE.inflight.has(key)) return GEMINI_QUEUE.inflight.get(key)

    const request = GEMINI_QUEUE.chain.then(async () => {
      const waitMs = GEMINI_QUEUE.minIntervalMs - (Date.now() - GEMINI_QUEUE.lastRequestAt)
      if (waitMs > 0) await sleep(waitMs)
      GEMINI_QUEUE.lastRequestAt = Date.now()
      return this.completeNow(prompt, { system, format })
    })
    GEMINI_QUEUE.chain = request.catch(() => {})
    GEMINI_QUEUE.inflight.set(key, request)
    const response = await request.finally(() => GEMINI_QUEUE.inflight.delete(key))
    GEMINI_QUEUE.recent.set(key, { response, at: Date.now() })
    if (GEMINI_QUEUE.recent.size > 80) {
      const oldest = [...GEMINI_QUEUE.recent.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (oldest) GEMINI_QUEUE.recent.delete(oldest[0])
    }
    return response
  }

  async completeNow(prompt, { system = DEFAULT_SYSTEM_PROMPT, format = 'json' } = {}) {
    const startedAt = Date.now()
    this.metrics.requests++
    this.lastPrompt = prompt

    if (!(await this.health())) {
      this.metrics.failures++
      return { ok: false, error: 'gemini_api_key_missing', text: '', json: undefined }
    }

    let lastError
    for (const modelName of this.modelCandidates()) {
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          console.log('[GEMINI] Request Sent', { model: modelName, attempt: attempt + 1 })
          const response = await fetch(this.endpoint(':generateContent', modelName), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': this.apiKey
            },
            signal: AbortSignal.timeout(this.timeoutMs),
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: system }]
              },
              contents: [
                {
                  role: 'user',
                  parts: [{ text: prompt }]
                }
              ],
              generationConfig: {
                temperature: 0.25,
                topP: 0.9,
                responseMimeType: format === 'json' ? 'application/json' : 'text/plain'
              }
            })
          })
          const data = await response.json().catch(() => ({}))
          this.lastRawResponse = data
          const text =
            data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || ''
          const json = format === 'json' ? extractJson(text) : undefined
          this.lastParsed = json

          const latencyMs = Date.now() - startedAt
          this.metrics.lastLatencyMs = latencyMs
          this.metrics.totalLatencyMs += latencyMs
          if (response.ok) this.metrics.successes++
          else this.metrics.failures++

          if (!response.ok) {
            const message = explainGeminiError(
              data.error?.message || `gemini_http_${response.status}`
            )
            this.metrics.lastError = message
            lastError = new Error(message)
            if (this.isRetryableError(response, data)) {
              console.log('[GEMINI] Retryable model failure', { model: modelName, message })
              break
            }
            return { ok: false, error: message, text, json, raw: data, model: modelName }
          }

          if (modelName !== this.model) {
            console.log('[GEMINI] Fallback model selected', { from: this.model, to: modelName })
            this.model = modelName
          }
          return { ok: true, text, json, raw: data, model: modelName }
        } catch (error) {
          lastError = error
          this.metrics.retries++
          console.log('[GEMINI] Request failed', error)
          if (attempt < this.retries && this.isRetryableException(error)) {
            await sleep(900 + attempt * 1400)
            continue
          }
          if (this.isRetryableException(error)) break
        }
      }
    }

    this.metrics.failures++
    this.metrics.lastError = explainGeminiError(
      lastError?.message || lastError?.name || 'gemini_error'
    )
    return { ok: false, error: this.metrics.lastError, text: '', json: undefined }
  }

  async generateGoal(worldState, memories = {}) {
    return this.complete(
      JSON.stringify({
        task: 'generate_goal',
        worldState,
        memories,
        instructions:
          'Return only strategic goal JSON. Do not create low-level movement/pathfinding/mining/combat steps.',
        responseShape: {
          goal: 'short goal id',
          reason: 'why now',
          priority: 1,
          agent: 'Survival Agent | Explorer Agent | Builder Agent | Combat Agent | Research Agent'
        }
      })
    )
  }

  async generatePlan(worldState, goal, tools = []) {
    const response = await this.complete(
      JSON.stringify({
        task: 'generate_plan',
        goal,
        worldState,
        allowedTools: tools,
        instructions:
          'Return JSON with non-empty steps. Use only allowedTools. Keep steps high-level tool calls.',
        responseShape: {
          goal: 'goal id',
          priority: 1,
          activeAgent: 'agent name',
          steps: [{ tool: 'mine_block', args: {}, reason: 'short reason' }]
        }
      })
    )
    if (response.ok && !response.json && response.text) {
      response.json = fallbackPlanFromText(response.text, tools)
      response.fallbackParsed = true
    }
    return response
  }

  async chooseTool(observation, tools = [], memories = {}) {
    return this.complete(
      JSON.stringify({
        task: 'choose_tool',
        observation,
        tools,
        memories,
        rules: [
          'Return exactly one JSON object.',
          'Use only one tool from tools[].name.',
          'Do not directly control movement, camera, mining, combat, inventory clicks, or crafting.'
        ],
        responseShape: { tool: 'tool_name', args: {}, reason: 'short reason' }
      })
    )
  }

  async reflect(event, worldState, memories = {}) {
    return this.complete(
      JSON.stringify({
        task: 'reflect',
        event,
        worldState,
        memories,
        responseShape: {
          lesson: 'reusable lesson',
          strategy: 'future strategy',
          memoryType: 'lesson',
          metricChanges: { survivalRate: 0, combatEffectiveness: 0, miningEfficiency: 0 }
        }
      })
    )
  }

  async chat(message, worldState, memories = {}) {
    return this.complete(
      JSON.stringify({
        task: 'chat',
        message,
        worldState,
        memories,
        responseShape: { reply: 'short in-game answer' }
      }),
      { format: undefined }
    )
  }

  async research(hypothesis, worldState, memories = {}) {
    return this.complete(
      JSON.stringify({
        task: 'research',
        hypothesis,
        worldState,
        memories,
        responseShape: {
          hypothesis,
          test: 'what to observe or do',
          expectedEvidence: 'what would confirm it',
          toolPlan: [{ tool: 'explore_area', args: {}, reason: 'short reason' }]
        }
      })
    )
  }

  async summarize(worldState, memories = {}) {
    return this.complete(
      JSON.stringify({
        task: 'summarize',
        worldState,
        memories,
        responseShape: { summary: 'compressed state summary' }
      })
    )
  }

  performance() {
    return {
      ...this.metrics,
      queue: {
        minIntervalMs: GEMINI_QUEUE.minIntervalMs,
        inflight: GEMINI_QUEUE.inflight.size,
        recent: GEMINI_QUEUE.recent.size
      },
      averageLatencyMs:
        this.metrics.successes > 0
          ? Math.round(this.metrics.totalLatencyMs / this.metrics.successes)
          : 0
    }
  }
}

export function createGeminiProvider(options) {
  return new GeminiProvider(options)
}
