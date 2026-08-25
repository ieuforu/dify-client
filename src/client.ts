// ═══════════════════════════════════════════════════════════════════════════
//  DifyClient 工厂函数
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig, DifyClient } from "./types";
import { createAuthModule } from "./modules/auth";
import { createBillingModule } from "./modules/billing";
import { createFileModule } from "./modules/file";
import { createWorkflowModule, createChatflowModule } from "./modules/core";
import { createUserState } from "./modules/user";

const DEFAULT_BASE_URL = "/api";

/**
 * 创建 DifyClient 实例
 *
 * @example
 * ```typescript
 * import { createDifyClient } from '@skxc/dify-client'
 *
 * const dify = createDifyClient({
 *   tokens: { login: 'app-xxx', signup: 'app-yyy' }
 * })
 *
 * // 用户登录（自动持久化状态）
 * await dify.auth.authenticate('login', { account: 'user@example.com', password: '••••' })
 *
 * // 获取当前用户
 * const user = dify.user.getUser()
 * const contact = dify.user.getContact()
 *
 * // 查询余额
 * const { code } = await dify.billing.checkPoints(contact!, 1000)
 *
 * // 充值
 * const payUrl = await dify.billing.recharge(contact!, 10)
 * ```
 */
export function createDifyClient(config: DifyClientConfig): DifyClient {
  const fullConfig: DifyClientConfig = {
    baseUrl: DEFAULT_BASE_URL,
    ...config,
  };

  // 移除末尾的斜杠
  if (fullConfig.baseUrl) {
    fullConfig.baseUrl = fullConfig.baseUrl.replace(/\/+$/, "");
  }

  // 用户状态（单例，所有实例共享 localStorage）
  const user = createUserState(fullConfig);

  return {
    user,
    auth: createAuthModule(fullConfig, user),
    billing: createBillingModule(fullConfig),
    file: createFileModule(fullConfig),
    workflow: createWorkflowModule(fullConfig),
    chatflow: createChatflowModule(fullConfig),
  };
}
