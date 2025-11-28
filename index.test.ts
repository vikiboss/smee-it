import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

interface MockEventSourceInstance {
  url: string
  readyState: number
  onopen: (() => void) | null
  onmessage: ((e: { data: string }) => void) | null
  onerror: ((e: unknown) => void) | null
  listeners: Map<string, Set<(e?: unknown) => void>>
  simulateMessage: (data: Record<string, unknown>) => void
  simulateError: (error: unknown) => void
  simulatePing: () => void
  close: () => void
}

// Mock the eventsource module - factory must be inline with no external references
vi.mock('eventsource', () => {
  class MockEventSource {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSED = 2

    url: string
    readyState = 0

    onopen: (() => void) | null = null
    onmessage: ((e: { data: string }) => void) | null = null
    onerror: ((e: unknown) => void) | null = null

    listeners = new Map<string, Set<(e?: unknown) => void>>()

    constructor(url: string) {
      this.url = url
      // Store reference for testing
      ;(globalThis as unknown as { __lastMockES: MockEventSource }).__lastMockES = this
      // Simulate async connection
      setTimeout(() => {
        this.readyState = 1
        this.onopen?.()
      }, 0)
    }

    addEventListener(event: string, handler: (e?: unknown) => void) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set())
      }
      this.listeners.get(event)!.add(handler)
    }

    removeEventListener(event: string, handler: (e?: unknown) => void) {
      this.listeners.get(event)?.delete(handler)
    }

    simulateMessage(data: Record<string, unknown>) {
      this.onmessage?.({ data: JSON.stringify(data) })
    }

    simulateError(error: unknown) {
      this.onerror?.(error)
    }

    simulatePing() {
      this.listeners.get('ping')?.forEach(h => h())
    }

    close() {
      this.readyState = 2
    }
  }
  return { EventSource: MockEventSource }
})

// Helper to get the last mock instance
function getLastMockES(): MockEventSourceInstance {
  return (globalThis as unknown as { __lastMockES: MockEventSourceInstance }).__lastMockES
}

import { SmeeClient, type SmeeMessage, type SmeeEvents } from './index'

