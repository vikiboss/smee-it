/**
 * A lightweight smee.io client for receiving webhooks locally via SSE.
 *
 * @example
 * ```ts
 * import { SmeeClient } from 'smee-it'
 *
 * const client = new SmeeClient('https://smee.io/your-channel')
 *
 * client.on('message', (event) => {
 *   console.log(event.body)
 *   console.log(event.headers['x-github-event'])
 * })
 *
 * client.start()
 * ```
 *
 * @packageDocumentation
 */

import { EventSource } from 'eventsource'

/**
 * Webhook message received via smee.io.
 */
export interface SmeeMessage<T = any> {
  /** Parsed JSON body of the webhook request. */
  body: T
  /** URL query parameters. */
  query: Record<string, string>
  /** Unix timestamp (ms) when smee.io received the event. */
  timestamp: number
  /** HTTP headers (e.g., `x-github-event`, `x-github-delivery`). */
  headers: Record<string, string>
  /** Raw body string for signature verification. */
  rawBody: string
}

/**
 * Event types supported by SmeeClient.
 */
export type SmeeEvents<T = any> = {
  /** Webhook message received. */
  message: SmeeMessage<T>
  /** Heartbeat from smee.io. */
  ping: undefined
  /** SSE connection opened. */
  open: undefined
  /** Error occurred. */
  error: Error
  /** Connection closed. */
  close: undefined
}

/**
 * 事件处理函数类型
 * @typeParam T - 事件数据类型
 * @internal
 */
type Handler<T> = (data: T) => void

/**
 * Smee.io SSE client for receiving webhooks locally.
 *
 * @example
 * ```ts
 * const client = new SmeeClient('https://smee.io/abc123')
 * client.on('message', (e) => console.log(e.body))
 * client.start()
 * ```
 */
export class SmeeClient<T = any> {
  #source: string
  #es: EventSource | null = null
  #handlers = new Map<string, Set<Handler<unknown>>>()

  /**
   * @param source - Smee channel URL (e.g., `https://smee.io/abc123`)
   */
  constructor(source: string) {
    this.#source = source.replace(/\/$/, '')
  }

  /** Whether the client is currently connected. */
  get connected(): boolean {
    return this.#es?.readyState === EventSource.OPEN
  }

  /**
   * Create a new smee channel.
   * @param baseUrl - Smee server URL (defaults to `https://smee.io`)
   * @returns The new channel URL
   */
  static async createChannel(baseUrl = 'https://smee.io'): Promise<string> {
    const url = baseUrl.replace(/\/$/, '')
    const res = await fetch(`${url}/new`, { method: 'HEAD', redirect: 'manual' })
    const location = res.headers.get('location')
    if (!location) throw new Error('Failed to create new Smee channel')
    return location
  }

  /** Register an event listener. Supports chaining. */
  on<K extends keyof SmeeEvents<T>>(event: K, handler: Handler<SmeeEvents<T>[K]>): this {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set())
    this.#handlers.get(event)!.add(handler as Handler<unknown>)
    return this
  }

  /** Remove an event listener. */
  off<K extends keyof SmeeEvents<T>>(event: K, handler: Handler<SmeeEvents<T>[K]>): this {
    this.#handlers.get(event)?.delete(handler as Handler<unknown>)
    return this
  }

  /**
   * 触发事件
   * @internal
   */
  #emit<K extends keyof SmeeEvents<T>>(event: K, data: SmeeEvents<T>[K]): void {
    this.#handlers.get(event)?.forEach(h => h(data))
  }

  /** Start receiving events. No-op if already connected. */
  start(): void {
    if (this.#es) return

    const es = (this.#es = new EventSource(this.#source))

    es.onopen = () => this.#emit('open', undefined)

    es.onmessage = e => {
      const raw = JSON.parse(e.data) as Record<string, unknown>
      const { body, query, timestamp, ...rest } = raw

      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(rest)) {
        if (typeof v === 'string') headers[k] = v
      }

      // 保留原始 body 字符串用于签名验证
      const rawBody = body !== undefined ? JSON.stringify(body) : ''

      this.#emit('message', {
        body: (body ?? {}) as T,
        query: (query ?? {}) as Record<string, string>,
        timestamp: (timestamp ?? Date.now()) as number,
        headers,
        rawBody,
      })
    }

    es.addEventListener('ping', () => this.#emit('ping', undefined))

    es.onerror = e => {
      this.#emit(
        'error',
        new Error('message' in e ? (e.message as string) : 'EventSource error', { cause: e })
      )
    }
  }

  /** Stop receiving events and close the connection. */
  stop(): void {
    this.#es?.close()
    this.#es = null
    this.#emit('close', undefined)
  }
}

export default SmeeClient
