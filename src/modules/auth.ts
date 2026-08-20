// ═══════════════════════════════════════════════════════════════════════════
//  认证模块
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig, DifyContact, AuthResult, UserProfile } from "../types";
import { request } from "../http";
import { difyUserInput } from "../types";
import {
  COMMON_MESSAGES,
  LOGIN_MESSAGES,
  SIGNUP_MESSAGES,
  INVITATION_MESSAGES,
  mergeMessages,
  getErrorMessage,
} from "../messages";

export interface AuthModule {
  login(inputs: Record<string, any>, user: string): Promise<AuthResult>;
  signup(inputs: Record<string, any>, user: string): Promise<AuthResult>;
  sendEmailVercode(email: string): Promise<any>;
  sendPhoneVercode(phone: string): Promise<any>;
  checkVerifyCode(contact: string, code: string): Promise<any>;
  resetPassword(contact: DifyContact, newPassword: string): Promise<any>;
  checkUser(contact: DifyContact): Promise<any>;
  fetchUserProfile(contact: DifyContact): Promise<any>;
  checkInvitationCode(code: string, contact: DifyContact): Promise<any>;
}

export function createAuthModule(config: DifyClientConfig): AuthModule {
  const { baseUrl, tokens, errorMessages: customMessages = {} } = config;

  // 合并默认错误消息和自定义错误消息
  const allMessages = mergeMessages(COMMON_MESSAGES, customMessages);

  /** 执行 Workflow 并处理结果 */
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
    /* 登录 */
    async login(inputs, user) {
      if (!tokens.login) throw new Error("未配置 login token");
      const outputs = await runWorkflow<AuthResult>(tokens.login, inputs, user);
      return outputs;
    },

    /* 注册 */
    async signup(inputs, user) {
      if (!tokens.signup) throw new Error("未配置 signup token");
      const outputs = await runWorkflow<AuthResult>(tokens.signup, inputs, user);
      return outputs;
    },

    /* 发送邮箱验证码 */
    async sendEmailVercode(email) {
      if (!tokens.sendEmailCode) throw new Error("未配置 sendEmailCode token");
      return runWorkflow(tokens.sendEmailCode, { email }, email);
    },

    /* 发送手机验证码 */
    async sendPhoneVercode(phone) {
      if (!tokens.sendPhoneCode) throw new Error("未配置 sendPhoneCode token");
      return runWorkflow(tokens.sendPhoneCode, { user_phone: phone }, phone);
    },

    /* 验证码核对 */
    async checkVerifyCode(contact, code) {
      if (!tokens.checkCode) throw new Error("未配置 checkCode token");
      return runWorkflow(tokens.checkCode, { EmailOrPhone: contact, ver_code: code }, contact);
    },

    /* 重置密码 */
    async resetPassword(contact, newPassword) {
      if (!tokens.resetPassword) throw new Error("未配置 resetPassword token");
      return runWorkflow(
        tokens.resetPassword,
        { ...difyUserInput(contact), new_ps: newPassword },
        contact.value,
      );
    },

    /* 检查用户是否存在 */
    async checkUser(contact) {
      if (!tokens.checkUser) throw new Error("未配置 checkUser token");
      const outputs = await runWorkflow<{ code: number }>(
        tokens.checkUser,
        difyUserInput(contact),
        contact.value,
      );

      if (outputs.code !== 200) {
        throw new Error(getErrorMessage(outputs.code, allMessages));
      }

      return outputs;
    },

    /* 查询用户个人信息【用户基本信息查询】 */
    async fetchUserProfile(contact) {
      if (!tokens.checkUser) throw new Error("未配置 checkUser token");
      return runWorkflow(tokens.checkUser, difyUserInput(contact), contact.value);
    },

    /* 邀请码核销 */
    async checkInvitationCode(code, contact) {
      if (!tokens.checkInvitationCode) throw new Error("未配置 checkInvitationCode token");
      const outputs = await runWorkflow<{ code: number }>(
        tokens.checkInvitationCode,
        { invite_code: code, ...difyUserInput(contact) },
        contact.value,
      );

      const invitationMessages = mergeMessages(
        COMMON_MESSAGES,
        INVITATION_MESSAGES,
        customMessages,
      );
      if (outputs.code !== 200) {
        throw new Error(getErrorMessage(outputs.code, invitationMessages));
      }

      return outputs;
    },
  };
}