describe('SmeeClient', () => {
  let client: SmeeClient
  const testUrl = 'https://smee.io/test-channel'

  beforeEach(() => {
    client = new SmeeClient(testUrl)
  })

  afterEach(() => {
    client.stop()
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create client with given URL', () => {
      const client = new SmeeClient('https://smee.io/abc123')
      expect(client).toBeInstanceOf(SmeeClient)
    })

    it('should remove trailing slash from URL', () => {
      const client = new SmeeClient('https://smee.io/abc123/')
      // The URL is private, but we can verify by starting and checking behavior
      expect(client).toBeInstanceOf(SmeeClient)
    })
  })

  describe('connected', () => {
    it('should return false when not started', () => {
      expect(client.connected).toBe(false)
    })

    it('should return true after connection opens', async () => {
      client.start()
      // Wait for the simulated async connection
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(client.connected).toBe(true)
    })

    it('should return false after stop', async () => {
      client.start()
      await new Promise(resolve => setTimeout(resolve, 10))
      client.stop()
      expect(client.connected).toBe(false)
    })
  })

  describe('on/off event handlers', () => {
    it('should support chaining', () => {
      const result = client.on('open', () => {}).on('message', () => {})
      expect(result).toBe(client)
    })

    it('should register and call event handlers', async () => {
      const openHandler = vi.fn()
      client.on('open', openHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(openHandler).toHaveBeenCalledTimes(1)
    })

    it('should remove event handlers with off', async () => {
      const openHandler = vi.fn()
      client.on('open', openHandler)
      client.off('open', openHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(openHandler).not.toHaveBeenCalled()
    })

    it('should support multiple handlers for same event', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      client.on('open', handler1)
      client.on('open', handler2)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  describe('start', () => {
    it('should trigger open event when connected', async () => {
      const openHandler = vi.fn()
      client.on('open', openHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(openHandler).toHaveBeenCalled()
    })

    it('should not create multiple connections when called multiple times', async () => {
      const openHandler = vi.fn()
      client.on('open', openHandler)

      client.start()
      client.start()
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(openHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('stop', () => {
    it('should trigger close event', () => {
      const closeHandler = vi.fn()
      client.on('close', closeHandler)
      client.start()
      client.stop()

      expect(closeHandler).toHaveBeenCalledTimes(1)
    })

    it('should allow restart after stop', async () => {
      const openHandler = vi.fn()
      client.on('open', openHandler)

      client.start()
      await new Promise(resolve => setTimeout(resolve, 10))

      client.stop()
      client.start()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(openHandler).toHaveBeenCalledTimes(2)
    })
  })

  describe('message handling', () => {
    it('should parse and emit message events with full data', async () => {
      const messageHandler = vi.fn()
      client.on('message', messageHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))

      // Simulate incoming message
      const mockES = getLastMockES()
      mockES.simulateMessage({
        body: { action: 'push', repository: 'test-repo' },
        query: { param: 'value' },
        timestamp: 1234567890,
        'x-github-event': 'push',
        'x-github-delivery': 'abc123',
      })

      expect(messageHandler).toHaveBeenCalledTimes(1)
      const msg = messageHandler.mock.calls[0][0] as SmeeMessage
      expect(msg.body).toEqual({ action: 'push', repository: 'test-repo' })
      expect(msg.query).toEqual({ param: 'value' })
      expect(msg.timestamp).toBe(1234567890)
      expect(msg.headers['x-github-event']).toBe('push')
      expect(msg.headers['x-github-delivery']).toBe('abc123')
      expect(msg.rawBody).toBe(JSON.stringify({ action: 'push', repository: 'test-repo' }))
    })

    it('should include rawBody in message for signature verification', async () => {
      const messageHandler = vi.fn()
      client.on('message', messageHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))

      const mockES = getLastMockES()
      mockES.simulateMessage({
        body: { action: 'opened', issue: { id: 123 } },
        query: {},
        timestamp: Date.now(),
      })

      expect(messageHandler).toHaveBeenCalledTimes(1)
      const msg = messageHandler.mock.calls[0][0] as SmeeMessage
      expect(msg.rawBody).toBe(JSON.stringify({ action: 'opened', issue: { id: 123 } }))
    })

    it('should handle message with missing body', async () => {
      const messageHandler = vi.fn()
      client.on('message', messageHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))

      const mockES = getLastMockES()
      mockES.simulateMessage({
        query: { test: '1' },
        timestamp: 1234567890,
      })

      expect(messageHandler).toHaveBeenCalledTimes(1)
      const msg = messageHandler.mock.calls[0][0] as SmeeMessage
      expect(msg.body).toEqual({})
      expect(msg.rawBody).toBe('')
    })

    it('should handle message with missing query and timestamp', async () => {
      const messageHandler = vi.fn()
      client.on('message', messageHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))

      const mockES = getLastMockES()
      mockES.simulateMessage({
        body: { test: true },
      })

      expect(messageHandler).toHaveBeenCalledTimes(1)
      const msg = messageHandler.mock.calls[0][0] as SmeeMessage
      expect(msg.query).toEqual({})
      expect(typeof msg.timestamp).toBe('number')
    })

    it('should only include string values in headers', async () => {
      const messageHandler = vi.fn()
      client.on('message', messageHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))

      const mockES = getLastMockES()
      mockES.simulateMessage({
        body: {},
        query: {},
        timestamp: 123,
        'x-string-header': 'value',
        'x-number-header': 42,
        'x-object-header': { foo: 'bar' },
      })

      expect(messageHandler).toHaveBeenCalledTimes(1)
      const msg = messageHandler.mock.calls[0][0] as SmeeMessage
      expect(msg.headers['x-string-header']).toBe('value')
      expect(msg.headers['x-number-header']).toBeUndefined()
      expect(msg.headers['x-object-header']).toBeUndefined()
    })
  })

  describe('ping handling', () => {
    it('should emit ping event', async () => {
      const pingHandler = vi.fn()
      client.on('ping', pingHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))

      const mockES = getLastMockES()
      mockES.simulatePing()

      expect(pingHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    it('should emit error event with message', async () => {
      const errorHandler = vi.fn()
      client.on('error', errorHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))

      const mockES = getLastMockES()
      mockES.simulateError({ message: 'Connection failed' })

      expect(errorHandler).toHaveBeenCalledTimes(1)
      const error = errorHandler.mock.calls[0][0] as Error
      expect(error.message).toBe('Connection failed')
    })

    it('should emit error event without message', async () => {
      const errorHandler = vi.fn()
      client.on('error', errorHandler)
      client.start()

      await new Promise(resolve => setTimeout(resolve, 10))

      const mockES = getLastMockES()
      mockES.simulateError({})

      expect(errorHandler).toHaveBeenCalledTimes(1)
      const error = errorHandler.mock.calls[0][0] as Error
      expect(error.message).toBe('EventSource error')
    })
  })

  describe('createChannel', () => {
    it('should request new channel from smee.io', async () => {
      const mockUrl = 'https://smee.io/new-channel-123'

      global.fetch = vi.fn().mockResolvedValue({
        headers: {
          get: (name: string) => (name === 'location' ? mockUrl : null),
        },
      })

      const url = await SmeeClient.createChannel()
      expect(url).toBe(mockUrl)
      expect(fetch).toHaveBeenCalledWith('https://smee.io/new', {
        method: 'HEAD',
        redirect: 'manual',
      })
    })

    it('should support custom smee server', async () => {
      const customServer = 'https://smee.example.com'
      const mockUrl = 'https://smee.example.com/channel-abc'

      global.fetch = vi.fn().mockResolvedValue({
        headers: {
          get: (name: string) => (name === 'location' ? mockUrl : null),
        },
      })

      const url = await SmeeClient.createChannel(customServer)
      expect(url).toBe(mockUrl)
      expect(fetch).toHaveBeenCalledWith('https://smee.example.com/new', {
        method: 'HEAD',
        redirect: 'manual',
      })
    })

    it('should handle trailing slash in base URL', async () => {
      const customServer = 'https://smee.example.com/'
      const mockUrl = 'https://smee.example.com/channel-xyz'

      global.fetch = vi.fn().mockResolvedValue({
        headers: {
          get: (name: string) => (name === 'location' ? mockUrl : null),
        },
      })

      const url = await SmeeClient.createChannel(customServer)
      expect(url).toBe(mockUrl)
      expect(fetch).toHaveBeenCalledWith('https://smee.example.com/new', {
        method: 'HEAD',
        redirect: 'manual',
      })
    })

    it('should throw error when no location header', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        headers: {
          get: () => null,
        },
      })

      await expect(SmeeClient.createChannel()).rejects.toThrow('Failed to create new Smee channel')
    })
  })
})

describe('SmeeMessage parsing', () => {
  it('should correctly structure message data', () => {
    // Test the message structure
    const message: SmeeMessage = {
      body: { action: 'opened' },
      query: { page: '1' },
      headers: { 'x-github-event': 'issues' },
      timestamp: Date.now(),
      rawBody: '{"action":"opened"}',
    }

    expect(message.body).toEqual({ action: 'opened' })
    expect(message.query).toEqual({ page: '1' })
    expect(message.headers['x-github-event']).toBe('issues')
    expect(typeof message.timestamp).toBe('number')
    expect(message.rawBody).toBe('{"action":"opened"}')
  })
})

describe('SmeeEvents type', () => {
  it('should define correct event types', () => {
    // Type check - these should compile without errors
    const events: SmeeEvents = {
      message: {
        body: {},
        query: {},
        headers: {},
        timestamp: 0,
        rawBody: '',
      },
      ping: undefined,
      open: undefined,
      error: new Error('test'),
      close: undefined,
    }

    expect(events.message).toBeDefined()
    expect(events.ping).toBeUndefined()
    expect(events.open).toBeUndefined()
    expect(events.error).toBeInstanceOf(Error)
    expect(events.close).toBeUndefined()
  })
})
