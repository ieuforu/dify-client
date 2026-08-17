// ═══════════════════════════════════════════════════════════════════════════
//  DifyClient 工厂函数
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig, DifyClient } from './types'
import { createAuthModule } from './modules/auth'
import { createBillingModule } from './modules/billing'
import { createFileModule } from './modules/file'
import { createWorkflowModule, createChatflowModule } from './modules/core'

const DEFAULT_BASE_URL = 'https://ai.vskxc.com/v1'

/**
 * 创建 DifyClient 实例
 *
 * @example
 * ```typescript
 * import { createDifyClient } from '@skxc/dify-client'
 *
 * const dify = createDifyClient({
 *   tokens: {
 *     login: 'app-xxx',
 *     signup: 'app-yyy',
 *     // ...
 *   }
 * })
 *
 * // 使用
 * await dify.auth.login(inputs, user)
 * await dify.billing.checkPoints(contact, limit)
 * ```
 */
export function createDifyClient(config: DifyClientConfig): DifyClient {
  const fullConfig: DifyClientConfig = {
    baseUrl: DEFAULT_BASE_URL,
    ...config,
  }

  return {
    auth: createAuthModule(fullConfig),
    billing: createBillingModule(fullConfig),
    file: createFileModule(fullConfig),
    workflow: createWorkflowModule(fullConfig),
    chatflow: createChatflowModule(fullConfig),
  }
}
