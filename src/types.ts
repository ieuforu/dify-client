// ── 用户标识 ──

export type LoginMethod = "email" | "phone";

export interface DifyContact {
  key: "user_email" | "user_phone";
  value: string;
}

/** 将 DifyContact 转为 Dify inputs 中的用户标识字段 */
export function difyUserInput(contact: DifyContact): Record<string, string> {
  return { [contact.key]: contact.value };
}

// ── SSE 事件 ──

export interface ProgressEvent {
  type: "node_started" | "iteration_next" | "iteration_completed";
  title?: string;
}

// ── Dify 调用选项 ──

export interface DifyClientOptions {
  /** Dify API 基础地址，如 'https://ai.vskxc.com/v1' 或 '/api' (代理模式) */
  apiBase: string;
}

export interface ChatflowOptions {
  signal?: AbortSignal;
  onText: (text: string) => void;
  onConversationId?: (id: string) => void;
  onFinal?: () => void;
  onError?: (error: string) => void;
  onProgress?: (event: ProgressEvent) => void;
  onCredits?: (credits: number) => void;
}

export interface WorkflowResult<T = any> {
  data: T;
  conversationId?: string;
}
