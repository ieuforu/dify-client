// ═══════════════════════════════════════════════════════════════════════════
//  共享工具函数
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig } from "./types";
import { request } from "./http";

// ── DifyError ──

/**
 * SDK 统一错误类型
 * - message: 中文可读错误（可直接 toast）
 * - code: Dify 业务错误码（需要特殊处理时用，比如 203→充值弹窗）
 */
export class DifyError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "DifyError";
    this.code = code;
  }
}

// ── 共享 runWorkflow ──

export async function runWorkflow<T = unknown>(
  baseUrl: string,
  token: string,
  inputs: Record<string, unknown>,
  user: string,
): Promise<T> {
  const result = await request(baseUrl, token, "/workflows/run", {
    inputs,
    user,
    response_mode: "blocking",
  });
  if (result.data?.status === "succeeded") return result.data.outputs as T;
  throw new Error(result.data?.error || "工作流执行失败");
}
