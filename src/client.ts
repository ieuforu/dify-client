import type { DifyClientOptions, ChatflowOptions, WorkflowResult } from "./types";
import { readSSEStream } from "./stream";
import { toast } from "sonner";

// ── 底层 HTTP ──

async function request(
  apiBase: string,
  apiKey: string,
  path: string,
  body: Record<string, any>,
): Promise<any> {
  const url = apiBase.endsWith("/v1") ? `${apiBase}${path}` : `${apiBase}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 504) throw new Error("请求服务器超时，请稍后重试");
  if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);

  return res.json();
}

// ── Dify Workflow (blocking) ──

export async function difyWorkflow<T = any>(
  options: DifyClientOptions & { apiKey: string; inputs: Record<string, any>; user?: string },
): Promise<T> {
  const { apiBase, apiKey, inputs, user = "anonymous" } = options;
  const result = await request(apiBase, apiKey, "/workflows/run", {
    inputs,
    user,
    response_mode: "blocking",
  });

  if (result.data?.status === "succeeded") {
    return result.data.outputs as T;
  }

  throw new Error(result.data?.error || "工作流执行失败");
}

// ── Dify Chatflow (SSE streaming) ──

export async function difyChatflow(
  apiKey: string,
  body: { inputs: Record<string, any>; query: string; user: string },
  options: ChatflowOptions & { apiBase: string },
): Promise<void> {
  const { apiBase, signal: externalSignal, ...callbacks } = options;
  const internalController = externalSignal ? null : new AbortController();
  const signal = externalSignal || internalController!.signal;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    // chat-messages 端点：代理模式用 /api/chat-messages，直接模式用完整URL
    const chatUrl = apiBase.endsWith("/v1")
      ? `${apiBase}/chat-messages`
      : `${apiBase}/chat-messages`;

    const response = await fetch(chatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, response_mode: "streaming" }),
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
        toast.error(msg);
        callbacks.onError?.(msg);
      } else if (data.event === "workflow_finished") {
        const errorMsg = data.data?.error || "";

        if (errorMsg.includes("免费额度已结束")) {
          toast.error("AI 免费额度已耗尽，请更换模型后重试！");
          return;
        }

        if (data.data?.status === "failed") {
          const isPluginError =
            errorMsg.includes("not found") || errorMsg.includes("iterator variable");
          const displayMsg = isPluginError
            ? "Dify 内部插件错误，请重新生成，本次不消耗 Token"
            : "解析任务遇到一点问题，请重试";
          toast.error(displayMsg);
          callbacks.onError?.(displayMsg);
          return;
        }

        // credits 提取
        const finalAnswer = data.data?.outputs?.answer || "";
        const creditsMatch = finalAnswer.match(/credits[：:]\s*(\d+)/);
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
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("SSE Stream safely aborted by the controller.");
    } else {
      const msg = err.message || "连接失败";
      toast.error(msg);
      callbacks.onError?.(msg);
    }
  } finally {
    if (reader) {
      reader.cancel().catch((e) => console.warn("reader cancel failed:", e));
    }
    if (internalController && !internalController.signal.aborted) {
      internalController.abort();
    }
  }
}

// ── 文件上传 ──

export async function uploadFile(
  apiBase: string,
  apiKey: string,
  file: File,
  userId: string,
): Promise<{ id: string }> {
  const uploadUrl = apiBase.endsWith("/v1")
    ? `${apiBase.replace("/v1", "")}/files/upload`
    : `${apiBase}/files/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("user", userId);

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) throw new Error("文件上传失败");
  return res.json();
}
