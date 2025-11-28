# smee-it

[![npm version](https://img.shields.io/npm/v/smee-it.svg)](https://www.npmjs.com/package/smee-it)
[![npm downloads](https://img.shields.io/npm/dm/smee-it.svg)](https://www.npmjs.com/package/smee-it)
[![license](https://img.shields.io/npm/l/smee-it.svg)](https://github.com/vikiboss/smee-it/blob/main/LICENSE)
[![test coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/vikiboss/smee-it)

A lightweight [smee.io](https://smee.io) client for receiving webhooks on localhost — critical for developing GitHub Apps, Bots, and webhook integrations.

[English](#english) | [中文](#中文)

---

## English

### The Problem

When developing webhook-based applications (GitHub Apps, Slack Bots, payment integrations, etc.), you face a common challenge: **webhooks need a public URL, but your development machine is behind NAT/firewall**.

Traditional solutions like ngrok require extra setup and often have rate limits. The official [smee-client](https://github.com/probot/smee-client) solves this but forces you to run a local HTTP server with a "target URL" pattern.

### The Solution

**smee-it** provides a simpler, event-driven approach:

- **No local HTTP server needed** — Subscribe to webhook events directly in your code
- **Full TypeScript support** — Great IDE experience with auto-completion
- **Works with self-hosted smee** — Not locked to smee.io
- **Lightweight** — Minimal dependencies, ESM-first

### Install

```bash
npm install smee-it
```

### Quick Start

```ts
import { SmeeClient } from 'smee-it'

// 1. Create a client with your smee channel URL
const client = new SmeeClient('https://smee.io/your-channel')

// 2. Listen for webhook events
client.on('message', (event) => {
  console.log('Received webhook!')
  console.log('Event type:', event.headers['x-github-event'])
  console.log('Payload:', event.body)
})

// 3. Handle connection events (optional)
client.on('open', () => console.log('Connected to smee.io'))
client.on('error', (err) => console.error('Connection error:', err))

// 4. Start receiving
client.start()

// Later: stop when done
// client.stop()
```

### Creating a Channel

You can get a channel URL from [smee.io](https://smee.io) website, or create one programmatically:

```ts
// Create a new channel on smee.io
const url = await SmeeClient.createChannel()
console.log('Your channel:', url)
// => https://smee.io/aBcDeFgHiJkLmNoP

// Or use a self-hosted smee server
const url = await SmeeClient.createChannel('https://smee.yourcompany.com')
```

### API Reference

#### Constructor

```ts
new SmeeClient(url: string)
```

Creates a client for the specified smee channel URL.

#### Static Methods

```ts
SmeeClient.createChannel(baseUrl?: string): Promise<string>
```

Creates a new channel and returns its URL. Defaults to `https://smee.io`.

#### Instance Methods

| Method | Description |
|--------|-------------|
| `start()` | Connect and begin receiving events |
| `stop()` | Disconnect and stop receiving events |
| `on(event, handler)` | Register an event listener |
| `off(event, handler)` | Remove an event listener |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `connected` | `boolean` | Whether the client is currently connected |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `SmeeMessage` | A webhook was received |
| `open` | — | Connection established |
| `close` | — | Connection closed |
| `error` | `Error` | An error occurred |
| `ping` | — | Heartbeat from server |

#### SmeeMessage

```ts
interface SmeeMessage {
  body: any                       // Webhook payload (parsed JSON)
  headers: Record<string, string> // HTTP headers from the webhook request
  query: Record<string, string>   // URL query parameters
  timestamp: number               // When smee.io received it (Unix ms)
  rawBody: string                 // Raw body string for signature verification
}
```

### Examples

#### GitHub Star Notifications

A complete walkthrough for receiving GitHub webhook events locally.

**Step 1: Get a smee channel URL**

Visit [smee.io](https://smee.io) and click "Start a new channel", or:

```ts
const url = await SmeeClient.createChannel()
console.log(url) // https://smee.io/xxxxxxxx
```

**Step 2: Configure GitHub Webhook**

1. Go to your repository → **Settings** → **Webhooks** → **Add webhook**
2. Set **Payload URL** to your smee channel URL
3. Set **Content type** to `application/json`
4. (Optional) Set a **Secret** for signature verification
5. Select events: choose "Let me select individual events" → check **Stars**
6. Click **Add webhook**

**Step 3: Handle events in your code**

```ts
import { SmeeClient } from 'smee-it'

const client = new SmeeClient('https://smee.io/your-channel')

client.on('message', (event) => {
  // Check the event type via headers
  if (event.headers['x-github-event'] === 'star') {
    const { action, sender, repository } = event.body

    if (action === 'created') {
      console.log(`⭐ ${sender.login} starred ${repository.full_name}!`)
      console.log(`   Total stars: ${repository.stargazers_count}`)
    } else if (action === 'deleted') {
      console.log(`💔 ${sender.login} unstarred ${repository.full_name}`)
    }
  }
})

client.on('open', () => console.log('Listening for star events...'))
client.start()
```

#### Handling Multiple Event Types

```ts
client.on('message', (event) => {
  const eventType = event.headers['x-github-event']

  switch (eventType) {
    case 'push':
      const { commits, pusher } = event.body
      console.log(`📦 ${pusher.name} pushed ${commits.length} commit(s)`)
      break

    case 'issues':
      const { action, issue } = event.body
      console.log(`📋 Issue #${issue.number} was ${action}`)
      break

    case 'pull_request':
      const { action: prAction, pull_request } = event.body
      console.log(`🔀 PR #${pull_request.number} was ${prAction}`)
      break
  }
})
```

#### Webhook Signature Verification

For production-grade security, always verify webhook signatures:

```ts
import { SmeeClient } from 'smee-it'
import { Webhooks } from '@octokit/webhooks'

const webhooks = new Webhooks({ secret: process.env.WEBHOOK_SECRET! })
const client = new SmeeClient('https://smee.io/your-channel')

client.on('message', async (event) => {
  // Verify the signature using the raw body
  const signature = event.headers['x-hub-signature-256']
  const isValid = await webhooks.verify(event.rawBody, signature)

  if (!isValid) {
    console.warn('Invalid signature, ignoring event')
    return
  }

  // Safe to process
  console.log('Verified event:', event.headers['x-github-event'])
})

client.start()
```

### Security Notes

> **Important:** smee.io is a public service. Anyone who knows your channel URL can see webhook data passing through it.

**Recommended for:**
- Local development and debugging
- CI/CD integration testing
- Open source projects

**Not recommended for:**
- Production environments
- Sensitive or confidential data

For sensitive projects, consider [self-hosting smee](https://github.com/probot/smee.io) on your own infrastructure.

---

## 中文

### 问题

开发 Webhook 应用（GitHub App、Slack Bot、支付回调等）时，会遇到一个常见问题：**Webhook 需要公网 URL，但开发机器在 NAT/防火墙后面，无法被外部访问**。

传统方案如 ngrok 需要额外配置，还常有速率限制。官方 [smee-client](https://github.com/probot/smee-client) 能解决这个问题，但强制使用 "target URL" 模式，需要运行本地 HTTP 服务器。

### 解决方案

**smee-it** 提供更简单的事件驱动方式：

- **无需本地 HTTP 服务器** — 直接在代码中订阅 webhook 事件
- **完整 TypeScript 支持** — 良好的 IDE 体验，自动补全
- **支持自建 smee** — 不局限于 smee.io
- **轻量** — 依赖少，ESM 优先

### 安装

```bash
npm install smee-it
```

### 快速开始

```ts
import { SmeeClient } from 'smee-it'

// 1. 用 smee 频道 URL 创建客户端
const client = new SmeeClient('https://smee.io/your-channel')

// 2. 监听 webhook 事件
client.on('message', (event) => {
  console.log('收到 webhook!')
  console.log('事件类型:', event.headers['x-github-event'])
  console.log('载荷:', event.body)
})

// 3. 处理连接事件（可选）
client.on('open', () => console.log('已连接到 smee.io'))
client.on('error', (err) => console.error('连接错误:', err))

// 4. 开始接收
client.start()

// 之后：完成时停止
// client.stop()
```

### 创建频道

可以从 [smee.io](https://smee.io) 网站获取频道 URL，或通过代码创建：

```ts
// 在 smee.io 上创建新频道
const url = await SmeeClient.createChannel()
console.log('你的频道:', url)
// => https://smee.io/aBcDeFgHiJkLmNoP

// 或使用自建的 smee 服务器
const url = await SmeeClient.createChannel('https://smee.yourcompany.com')
```

### API 参考

#### 构造函数

```ts
new SmeeClient(url: string)
```

为指定的 smee 频道 URL 创建客户端。

#### 静态方法

```ts
SmeeClient.createChannel(baseUrl?: string): Promise<string>
```

创建新频道并返回其 URL。默认使用 `https://smee.io`。

#### 实例方法

| 方法 | 说明 |
|------|------|
| `start()` | 连接并开始接收事件 |
| `stop()` | 断开连接，停止接收 |
| `on(event, handler)` | 注册事件监听器 |
| `off(event, handler)` | 移除事件监听器 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `connected` | `boolean` | 当前是否已连接 |

#### 事件

| 事件 | 载荷 | 说明 |
|------|------|------|
| `message` | `SmeeMessage` | 收到 webhook |
| `open` | — | 连接已建立 |
| `close` | — | 连接已关闭 |
| `error` | `Error` | 发生错误 |
| `ping` | — | 服务端心跳 |

#### SmeeMessage

```ts
interface SmeeMessage {
  body: any                       // Webhook 载荷（已解析的 JSON）
  headers: Record<string, string> // Webhook 请求的 HTTP 头
  query: Record<string, string>   // URL 查询参数
  timestamp: number               // smee.io 收到的时间（Unix 毫秒）
  rawBody: string                 // 原始 body 字符串（用于签名验证）
}
```

### 示例

#### GitHub Star 通知

完整演示如何在本地接收 GitHub webhook 事件。

**第一步：获取 smee 频道 URL**

访问 [smee.io](https://smee.io) 点击 "Start a new channel"，或：

```ts
const url = await SmeeClient.createChannel()
console.log(url) // https://smee.io/xxxxxxxx
```

**第二步：配置 GitHub Webhook**

1. 进入仓库 → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL** 填写 smee 频道 URL
3. **Content type** 选择 `application/json`
4. （可选）设置 **Secret** 用于签名验证
5. 选择事件：点击 "Let me select individual events" → 勾选 **Stars**
6. 点击 **Add webhook**

**第三步：在代码中处理事件**

```ts
import { SmeeClient } from 'smee-it'

const client = new SmeeClient('https://smee.io/your-channel')

client.on('message', (event) => {
  // 通过 headers 判断事件类型
  if (event.headers['x-github-event'] === 'star') {
    const { action, sender, repository } = event.body

    if (action === 'created') {
      console.log(`⭐ ${sender.login} 给 ${repository.full_name} 点了 star！`)
      console.log(`   当前 star 数: ${repository.stargazers_count}`)
    } else if (action === 'deleted') {
      console.log(`💔 ${sender.login} 取消了 ${repository.full_name} 的 star`)
    }
  }
})

client.on('open', () => console.log('正在监听 star 事件...'))
client.start()
```

#### 处理多种事件类型

```ts
client.on('message', (event) => {
  const eventType = event.headers['x-github-event']

  switch (eventType) {
    case 'push':
      const { commits, pusher } = event.body
      console.log(`📦 ${pusher.name} 推送了 ${commits.length} 个提交`)
      break

    case 'issues':
      const { action, issue } = event.body
      console.log(`📋 Issue #${issue.number} 被 ${action}`)
      break

    case 'pull_request':
      const { action: prAction, pull_request } = event.body
      console.log(`🔀 PR #${pull_request.number} 被 ${prAction}`)
      break
  }
})
```

#### Webhook 签名验证

生产级安全要求下，务必验证 webhook 签名：

```ts
import { SmeeClient } from 'smee-it'
import { Webhooks } from '@octokit/webhooks'

const webhooks = new Webhooks({ secret: process.env.WEBHOOK_SECRET! })
const client = new SmeeClient('https://smee.io/your-channel')

client.on('message', async (event) => {
  // 使用 rawBody 验证签名
  const signature = event.headers['x-hub-signature-256']
  const isValid = await webhooks.verify(event.rawBody, signature)

  if (!isValid) {
    console.warn('签名无效，忽略此事件')
    return
  }

  // 可以安全处理了
  console.log('已验证事件:', event.headers['x-github-event'])
})

client.start()
```

### 安全提示

> **注意：** smee.io 是公开服务，任何知道你频道 URL 的人都可以看到经过的 webhook 数据。

**推荐用于：**
- 本地开发调试
- CI/CD 集成测试
- 开源项目

**不推荐用于：**
- 生产环境
- 敏感或机密数据

对于敏感项目，建议在自己的服务器上[自建 smee](https://github.com/probot/smee.io)。

---

## License

MIT © [Viki](https://github.com/vikiboss)
