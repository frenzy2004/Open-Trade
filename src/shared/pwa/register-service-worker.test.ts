import { describe, expect, it } from 'vitest'
import { registerOpenTradeServiceWorker } from './register-service-worker'

describe('registerOpenTradeServiceWorker', () => {
  it('is a silent no-op in the development test environment', async () => {
    await expect(registerOpenTradeServiceWorker()).resolves.toBeNull()
  })
})
