// ═══════════════════════════════════════════════════════════════════════════
//  计费模块
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig, DifyContact, CheckPointsResult } from "../types";
import { request } from "../http";
import { difyUserInput } from "../types";
import { readSSEStream } from "../stream";
import {
  COMMON_MESSAGES,
  CHECK_POINTS_MESSAGES,
  mergeMessages,
  getErrorMessage,
} from "../messages";
import { toast } from "sonner";

export interface BillingModule {
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
}

export function createBillingModule(config: DifyClientConfig): BillingModule {
  const { baseUrl, tokens, errorMessages: customMessages = {} } = config;

  // 合并错误消息
  const allMessages = mergeMessages(COMMON_MESSAGES, CHECK_POINTS_MESSAGES, customMessages);

  /** 执行 Workflow */
  async function runWorkflow<T = any>(
    token: string,
    inputs: Record<string, any>,
    user: string,
  ): Promise<T> {
    const result = await request(baseUrl!, token, "/workflows/run", {
      inputs,
      user,
      response_mode: "blocking",
    });

    if (result.data?.status === "succeeded") {
      return result.data.outputs as T;
    }

    throw new Error(result.data?.error || "工作流执行失败");
  }

  return {
    /*
    
      检查余额是否足够抵扣此次所消耗的token
      对应Dify Workflow【App额度核查】
    
    */
    async checkPoints(contact, limit) {
      if (!tokens.checkPoints) throw new Error("未配置 checkPoints token");

      const outputs = await runWorkflow<{ code: number }>(
        tokens.checkPoints,
        { ...difyUserInput(contact), single_limit: limit },
        contact.value,
      );

      return {
        code: outputs.code,
        message: getErrorMessage(outputs.code, allMessages),
      };
    },

    /*
    
      对应Dify Workflow【积分扣除】
    
    */
    async handleDeductPoints(contact, credits, options = {}) {
      if (!tokens.deductPoints) throw new Error("未配置 deductPoints token");

      return runWorkflow(
        tokens.deductPoints,
        {
          ...difyUserInput(contact),
          limit_verification: String(credits),
          dify_app_id: options.difyAppId || "",
          remark: options.remark || "",
        },
        contact.value,
      );
    },

    /*
    
      支付宝充值，目前只支持支付宝的url
      TODO: 待Dify chatflow接入微信支付这里需要改造。
    
    */
    async recharge(contact, amount, options = {}) {
      if (!tokens.recharge) throw new Error("未配置 recharge token");

      const { signal: externalSignal } = options;
      const internalController = externalSignal ? null : new AbortController();
      const signal = externalSignal || internalController!.signal;

      return new Promise<string>((resolve, reject) => {
        let settled = false;

        const chatUrl = `${baseUrl}/chat-messages`;

        fetch(chatUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.recharge}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: {
              ...difyUserInput(contact),
              recharge_amount: amount,
            },
            query: "充值",
            user: contact.value,
            response_mode: "streaming",
          }),
          signal,
        })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const reader = response.body?.getReader();
            if (!reader) throw new Error("无法读取响应流");

            return (async () => {
              for await (const data of readSSEStream(reader, signal)) {
                if (settled) break;

                if (data.event === "message") {
                  const text = data.answer || "";
                  const urlMatch = text.match(/https:\/\/openapi\.alipay\.com[^\s)]+/);
                  if (urlMatch) {
                    settled = true;
                    internalController?.abort();
                    resolve(urlMatch[0]);
                    break;
                  }
                } else if (data.event === "error") {
                  if (!settled) {
                    settled = true;
                    reject(new Error(data.message || "充值失败"));
                  }
                } else if (data.event === "workflow_finished") {
                  if (!settled) {
                    settled = true;
                    reject(new Error("未获取到支付链接"));
                  }
                }
              }
            })();
          })
          .catch((err) => {
            if (err.name === "AbortError") {
              // 正常中止，不处理
            } else if (!settled) {
              settled = true;
              reject(new Error(err.message || "充值失败"));
            }
          });
      });
    },
  };
}
