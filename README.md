# smee-it

[![npm version](https://img.shields.io/npm/v/smee-it.svg)](https://www.npmjs.com/package/smee-it)
[![npm downloads](https://img.shields.io/npm/dm/smee-it.svg)](https://www.npmjs.com/package/smee-it)
[![license](https://img.shields.io/npm/l/smee-it.svg)](https://github.com/vikiboss/smee-it/blob/main/LICENSE)
[![test coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/vikiboss/smee-it)

A modern [smee.io](https://smee.io) client for receiving webhooks locally via Server-Sent Events.

[English](#english) | [中文](#中文)

---

## English

### Introduction

When developing GitHub Apps or webhook-based integrations, you need a publicly accessible URL to receive HTTP callbacks. [smee.io](https://smee.io) provides this by forwarding webhooks to your local machine via SSE.

This library is a lightweight, event-driven client for receiving those forwarded events.

### Comparison with smee-client

The official [smee-client](https://github.com/probot/smee-client) uses a "target URL" pattern that requires running a local HTTP server. This library takes a different approach:

- **Event-driven API** — Subscribe to events directly without an intermediate HTTP server
- **Full TypeScript support** — Strict types with complete IDE integration
- **ESM-first** — Native ES modules with tree-shaking support
- **Self-hosted compatible** — Works with private smee server deployments

### Installation

```bash
npm install smee-it
```

### Quick Start

```ts
import { SmeeClient } from 'smee-it'

const client = new SmeeClient('https://smee.io/your-channel')

client.on('message', (event) => {
  console.log(event.body)     // webhook payload
  console.log(event.headers)  // original HTTP headers
})

client.on('error', (err) => console.error(err))

client.start()
```

Create a new channel programmatically:

```ts
const url = await SmeeClient.createChannel()
const client = new SmeeClient(url)
```

With a self-hosted smee server:

```ts
const url = await SmeeClient.createChannel('https://smee.example.com')
```

### API Reference

#### Constructor

**`new SmeeClient(url: string)`**

Creates a new client instance with the specified channel URL.

#### Static Methods

**`SmeeClient.createChannel(baseUrl?: string): Promise<string>`**

Creates a new channel and returns its URL. Defaults to `https://smee.io`.

#### Instance Methods

| Method | Description |
|--------|-------------|
| `start()` | Connect and begin receiving events |
| `stop()` | Disconnect and stop receiving events |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `connected` | `boolean` | Current connection status |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `SmeeMessage` | Webhook event received |
| `open` | — | Connection established |
| `close` | — | Connection closed |
| `error` | `Error` | Error occurred |
| `ping` | — | Heartbeat received |

#### SmeeMessage

```ts
interface SmeeMessage {
  body: Record<string, unknown>   // Parsed JSON body
  headers: Record<string, string> // HTTP headers
  query: Record<string, string>   // URL query parameters
  timestamp: number               // Unix timestamp (ms)
  rawBody: string                 // Raw body for signature verification
}
```

### Webhook Signature Verification

Since smee.io is a public service, always verify webhook signatures:

```ts
import { Webhooks } from '@octokit/webhooks'

const webhooks = new Webhooks({ secret: process.env.WEBHOOK_SECRET })

client.on('message', async (event) => {
  const signature = event.headers['x-hub-signature-256']
  if (!(await webhooks.verify(event.rawBody, signature))) {
    return
  }
  // Process verified event
})
```

### Security Considerations

smee.io channels are publicly accessible. Anyone with the channel URL can view the webhook data.

**Recommended for:**
- Local development and debugging
- CI/CD integration testing
- Open source project webhook testing

**Not recommended for:**
- Production environments
- Sensitive or confidential data

For sensitive use cases, consider [self-hosting smee](https://github.com/probot/smee.io).

---

## 中文

### 简介

开发 GitHub App 或基于 Webhook 的集成时，需要一个公网可访问的 URL 来接收 HTTP 回调。[smee.io](https://smee.io) 通过 SSE 将 Webhook 转发到本地来解决这个问题。

本库是一个轻量的事件驱动客户端，用于接收这些转发的事件。

### 与 smee-client 的对比

官方 [smee-client](https://github.com/probot/smee-client) 采用 "target URL" 模式，需要运行一个本地 HTTP 服务器。本库采用不同的方式：

- **事件驱动 API** — 直接订阅事件，无需中间 HTTP 服务器
- **完整 TypeScript 支持** — 严格类型定义，完善的 IDE 集成
- **ESM 优先** — 原生 ES 模块，支持 tree-shaking
- **支持私有部署** — 兼容自托管的 smee 服务器

### 安装

```bash
npm install smee-it
```

### 快速开始

```ts
import { SmeeClient } from 'smee-it'

const client = new SmeeClient('https://smee.io/your-channel')

client.on('message', (event) => {
  console.log(event.body)     // webhook 载荷
  console.log(event.headers)  // 原始 HTTP 头
})

client.on('error', (err) => console.error(err))

client.start()
```

通过代码创建新频道：

```ts
const url = await SmeeClient.createChannel()
const client = new SmeeClient(url)
```

使用自托管 smee 服务器：

```ts
const url = await SmeeClient.createChannel('https://smee.example.com')
```

### API 参考

#### 构造函数

**`new SmeeClient(url: string)`**

使用指定的频道 URL 创建客户端实例。

#### 静态方法

**`SmeeClient.createChannel(baseUrl?: string): Promise<string>`**

创建新频道并返回其 URL。默认使用 `https://smee.io`。

#### 实例方法

| 方法 | 说明 |
|------|------|
| `start()` | 建立连接，开始接收事件 |
| `stop()` | 断开连接，停止接收事件 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `connected` | `boolean` | 当前连接状态 |

#### 事件

| 事件 | 载荷 | 说明 |
|------|------|------|
| `message` | `SmeeMessage` | 收到 Webhook 事件 |
| `open` | — | 连接已建立 |
| `close` | — | 连接已关闭 |
| `error` | `Error` | 发生错误 |
| `ping` | — | 收到心跳 |

#### SmeeMessage

```ts
interface SmeeMessage {
  body: Record<string, unknown>   // 解析后的 JSON body
  headers: Record<string, string> // HTTP 请求头
  query: Record<string, string>   // URL 查询参数
  timestamp: number               // Unix 时间戳 (ms)
  rawBody: string                 // 原始 body（用于签名验证）
}
```

### Webhook 签名验证

由于 smee.io 是公开服务，建议始终验证 Webhook 签名：

```ts
import { Webhooks } from '@octokit/webhooks'

const webhooks = new Webhooks({ secret: process.env.WEBHOOK_SECRET })

client.on('message', async (event) => {
  const signature = event.headers['x-hub-signature-256']
  if (!(await webhooks.verify(event.rawBody, signature))) {
    return
  }
  // 处理已验证的事件
})
```

### 安全注意事项

smee.io 的频道是公开可访问的，任何知道频道 URL 的人都可以查看 Webhook 数据。

**推荐用于：**
- 本地开发调试
- CI/CD 集成测试
- 开源项目的 Webhook 测试

**不推荐用于：**
- 生产环境
- 敏感或机密数据

对于敏感场景，建议[自托管 smee 服务器](https://github.com/probot/smee.io)。

---

## License

MIT © [Viki](https://github.com/vikiboss)
