# smee-it

[![npm version](https://img.shields.io/npm/v/smee-it.svg)](https://www.npmjs.com/package/smee-it)
[![npm downloads](https://img.shields.io/npm/dm/smee-it.svg)](https://www.npmjs.com/package/smee-it)
[![license](https://img.shields.io/npm/l/smee-it.svg)](https://github.com/vikiboss/smee-it/blob/main/LICENSE)
[![test coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/vikiboss/smee-it)

简洁、现代的 [smee.io](https://smee.io) 客户端，基于 Server-Sent Events (SSE) 在本地接收 Webhook 事件。

## 为什么选择 smee-it？

在开发 GitHub App、Bot 或任何基于 Webhook 的集成时，你需要接收来自外部服务的 HTTP 回调。然而：

- **没有公网端点**：本地开发环境无法从互联网访问
- **隧道工具复杂**：ngrok 等方案需要额外配置，且常有速率限制
- **官方客户端局限**：[smee-client](https://github.com/probot/smee-client) 强制使用 `target` URL 模式（为 HTTP 转发设计），存在 TypeScript 类型问题，且使用过时的模式

**smee-it** 提供了更好的解决方案：

- ✅ **事件驱动 API** — 直接订阅 Webhook 事件，无需 HTTP 服务器
- ✅ **类型安全** — TypeScript 编写，严格类型，完整的 IntelliSense 支持
- ✅ **现代 ESM** — 原生 ES 模块，支持 Tree-shaking
- ✅ **100% 测试覆盖** — 使用 Vitest 全面测试
- ✅ **支持私有部署** — 兼容自托管的 smee 服务器
- ✅ **零配置** — 开箱即用，极简设置

## ⚠️ 安全提示

**smee.io 是公开服务**，任何知道你频道 URL 的人都可以：
- 查看所有经过频道的 Webhook 数据
- 向频道发送伪造数据

**推荐用于**：
- 🧪 本地开发调试
- 🧪 CI/CD 集成测试
- 🧪 开源项目的 Webhook 测试

**不推荐用于**：
- ❌ 生产环境
- ❌ 敏感或私密数据传输
- ❌ 关键业务流程

> 对于敏感项目，建议 [自托管 smee 服务器](https://github.com/probot/smee.io) 或使用 Webhook 签名验证。

## 安装

```bash
npm install smee-it
# 或
pnpm add smee-it
# 或
yarn add smee-it
```

## 快速开始

```ts
import { SmeeClient } from 'smee-it'

const client = new SmeeClient('https://smee.io/your-channel-id')

client.on('message', (event) => {
  console.log('收到消息:', event.body)
  console.log('请求头:', event.headers)
  console.log('查询参数:', event.query)
  console.log('时间戳:', event.timestamp)
})

client.on('open', () => console.log('已连接'))
client.on('error', (err) => console.error('错误:', err))
client.on('close', () => console.log('已断开'))

client.start()

// 需要时停止
// client.stop()
```

## 创建新频道

```ts
import { SmeeClient } from 'smee-it'

// 在 smee.io 上创建新频道
const channelUrl = await SmeeClient.createChannel()
console.log('频道地址:', channelUrl)

const client = new SmeeClient(channelUrl)
client.on('message', (e) => console.log(e.body))
client.start()
```

## 私有部署 Smee 服务器

对于敏感项目，你可以 [部署自己的 smee 服务器](https://github.com/probot/smee.io)：

```ts
import { SmeeClient } from 'smee-it'

// 在私有 smee 服务器上创建频道
const channelUrl = await SmeeClient.createChannel('https://smee.your-company.com')

const client = new SmeeClient(channelUrl)
client.on('message', (e) => console.log(e.body))
client.start()
```

## API 参考

### `new SmeeClient(source: string)`

创建新的 Smee 客户端实例。

- `source` — smee 频道 URL（如 `https://smee.io/abc123`）

### `SmeeClient.createChannel(baseUrl?: string): Promise<string>`

静态方法，创建新的 smee 频道。

- `baseUrl` — 可选，smee 服务器 URL，默认为 `https://smee.io`
- 返回新频道的 URL

### `client.start(): void`

启动客户端，开始接收事件。

### `client.stop(): void`

停止客户端，关闭连接。

### `client.connected: boolean`

返回当前是否已连接。

### `client.on(event, handler): this`

注册事件监听器，支持链式调用。

| 事件 | 载荷 | 描述 |
|------|------|------|
| `message` | `SmeeMessage` | 收到 Webhook 消息 |
| `open` | `undefined` | 连接已建立 |
| `error` | `Error` | 发生错误 |
| `close` | `undefined` | 连接已关闭 |
| `ping` | `undefined` | 收到心跳 |

### `client.off(event, handler): this`

移除事件监听器。

### `SmeeMessage`

```ts
interface SmeeMessage {
  body: Record<string, unknown>    // Webhook 请求体
  query: Record<string, string>    // URL 查询参数
  headers: Record<string, string>  // HTTP 请求头
  timestamp: number                // 事件时间戳（毫秒）
  rawBody: string                  // 原始请求体字符串（用于签名验证）
}
```

## 使用场景

### GitHub Webhook 本地开发

1. 访问 [smee.io](https://smee.io) 获取频道 URL
2. 在 GitHub 仓库设置中配置 Webhook 指向该 URL
3. 使用本库在本地接收事件

### 使用 @octokit/webhooks 进行签名验证

虽然 smee.io 是公开的，但你仍可以通过签名验证 Webhook 的真实性：

```ts
import { SmeeClient } from 'smee-it'
import { Webhooks } from '@octokit/webhooks'

const webhooks = new Webhooks({
  secret: process.env.WEBHOOK_SECRET!,
})

const client = new SmeeClient('https://smee.io/your-channel-id')

client.on('message', async (event) => {
  const signature = event.headers['x-hub-signature-256']

  // 验证签名
  if (!(await webhooks.verify(event.rawBody, signature))) {
    console.error('签名验证失败，忽略此消息')
    return
  }

  // 签名验证通过，处理事件
  const eventType = event.headers['x-github-event']
  console.log(`收到 ${eventType} 事件:`, event.body)
})

client.start()
```

> **注意**：签名验证可以防止伪造消息，但无法防止窃听。敏感数据请使用自托管的 smee 服务器。

### CI/CD 集成测试

```ts
import { SmeeClient, type SmeeMessage } from 'smee-it'
import { expect, test } from 'vitest'

test('should receive webhook events', async () => {
  const client = new SmeeClient(process.env.SMEE_URL!)
  const events: SmeeMessage[] = []

  client.on('message', (e) => events.push(e))
  client.start()

  // 触发发送 Webhook 的操作...

  // 验证收到的事件
  expect(events).toHaveLength(1)
  expect(events[0].body).toMatchObject({ action: 'opened' })

  client.stop()
})
```

## 许可证

MIT © [Viki](https://github.com/vikiboss)
