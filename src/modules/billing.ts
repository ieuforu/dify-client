// ═══════════════════════════════════════════════════════════════════════════
//  计费模块
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig, DifyContact } from "../types";
import { difyUserInput } from "../types";
import { readSSEStream } from "../stream";
import {
  COMMON_MESSAGES,
  CHECK_POINTS_MESSAGES,
  mergeMessages,
  getErrorMessage,
} from "../messages";
import { DifyError, runWorkflow } from "../utils";

export interface BillingModule {
  /**
   * 检查余额是否足够
   * 底层：Dify Workflow [checkPoints] → inputs: { user_email/user_phone, single_limit }
   * 不足时 throw DifyError (code=203)，上层可 e.code === 203 弹充值窗
   */
  checkPoints(contact: DifyContact, limit: number): Promise<void>;
  /**
   * 扣除积分
   * 底层：Dify Workflow [deductPoints] → inputs: { user_email/user_phone, limit_verification, dify_app_id, remark }
   */
  handleDeductPoints(
    contact: DifyContact,
    credits: number,
    options?: { difyAppId?: string; remark?: string },
  ): Promise<void>;
  /**
   * 充值（支付宝）
   * 底层：Dify Chatflow [recharge] → SSE 流式，从 message 中正则提取支付宝链接
   * 返回：支付宝支付链接
   */
  recharge(
    contact: DifyContact,
    amount: number,
    options?: { signal?: AbortSignal },
  ): Promise<string>;
}

export function createBillingModule(config: DifyClientConfig): BillingModule {
  const { baseUrl, tokens, errorMessages: customMessages = {} } = config;
  const allMessages = mergeMessages(COMMON_MESSAGES, CHECK_POINTS_MESSAGES, customMessages);

  /** 执行 workflow 并检查 code，失败抛 DifyError */
  async function runAndCheck(inputs: Record<string, unknown>, user: string): Promise<void> {
    if (!tokens.deductPoints) throw new Error("未配置 deductPoints token");
    const outputs = await runWorkflow<{ code?: number }>(
      baseUrl!,
      tokens.deductPoints,
      inputs,
      user,
    );
    if (outputs.code != null && outputs.code !== 200) {
      throw new DifyError(outputs.code, getErrorMessage(outputs.code, allMessages));
    }
  }

  return {
    /**
     * 检查余额是否足够，不足时 throw DifyError
     * code=203 表示余额不足（上层可 e.code === 203 弹充值窗）
     */
    async checkPoints(contact, limit) {
      if (!tokens.checkPoints) throw new Error("未配置 checkPoints token");
      const outputs = await runWorkflow<{ code?: number }>(
        baseUrl!,
        tokens.checkPoints,
        { ...difyUserInput(contact), single_limit: limit },
        contact.value,
      );
      if (outputs.code != null && outputs.code !== 200) {
        throw new DifyError(outputs.code, getErrorMessage(outputs.code, allMessages));
      }
    },

    /** 扣除积分，失败 throw DifyError */
    async handleDeductPoints(contact, credits, options = {}) {
      await runAndCheck(
        {
          ...difyUserInput(contact),
          limit_verification: String(credits),
          dify_app_id: options.difyAppId || "",
          remark: options.remark || "",
        },
        contact.value,
      );
    },

    /**
     * 充值（支付宝），返回支付宝支付链接
     * 失败 throw Error
     */
    async recharge(contact, amount, options = {}) {
      if (!tokens.recharge) throw new Error("未配置 recharge token");

      const { signal: externalSignal } = options;
      const internalController = externalSignal ? null : new AbortController();
      const signal = externalSignal || internalController!.signal;

      return new Promise<string>((resolve, reject) => {
        let settled = false;

        fetch(`${baseUrl}/chat-messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.recharge}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: { ...difyUserInput(contact), recharge_amount: amount },
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
                  const urlMatch = (data.answer || "").match(
                    /https:\/\/openapi\.alipay\.com[^\s)]+/,
                  );
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
            if (err.name === "AbortError") return;
            if (!settled) {
              settled = true;
              reject(new Error(err.message || "充值失败"));
            }
          });
      });
    },
  };
}
