/**
 * SmeeClient - 简洁的 Smee.io SSE 客户端
 *
 * 用于接收 GitHub Webhook 等通过 smee.io 中转的事件。
 * 基于 Server-Sent Events (SSE) 实现，无需部署公网服务即可本地接收 Webhook。
 *
 * @remarks
 * smee.io 是公开服务，请勿用于传输敏感信息，仅建议用于开发测试。
 *
 * @example
 * 基础用法
 * ```ts
 * import { SmeeClient } from 'smee-it'
 *
 * const client = new SmeeClient('https://smee.io/your-channel')
 *
 * client.on('message', (event) => {
 *   console.log('收到事件:', event.body)
 *   console.log('请求头:', event.headers)
 * })
 *
 * client.on('error', (err) => console.error('错误:', err))
 *
 * client.start()
 * ```
 *
 * @example
 * 动态创建频道
 * ```ts
 * const channelUrl = await SmeeClient.createChannel()
 * const client = new SmeeClient(channelUrl)
 * client.on('message', (e) => console.log(e.body))
 * client.start()
 * ```
 *
 * @packageDocumentation
 */

import { EventSource } from 'eventsource'

/**
 * Smee 消息事件
 *
 * 包含通过 smee.io 中转的 Webhook 请求的完整信息。
 */
export interface SmeeMessage {
  /**
   * Webhook 请求体
   *
   * 包含原始 Webhook 的 JSON body 数据。
   * 对于 GitHub Webhook，通常包含 action、repository、sender 等字段。
   */
  body: Record<string, unknown>

  /**
   * URL 查询参数
   *
   * 原始 Webhook 请求 URL 中的查询参数。
   */
  query: Record<string, string>

  /**
   * 事件时间戳
   *
   * smee.io 接收到该事件的 Unix 时间戳（毫秒）。
   */
  timestamp: number

  /**
   * HTTP 请求头
   *
   * 原始 Webhook 请求的 HTTP 头信息。
   * 对于 GitHub Webhook，包含 x-github-event、x-github-delivery 等。
   */
  headers: Record<string, string>

  /**
   * 原始请求体字符串
   *
   * 用于 Webhook 签名验证。@octokit/webhooks 等库需要原始字符串进行 HMAC 验证。
   *
   * @example
   * ```ts
   * import { Webhooks } from '@octokit/webhooks'
   *
   * const webhooks = new Webhooks({ secret: process.env.WEBHOOK_SECRET! })
   * const isValid = await webhooks.verify(event.rawBody, event.headers['x-hub-signature-256'])
   * ```
   */
  rawBody: string
}

/**
 * SmeeClient 支持的事件类型映射
 *
 * @example
 * ```ts
 * client.on('message', (msg: SmeeMessage) => { ... })
 * client.on('open', () => { ... })
 * client.on('error', (err: Error) => { ... })
 * client.on('close', () => { ... })
 * client.on('ping', () => { ... })
 * ```
 */
export type SmeeEvents = {
  /** 收到 Webhook 消息事件 */
  message: SmeeMessage
  /** 收到 smee.io 服务端心跳 */
  ping: undefined
  /** SSE 连接已建立 */
  open: undefined
  /** 发生错误（如网络中断、解析失败等） */
  error: Error
  /** 连接已关闭 */
  close: undefined
}

/**
 * 事件处理函数类型
 * @typeParam T - 事件数据类型
 * @internal
 */
type Handler<T> = (data: T) => void

/**
 * Smee.io SSE 客户端
 *
 * 通过 Server-Sent Events 连接到 smee.io 频道，
 * 实时接收并解析转发的 Webhook 事件。
 *
 * @example
 * ```ts
 * const client = new SmeeClient('https://smee.io/abc123')
 *
 * client
 *   .on('open', () => console.log('已连接'))
 *   .on('message', (e) => console.log('消息:', e.body))
 *   .on('error', (e) => console.error('错误:', e))
 *   .start()
 *
 * // 稍后停止
 * client.stop()
 * ```
 */
export class SmeeClient {
  /** smee.io 频道 URL */
  #source: string
  /** EventSource 实例 */
  #es: EventSource | null = null
  /** 事件处理器映射 */
  #handlers = new Map<string, Set<Handler<unknown>>>()

  /**
   * 创建 SmeeClient 实例
   *
   * @param source - smee.io 频道 URL，如 `https://smee.io/your-channel-id`
   *
   * @example
   * ```ts
   * const client = new SmeeClient('https://smee.io/abc123')
   * ```
   */
  constructor(source: string) {
    this.#source = source.replace(/\/$/, '')
  }

