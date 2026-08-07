import type { DifyContact } from "./types";
import { difyWorkflow } from "./client";
import { COMMON_MESSAGES, CHECK_POINTS_MESSAGES, mergeMessages, getErrorMessage } from "./messages";

// ── 积分检查 ──

export interface CheckPointsResult {
  code: number;
  message?: string;
}

export async function checkPoints(
  apiBase: string,
  apiKey: string,
  contact: DifyContact,
  limit: number,
): Promise<CheckPointsResult> {
  const outputs = await difyWorkflow<CheckPointsResult>({
    apiBase,
    apiKey,
    inputs: { ...contact, single_limit: limit },
    user: contact.value,
  });

  const allMessages = mergeMessages(COMMON_MESSAGES, CHECK_POINTS_MESSAGES);

  return {
    code: outputs.code,
    message: getErrorMessage(outputs.code, allMessages),
  };
}

// ── 积分扣除 ──

export async function handleDeductPoints(
  apiBase: string,
  apiKey: string,
  contact: DifyContact,
  credits: number,
  difyAppId: string,
  remark: string,
): Promise<{ code: number }> {
  return difyWorkflow({
    apiBase,
    apiKey,
    inputs: {
      ...contact,
      limit_verification: String(credits),
      dify_app_id: difyAppId,
      remark,
    },
    user: contact.value,
  });
}
