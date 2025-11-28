# smee-it

[![npm version](https://img.shields.io/npm/v/smee-it.svg)](https://www.npmjs.com/package/smee-it)
[![npm downloads](https://img.shields.io/npm/dm/smee-it.svg)](https://www.npmjs.com/package/smee-it)
[![license](https://img.shields.io/npm/l/smee-it.svg)](https://github.com/vikiboss/smee-it/blob/main/LICENSE)
[![test coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/vikiboss/smee-it)

A lightweight [smee.io](https://smee.io) client for receiving webhooks locally via SSE.

[English](#english) | [中文](#中文)

---

## English

### Why smee-it?

When building GitHub Apps or webhook integrations, you need a public URL for callbacks. [smee.io](https://smee.io) provides this by forwarding webhooks to localhost via Server-Sent Events.

The official [smee-client](https://github.com/probot/smee-client) requires a local HTTP server. This library takes a simpler approach — just subscribe to events directly.

### Install

```bash
npm install smee-it
```

### Usage

```ts
import { SmeeClient } from 'smee-it'

const client = new SmeeClient('https://smee.io/your-channel')

client.on('message', (event) => {
  console.log(event.body)
  console.log(event.headers['x-github-event'])
})

client.start()
```

Create a channel programmatically:

```ts
const url = await SmeeClient.createChannel()
```

Self-hosted server:

```ts
const url = await SmeeClient.createChannel('https://smee.example.com')
```

### API

**`new SmeeClient(url)`** — Create client with channel URL

**`SmeeClient.createChannel(baseUrl?)`** — Create new channel, returns URL

**`client.start()`** — Connect and receive events

**`client.stop()`** — Disconnect

**`client.connected`** — Connection status

**`client.on(event, handler)`** — Subscribe to events:
- `message` — Webhook received
- `open` / `close` — Connection state
- `error` — Error occurred
- `ping` — Heartbeat

**SmeeMessage:**

```ts
interface SmeeMessage {
  body: any                       // Webhook payload
  headers: Record<string, string> // HTTP headers
  query: Record<string, string>   // Query params
  timestamp: number               // Unix timestamp (ms)
  rawBody: string                 // For signature verification
}
```

### Example: GitHub Star Notifications

**1. Get a channel URL**

```ts
const url = await SmeeClient.createChannel()
// https://smee.io/xxxxxxxx
```

**2. Configure GitHub Webhook**

Go to your repo → Settings → Webhooks → Add webhook:
- **Payload URL**: your smee channel URL
- **Content type**: `application/json`
- **Events**: Select "Stars"

**3. Listen for events**

```ts
const client = new SmeeClient('https://smee.io/your-channel')

client.on('message', (event) => {
  if (event.headers['x-github-event'] === 'star') {
    const { action, sender, repository } = event.body
    if (action === 'created') {
      console.log(`⭐ ${sender.login} starred ${repository.full_name}`)
    }
  }
})

client.start()
```

### Signature Verification

```ts
import { Webhooks } from '@octokit/webhooks'

const webhooks = new Webhooks({ secret: process.env.WEBHOOK_SECRET })

client.on('message', async (event) => {
  const sig = event.headers['x-hub-signature-256']
  if (!(await webhooks.verify(event.rawBody, sig))) return
  // Handle verified event
})
```

### Security

smee.io channels are public — anyone with your URL can see the data.

**Good for:** local dev, CI tests, open source projects

**Not for:** production, sensitive data

Consider [self-hosting smee](https://github.com/probot/smee.io) for sensitive projects.

---

## 中文

### 为什么用 smee-it？

开发 GitHub App 或 Webhook 集成时，需要公网 URL 来接收回调。[smee.io](https://smee.io) 通过 SSE 把 Webhook 转发到本地。

官方 [smee-client](https://github.com/probot/smee-client) 需要本地 HTTP 服务器。本库更简单 — 直接订阅事件。

### 安装

```bash
npm install smee-it
```

### 使用

```ts
import { SmeeClient } from 'smee-it'

const client = new SmeeClient('https://smee.io/your-channel')

client.on('message', (event) => {
  console.log(event.body)
  console.log(event.headers['x-github-event'])
})

client.start()
```

代码创建频道：

```ts
const url = await SmeeClient.createChannel()
```

自建服务器：

```ts
const url = await SmeeClient.createChannel('https://smee.example.com')
```

### API

**`new SmeeClient(url)`** — 创建客户端

**`SmeeClient.createChannel(baseUrl?)`** — 创建频道，返回 URL

**`client.start()`** — 开始接收

**`client.stop()`** — 断开连接

**`client.connected`** — 连接状态

**`client.on(event, handler)`** — 监听事件：
- `message` — 收到 Webhook
- `open` / `close` — 连接状态
- `error` — 出错
- `ping` — 心跳

**SmeeMessage:**

```ts
interface SmeeMessage {
  body: any                       // Webhook 载荷
  headers: Record<string, string> // HTTP 头
  query: Record<string, string>   // 查询参数
  timestamp: number               // 时间戳 (ms)
  rawBody: string                 // 用于签名验证
}
```

### 示例：GitHub Star 通知

**1. 获取频道 URL**

```ts
const url = await SmeeClient.createChannel()
// https://smee.io/xxxxxxxx
```

**2. 配置 GitHub Webhook**

进入仓库 → Settings → Webhooks → Add webhook：
- **Payload URL**：smee 频道 URL
- **Content type**：`application/json`
- **Events**：选择 "Stars"

**3. 监听事件**

```ts
const client = new SmeeClient('https://smee.io/your-channel')

client.on('message', (event) => {
  if (event.headers['x-github-event'] === 'star') {
    const { action, sender, repository } = event.body
    if (action === 'created') {
      console.log(`⭐ ${sender.login} starred ${repository.full_name}`)
    }
  }
})

client.start()
```

### 签名验证

```ts
import { Webhooks } from '@octokit/webhooks'

const webhooks = new Webhooks({ secret: process.env.WEBHOOK_SECRET })

client.on('message', async (event) => {
  const sig = event.headers['x-hub-signature-256']
  if (!(await webhooks.verify(event.rawBody, sig))) return
  // 处理已验证事件
})
```

### 安全

smee.io 频道是公开的 — 知道 URL 就能看到数据。

**适合：** 本地开发、CI 测试、开源项目

**不适合：** 生产环境、敏感数据

敏感项目建议[自建 smee](https://github.com/probot/smee.io)。

---

## License

MIT © [Viki](https://github.com/vikiboss)
