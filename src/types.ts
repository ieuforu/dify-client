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
  /** API 基础地址，默认 'https://ai.vskxc.com/v1' */
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
  checkInvitationCode?: string;

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
  [key: string]: any;
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

// ═══════════════════════════════════════════════════════════════════════════
//  DifyClient 接口
// ═══════════════════════════════════════════════════════════════════════════

export interface DifyClient {
  // 认证模块
  auth: {
    login(inputs: Record<string, any>, user: string): Promise<AuthResult>;
    signup(inputs: Record<string, any>, user: string): Promise<AuthResult>;
    sendEmailVercode(email: string): Promise<any>;
    sendPhoneVercode(phone: string): Promise<any>;
    checkVerifyCode(contact: string, code: string): Promise<any>;
    resetPassword(contact: DifyContact, newPassword: string): Promise<any>;
    checkUser(contact: DifyContact): Promise<any>;
    fetchUserProfile(contact: DifyContact): Promise<any>;
    checkInvitationCode(code: string, contact: DifyContact): Promise<any>;
  };

  // 计费模块
  billing: {
    checkPoints(contact: DifyContact, limit: number): Promise<CheckPointsResult>;
    handleDeductPoints(
      contact: DifyContact,
      credits: number,
      options?: { difyAppId?: string; remark?: string },
    ): Promise<any>;
    recharge(
      contact: DifyContact,
      amount: number,
      options?: {
        signal?: AbortSignal;
      },
    ): Promise<string>;
  };

  // 文件模块
  file: {
    upload(file: File, userId: string): Promise<{ id: string }>;
  };

  // 底层能力
  workflow: {
    run<T = any>(options: {
      token?: string;
      inputs: Record<string, any>;
      user?: string;
    }): Promise<T>;
  };

  chatflow: {
    stream(
      body: {
        token?: string;
        inputs: Record<string, any>;
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
