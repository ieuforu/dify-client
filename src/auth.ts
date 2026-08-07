import type { DifyContact } from "./types";
import { difyWorkflow } from "./client";
import {
  COMMON_MESSAGES,
  LOGIN_MESSAGES,
  SIGNUP_MESSAGES,
  INVITATION_MESSAGES,
  mergeMessages,
  getErrorMessage,
} from "./messages";

// ── 构造 DifyContact ──

export function buildContact(loginMethod: "email" | "phone", value: string): DifyContact {
  return {
    key: loginMethod === "email" ? "user_email" : "user_phone",
    value,
  };
}

// ── 认证 ──

export async function authenticate<T = any>(
  apiBase: string,
  apiKey: string,
  mode: "login" | "signup",
  inputs: Record<string, any>,
  user: string,
): Promise<T> {
  const outputs = await difyWorkflow<T>({ apiBase, apiKey, inputs, user });

  // 200 直接返回
  if ((outputs as any)?.code === 200) {
    return outputs;
  }

  // 根据 mode 选择对应的 context messages，合并通用码
  const contextMessages = mode === "login" ? LOGIN_MESSAGES : SIGNUP_MESSAGES;
  const allMessages = mergeMessages(COMMON_MESSAGES, contextMessages);
  const code = (outputs as any)?.code ?? 0;

  if (code && code !== 200) {
    throw new Error(getErrorMessage(code, allMessages));
  }

  return outputs;
}

export async function sendEmailVercode(
  apiBase: string,
  apiKey: string,
  email: string,
): Promise<{ code: number }> {
  return difyWorkflow({ apiBase, apiKey, inputs: { email }, user: email });
}

export async function sendPhoneVercode(
  apiBase: string,
  apiKey: string,
  phone: string,
): Promise<{ code: number }> {
  return difyWorkflow({ apiBase, apiKey, inputs: { phone }, user: phone });
}

export async function checkVerifyCode(
  apiBase: string,
  apiKey: string,
  contact: DifyContact,
  verCode: string,
): Promise<{ code: number }> {
  return difyWorkflow({
    apiBase,
    apiKey,
    inputs: { ...contact, ver_code: verCode },
    user: contact.value,
  });
}

export async function resetPassword(
  apiBase: string,
  apiKey: string,
  contact: DifyContact,
  newPassword: string,
): Promise<{ code: number }> {
  return difyWorkflow({
    apiBase,
    apiKey,
    inputs: { ...contact, new_password: newPassword },
    user: contact.value,
  });
}

export async function checkUser(
  apiBase: string,
  apiKey: string,
  contact: DifyContact,
): Promise<{ code: number; msg?: string; [key: string]: any }> {
  const outputs = await difyWorkflow<{ code: number }>({
    apiBase,
    apiKey,
    inputs: contact,
    user: contact.value,
  });

  if (outputs.code !== 200) {
    throw new Error(getErrorMessage(outputs.code, COMMON_MESSAGES));
  }

  return outputs;
}

export async function checkInvitationCode(
  apiBase: string,
  apiKey: string,
  inviteCode: string,
  contact: DifyContact,
): Promise<{ code: number }> {
  const outputs = await difyWorkflow<{ code: number }>({
    apiBase,
    apiKey,
    inputs: { invite_code: inviteCode, ...contact },
    user: contact.value,
  });

  if (outputs.code !== 200) {
    const allMessages = mergeMessages(COMMON_MESSAGES, INVITATION_MESSAGES);
    throw new Error(getErrorMessage(outputs.code, allMessages));
  }

  return outputs;
}

export async function fetchUserProfile(
  apiBase: string,
  apiKey: string,
  contact: DifyContact,
): Promise<any> {
  return difyWorkflow({
    apiBase,
    apiKey,
    inputs: contact,
    user: contact.value,
  });
}