  /**
   * 当前是否已连接到 smee.io
   *
   * @returns 如果 SSE 连接处于打开状态则返回 `true`
   *
   * @example
   * ```ts
   * if (client.connected) {
   *   console.log('客户端已连接')
   * }
   * ```
   */
  get connected(): boolean {
    return this.#es?.readyState === EventSource.OPEN
  }

  /**
   * 创建新的 smee 频道
   *
   * 向 smee 服务器发送请求以获取一个新的唯一频道 URL。
   * 该频道可用于接收 Webhook 事件。
   *
   * @param baseUrl - 可选，smee 服务器基础 URL，默认为 `https://smee.io`。
   *                  支持私有部署的 smee 服务器。
   * @returns 新创建的频道 URL
   * @throws 如果创建频道失败则抛出错误
   *
   * @example
   * 使用 smee.io 官方服务
   * ```ts
   * const channelUrl = await SmeeClient.createChannel()
   * // 输出: https://smee.io/aBcDeFgHiJkLmNoP
   * ```
   *
   * @example
   * 使用私有部署的 smee 服务器
   * ```ts
   * const channelUrl = await SmeeClient.createChannel('https://smee.example.com')
   * // 输出: https://smee.example.com/aBcDeFgHiJkLmNoP
   * ```
   */
  static async createChannel(baseUrl = 'https://smee.io'): Promise<string> {
    const url = baseUrl.replace(/\/$/, '')
    const res = await fetch(`${url}/new`, { method: 'HEAD', redirect: 'manual' })
    const location = res.headers.get('location')
    if (!location) throw new Error('Failed to create new Smee channel')
    return location
  }

  /**
   * 注册事件监听器
   *
   * 支持链式调用。
   *
   * @typeParam K - 事件名称类型
   * @param event - 事件名称
   * @param handler - 事件处理函数
   * @returns 当前实例，支持链式调用
   *
   * @example
   * ```ts
   * client
   *   .on('open', () => console.log('已连接'))
   *   .on('message', (e) => console.log(e.body))
   *   .on('error', (e) => console.error(e))
   * ```
   */
  on<K extends keyof SmeeEvents>(event: K, handler: Handler<SmeeEvents[K]>): this {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set())
    this.#handlers.get(event)!.add(handler as Handler<unknown>)
    return this
  }

  /**
   * 移除事件监听器
   *
   * @typeParam K - 事件名称类型
   * @param event - 事件名称
   * @param handler - 要移除的事件处理函数（必须是同一个函数引用）
   * @returns 当前实例，支持链式调用
   *
   * @example
   * ```ts
   * const handler = (e: SmeeMessage) => console.log(e)
   * client.on('message', handler)
   * // 稍后移除
   * client.off('message', handler)
   * ```
   */
  off<K extends keyof SmeeEvents>(event: K, handler: Handler<SmeeEvents[K]>): this {
    this.#handlers.get(event)?.delete(handler as Handler<unknown>)
    return this
  }

  /**
   * 触发事件
   * @internal
   */
  #emit<K extends keyof SmeeEvents>(event: K, data: SmeeEvents[K]): void {
    this.#handlers.get(event)?.forEach(h => h(data))
  }

  /**
   * 启动客户端，开始接收事件
   *
   * 建立与 smee.io 的 SSE 连接。如果已经连接，调用此方法不会有任何效果。
   * 连接建立后会触发 `open` 事件，收到消息时触发 `message` 事件。
   *
   * @example
   * ```ts
   * client.on('open', () => console.log('连接成功'))
   * client.on('message', (e) => {
   *   // 处理 GitHub Webhook 事件
   *   if (e.headers['x-github-event'] === 'push') {
   *     console.log('收到 push 事件:', e.body)
   *   }
   * })
   * client.start()
   * ```
   */
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
        body: (body ?? {}) as Record<string, unknown>,
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

  /**
   * 停止客户端，断开连接
   *
   * 关闭 SSE 连接并触发 `close` 事件。
   * 停止后可以再次调用 `start()` 重新连接。
   *
   * @example
   * ```ts
   * // 优雅关闭
   * client.on('close', () => console.log('已断开连接'))
   * client.stop()
   * ```
   */
  stop(): void {
    this.#es?.close()
    this.#es = null
    this.#emit('close', undefined)
  }
}

export default SmeeClient

