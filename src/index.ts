// ═══════════════════════════════════════════════════════════════════════════
//  @skxc/dify-client 入口
// ═══════════════════════════════════════════════════════════════════════════

// ── 工厂函数 ──
export { createDifyClient } from "./client";

// ── 类型定义 ──
export type {
  DifyClient,
  DifyClientConfig,
  DifyTokens,
  DifyContact,
  LoginMethod,
  AuthResult,
  UserProfile,
  CheckPointsResult,
  ProgressEvent,
  UserData,
  UserState,
} from "./types";

// ── 工具函数 ──
export { difyUserInput } from "./types";
export { DifyError } from "./utils";

// ── 错误消息 ──
export {
  COMMON_MESSAGES,
  LOGIN_MESSAGES,
  SIGNUP_MESSAGES,
  INVITATION_MESSAGES,
  CHECK_POINTS_MESSAGES,
  AUTH_ERROR_MESSAGES,
  mergeMessages,
  getErrorMessage,
} from "./messages";

// ── SSE 流解析 ──
export { readSSEStream } from "./stream";

// ── 模块（高级用法，一般不需要直接使用） ──
export { createAuthModule } from "./modules/auth";
export { createBillingModule } from "./modules/billing";
export { createFileModule } from "./modules/file";
export { createWorkflowModule, createChatflowModule } from "./modules/core";
export { createUserState } from "./modules/user";
