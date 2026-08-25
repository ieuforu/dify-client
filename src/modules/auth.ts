// ═══════════════════════════════════════════════════════════════════════════
//  认证模块
//  底层全部走 Dify Workflow（/workflows/run），每个方法对应一个独立的 Dify Workflow
//  token 在 config.tokens 中配置，inputs 是 Dify Workflow 的表单字段
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig, DifyContact, UserState } from "../types";
import { difyUserInput } from "../types";
import {
  COMMON_MESSAGES,
  INVITATION_MESSAGES,
  AUTH_ERROR_MESSAGES,
  SIGNUP_MESSAGES,
  mergeMessages,
  getErrorMessage,
} from "../messages";
import { DifyError, runWorkflow } from "../utils";

export interface AuthModule {
  /**
   * 登录（推荐使用）
   * 底层：Dify Workflow [login]
   * - 自动构造 inputs: { user_account, password }
   * - 成功后自动持久化用户状态到 localStorage
   * - 失败 throw DifyError（含中文 message）
   */
  authenticate(params: { account: string; password: string }): Promise<void>;

  /**
   * 注册（不自动持久化，推荐使用）
   * 底层：Dify Workflow [signup]
   * - 失败 throw DifyError（含中文 message）
   * - 成功返回 void，上层跳转登录页即可
   */
  signupOnly(params: {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
  }): Promise<void>;

  /**
   * 发送邮箱验证码
   * 底层：Dify Workflow [sendEmailCode] → inputs: { email }
   */
  sendEmailVercode(email: string): Promise<void>;

  /**
   * 发送手机验证码
   * 底层：Dify Workflow [sendPhoneCode] → inputs: { user_phone }
   */
  sendPhoneVercode(phone: string): Promise<void>;

  /**
   * 核对验证码
   * 底层：Dify Workflow [checkCode] → inputs: { EmailOrPhone, ver_code }
   */
  checkVerifyCode(contact: string, code: string): Promise<void>;

  /**
   * 重置密码
   * 底层：Dify Workflow [resetPassword] → inputs: { user_email/user_phone, new_ps }
   */
  resetPassword(contact: DifyContact, newPassword: string): Promise<void>;

  /**
   * 检查用户是否存在
   * 底层：Dify Workflow [checkUser] → inputs: { user_email/user_phone }
   * 不存在 throw DifyError
   */
  checkUser(contact: DifyContact): Promise<void>;

  /**
   * 邀请码核销
   * 底层：Dify Workflow [checkInvitationCode] → inputs: { invite_code, user_email/user_phone }
   */
  checkInvitationCode(code: string, contact: DifyContact): Promise<void>;

  /**
   * 注册赠送积分
   * 底层：Dify Workflow [giftPoints] → inputs: { user_email/user_phone, query: "赠送积分" }
   */
  giftPoints(contact: DifyContact, user: string): Promise<void>;
}

export function createAuthModule(config: DifyClientConfig, userState: UserState): AuthModule {
  const { baseUrl, tokens, errorMessages: customMessages = {} } = config;
  const allMessages = mergeMessages(COMMON_MESSAGES, customMessages);

  /**
   * 通用 workflow 执行器：执行 Dify Workflow 并检查返回的 code
   * - code=200 → 成功，返回 void
   * - code≠200 → throw DifyError（含中文 message 和 code）
   */
  async function runAndCheck(
    tokenName: keyof typeof tokens,
    inputs: Record<string, unknown>,
    user: string,
    messages: Record<number, string> = allMessages,
  ): Promise<void> {
    const token = tokens[tokenName];
    if (!token) throw new Error(`未配置 ${String(tokenName)} token`);
    const outputs = await runWorkflow<{ code?: number }>(baseUrl!, token, inputs, user);
    if (outputs.code != null && outputs.code !== 200) {
      throw new DifyError(outputs.code, getErrorMessage(outputs.code, messages));
    }
  }

  return {
    async authenticate(params) {
      if (!tokens.login) throw new Error("未配置 login token");

      const inputs = { user_account: params.account, password: params.password };
      const user = params.account || "anonymous";
      const outputs = await runWorkflow<{ code?: number }>(baseUrl!, tokens.login, inputs, user);

      if (outputs.code != null && outputs.code !== 200) {
        const errorMap = AUTH_ERROR_MESSAGES.login || {};
        throw new DifyError(outputs.code, errorMap[outputs.code] || `登录失败 (${outputs.code})`);
      }

      // 成功 → 自动持久化用户状态
      const loginMethod: "email" | "phone" = params.account.includes("@") ? "email" : "phone";
      userState.setUser({
        email: loginMethod === "email" ? params.account : "",
        phone: loginMethod === "phone" ? params.account : "",
        loginMethod,
      });
    },

    async signupOnly(params) {
      const inputs = {
        user_name: params.name,
        user_email: params.email,
        user_phone: params.phone,
        password: params.password,
      };
      const user = params.email || params.phone || "anonymous";
      await runAndCheck(
        "signup",
        inputs,
        user,
        mergeMessages(COMMON_MESSAGES, SIGNUP_MESSAGES, customMessages),
      );
    },

    async sendEmailVercode(email) {
      await runAndCheck("sendEmailCode", { email }, email);
    },

    async sendPhoneVercode(phone) {
      await runAndCheck("sendPhoneCode", { user_phone: phone }, phone);
    },

    async checkVerifyCode(contact, code) {
      await runAndCheck("checkCode", { EmailOrPhone: contact, ver_code: code }, contact);
    },

    async resetPassword(contact, newPassword) {
      await runAndCheck(
        "resetPassword",
        { ...difyUserInput(contact), new_ps: newPassword },
        contact.value,
      );
    },

    async checkUser(contact) {
      await runAndCheck("checkUser", difyUserInput(contact), contact.value);
    },

    async checkInvitationCode(code, contact) {
      const invitationMessages = mergeMessages(
        COMMON_MESSAGES,
        INVITATION_MESSAGES,
        customMessages,
      );
      await runAndCheck(
        "checkInvitationCode",
        { invite_code: code, ...difyUserInput(contact) },
        contact.value,
        invitationMessages,
      );
    },

    async giftPoints(contact, user) {
      await runAndCheck("giftPoints", { ...difyUserInput(contact), query: "赠送积分" }, user);
    },
  };
}
