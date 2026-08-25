// ═══════════════════════════════════════════════════════════════════════════
//  用户标识
// ═══════════════════════════════════════════════════════════════════════════

export type LoginMethod = "email" | "phone";

export interface DifyContact {
  key: "user_email" | "user_phone";
  value: string;
}

/**
 * 构造 Dify inputs 中的用户标识字段
 * @example difyUserInput({ key: 'user_phone', value: '13800138000' })
 *          → { user_phone: '13800138000' }
 */
export function difyUserInput(contact: DifyContact): Record<string, string> {
  return { [contact.key]: contact.value };
}

// ═══════════════════════════════════════════════════════════════════════════
//  SSE 事件
// ═══════════════════════════════════════════════════════════════════════════

export interface ProgressEvent {
  type: "node_started" | "iteration_next" | "iteration_completed";
  title?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Client 配置
// ═══════════════════════════════════════════════════════════════════════════

export interface DifyClientConfig {
  /** API 基础地址，默认 '/api'（代理模式） */
  baseUrl?: string;

  /** Token 配置 */
  tokens: DifyTokens;

  /** 自定义错误消息，会与默认消息合并，相同 code 会覆盖 */
  errorMessages?: Record<number, string>;
}

export interface DifyTokens {
  // 认证
  login?: string;
  signup?: string;
  sendEmailCode?: string;
  sendPhoneCode?: string;
  checkCode?: string;
  resetPassword?: string;
  checkUser?: string;
  agentProfile?: string;
  checkInvitationCode?: string;
  giftPoints?: string;

  // 计费
  checkPoints?: string;
  deductPoints?: string;
  recharge?: string;

  // 文件
  upload?: string;

  // 自定义扩展
  [key: string]: string | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
//  API 返回类型
// ═══════════════════════════════════════════════════════════════════════════

export interface AuthResult {
  code: number;
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface UserProfile {
  id: number;
  user_name: string;
  email: string | null;
  phone: string | null;
  points_balance: number;
  total_consumed_points: number;
  total_recharge_points: number;
  type_name: string;
  create_time: string;
  agent_invite_code: string | null;
}

export interface CheckPointsResult {
  code: number;
  message?: string;
}

/**
 * @deprecated checkPoints 现在失败直接 throw DifyError，不再返回此类型
 * 保留仅为向下兼容
 */

export interface UserProfileResult {
  code: number;
  data: Array<{ result: UserProfile[] }>;
}

// ═══════════════════════════════════════════════════════════════════════════
//  用户状态（localStorage 持久化）
// ═══════════════════════════════════════════════════════════════════════════

export interface UserData {
  email: string;
  phone: string;
  loginMethod: LoginMethod;
  role: "user" | "agent";
}

export interface UserState {
  /** 设置用户（登录/注册成功后调用，自动持久化） */
  setUser(data: {
    email?: string;
    phone?: string;
    loginMethod: LoginMethod;
    role?: "user" | "agent";
  }): void;

  /** 获取当前用户，未登录返回 null */
  getUser(): UserData | null;

  /** 获取 DifyContact，未登录返回 null */
  getContact(): DifyContact | null;

  /** 获取 userId（email 或 phone），未登录返回 'anonymous' */
  getUserId(): string;

  /** 获取显示名称（邮箱前缀 / 手机号脱敏） */
  getDisplayName(): string;

  /** 是否已登录 */
  isLogin(): boolean;

  /** 登出（清除状态） */
  logout(): void;

  /** 查询用户个人信息 */
  getProfile(): Promise<UserProfile>;

  /** 查询代理信息 */
  getAgentProfile(agentEmail: string): Promise<UserProfile>;

  /** 监听用户状态变化（用于 React/Vue 响应式） */
  subscribe(listener: () => void): () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DifyClient 接口
// ═══════════════════════════════════════════════════════════════════════════

export interface DifyClient {
  /** 用户状态管理（单例，跨实例共享 localStorage） */
  user: UserState;

  /** 认证模块 */
  auth: {
    /**
     * 登录（推荐使用）
     * - 自动构造 inputs
     * - 自动持久化用户状态
     * - 失败 throw DifyError
     */
    authenticate(params: { account: string; password: string }): Promise<void>;
    /**
     * 注册（不自动持久化）
     * - 失败 throw DifyError
     * - 成功返回 void，上层跳转登录页即可
     */
    signupOnly(params: {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
    }): Promise<void>;
    sendEmailVercode(email: string): Promise<void>;
    sendPhoneVercode(phone: string): Promise<void>;
    checkVerifyCode(contact: string, code: string): Promise<void>;
    resetPassword(contact: DifyContact, newPassword: string): Promise<void>;
    checkUser(contact: DifyContact): Promise<void>;
    checkInvitationCode(code: string, contact: DifyContact): Promise<void>;
    /** 注册赠送积分 */
    giftPoints(contact: DifyContact, user: string): Promise<unknown>;
  };

  /** 计费模块 */
  billing: {
    /** 检查余额是否足够，不足时 throw DifyError (code=203) */
    checkPoints(contact: DifyContact, limit: number): Promise<void>;
    /** 扣除积分 */
    handleDeductPoints(
      contact: DifyContact,
      credits: number,
      options?: { difyAppId?: string; remark?: string },
    ): Promise<void>;
    /** 充值，返回支付宝支付链接 */
    recharge(
      contact: DifyContact,
      amount: number,
      options?: { signal?: AbortSignal },
    ): Promise<string>;
  };

  /** 文件模块 */
  file: {
    upload(file: File, userId: string): Promise<{ id: string }>;
  };

  /** 底层 Workflow */
  workflow: {
    run<T = unknown>(options: {
      token?: string;
      inputs: Record<string, unknown>;
      user?: string;
    }): Promise<T>;
  };

  /** 底层 Chatflow（SSE 流式） */
  chatflow: {
    stream(
      body: {
        token?: string;
        inputs: Record<string, unknown>;
        query: string;
        user: string;
      },
      options: {
        signal?: AbortSignal;
        onText: (text: string) => void;
        onConversationId?: (id: string) => void;
        onFinal?: () => void;
        onError?: (error: string) => void;
        onProgress?: (event: ProgressEvent) => void;
        onCredits?: (credits: number) => void;
      },
    ): Promise<void>;
  };
}
