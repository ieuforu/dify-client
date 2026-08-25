// ═══════════════════════════════════════════════════════════════════════════
//  底层 Workflow 和 Chatflow
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig, ProgressEvent } from "../types";
import { request } from "../http";
import { readSSEStream } from "../stream";

export interface WorkflowModule {
  /**
   * 执行 Dify Workflow（阻塞模式）
   * 底层：POST /workflows/run → response_mode: "blocking"
   * 成功返回 outputs（原始 Dify 输出），失败 throw Error
   *
   * 注意：这是底层 API，上层推荐用 auth.* / billing.* 等封装方法
   * 只有 Dify Workflow 没有对应封装时才直接调用此方法
   */
  run<T = unknown>(options: {
    token?: string;
    inputs: Record<string, unknown>;
    user?: string;
  }): Promise<T>;
}

export interface ChatflowModule {
  /**
   * 执行 Dify Chatflow（SSE 流式）
   * 底层：POST /chat-messages → response_mode: "streaming"
   *
   * 回调说明：
   * - onText: 收到文本片段（每次 SSE message 事件触发）
   * - onConversationId: 首次返回 conversation_id（用于多轮对话）
   * - onFinal: 流结束
   * - onError: 流出错（已转为中文错误消息）
   * - onProgress: 工作流进度事件（node_started / iteration_next / iteration_completed）
   * - onCredits: 从最终输出中提取的 credits 消耗量
   *
   * 注意：这是底层 API，上层推荐用 auth.* / billing.* 等封装方法
   * 只有 Dify Chatflow 没有对应封装时才直接调用此方法
   */
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
}

export function createWorkflowModule(config: DifyClientConfig): WorkflowModule {
  const { baseUrl } = config;

  return {
    async run({ token, inputs, user = "anonymous" }) {
      if (!token) throw new Error("未提供 token");

      const result = await request(baseUrl!, token, "/workflows/run", {
        inputs,
        user,
        response_mode: "blocking",
      });

      if (result.data?.status === "succeeded") {
        return result.data.outputs;
      }

      throw new Error(result.data?.error || "工作流执行失败");
    },
  };
}

export function createChatflowModule(config: DifyClientConfig): ChatflowModule {
  const { baseUrl } = config;

  return {
    async stream(body, options) {
      const { token, ...rest } = body;
      if (!token) throw new Error("未提供 token");

      const { signal: externalSignal, ...callbacks } = options;
      const internalController = externalSignal ? null : new AbortController();
      const signal = externalSignal || internalController!.signal;
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      try {
        const chatUrl = `${baseUrl}/chat-messages`;

        const response = await fetch(chatUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...rest, response_mode: "streaming" }),
          signal,
        });

        if (response.status === 504) throw new Error("请求服务器超时，请稍后重试");
        if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);

        reader = response.body?.getReader() ?? null;
        if (!reader) throw new Error("无法读取响应流");

        for await (const data of readSSEStream(reader, signal)) {
          if (data.conversation_id) {
            callbacks.onConversationId?.(data.conversation_id);
          }

          if (data.event === "message") {
            callbacks.onText(data.answer || "");
          } else if (data.event === "error") {
            const msg = data.message || "生成失败";
            callbacks.onError?.(msg);
          } else if (data.event === "workflow_finished") {
            const errorMsg = data.data?.error || "";

            if (errorMsg.includes("免费额度已结束")) {
              callbacks.onError?.("AI 免费额度已耗尽，请更换模型后重试！");
              return;
            }

            if (data.data?.status === "failed") {
              const isPluginError =
                errorMsg.includes("not found") || errorMsg.includes("iterator variable");
              const displayMsg = isPluginError
                ? "Dify 内部插件错误，请重新生成，本次不消耗 Token"
                : "解析任务遇到一点问题，请重试";
              callbacks.onError?.(displayMsg);
              return;
            }

            // credits 提取
            const finalAnswer = data.data?.outputs?.answer || "";
            const creditsMatch = String(finalAnswer).match(/credits[：:]\s*(\d+)/);
            if (creditsMatch) {
              callbacks.onCredits?.(Number(creditsMatch[1]));
            }

            callbacks.onFinal?.();
          } else if (data.event === "node_started") {
            callbacks.onProgress?.({ type: "node_started", title: data.data?.title });
          } else if (data.event === "iteration_next") {
            callbacks.onProgress?.({ type: "iteration_next" });
          } else if (data.event === "iteration_completed") {
            callbacks.onProgress?.({ type: "iteration_completed" });
          }
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (error.name === "AbortError") {
          console.log("SSE Stream safely aborted by the controller.");
        } else {
          callbacks.onError?.(error.message || "连接失败");
        }
      } finally {
        if (reader) {
          reader.cancel().catch((e) => console.warn("reader cancel failed:", e));
        }
        if (internalController && !internalController.signal.aborted) {
          internalController.abort();
        }
      }
    },
  };
}
