// ═══════════════════════════════════════════════════════════════════════════
//  用户状态管理（localStorage 持久化）
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig, LoginMethod, UserData, UserState, UserProfile } from "../types";
import { runWorkflow } from "../utils";

const STORAGE_KEYS = {
  email: "user_email",
  phone: "user_phone",
  loginMethod: "user_login_method",
  role: "user_role",
} as const;

const listeners = new Set<() => void>();

let globalUser: UserData | null = null;
let initialized = false;

function loadFromStorage(): UserData | null {
  if (typeof localStorage === "undefined") return null;
  const email = localStorage.getItem(STORAGE_KEYS.email) || "";
  const phone = localStorage.getItem(STORAGE_KEYS.phone) || "";
  const loginMethod = (localStorage.getItem(STORAGE_KEYS.loginMethod) || "email") as LoginMethod;
  const role = (localStorage.getItem(STORAGE_KEYS.role) || "user") as "user" | "agent";
  if (email || phone) return { email, phone, loginMethod, role };
  return null;
}

function persist(user: UserData | null) {
  if (typeof localStorage === "undefined") return;
  if (user) {
    if (user.email) localStorage.setItem(STORAGE_KEYS.email, user.email);
    else localStorage.removeItem(STORAGE_KEYS.email);
    if (user.phone) localStorage.setItem(STORAGE_KEYS.phone, user.phone);
    else localStorage.removeItem(STORAGE_KEYS.phone);
    if (user.email || user.phone) localStorage.setItem(STORAGE_KEYS.loginMethod, user.loginMethod);
    else localStorage.removeItem(STORAGE_KEYS.loginMethod);
    localStorage.setItem(STORAGE_KEYS.role, user.role);
  } else {
    localStorage.removeItem(STORAGE_KEYS.email);
    localStorage.removeItem(STORAGE_KEYS.phone);
    localStorage.removeItem(STORAGE_KEYS.loginMethod);
    localStorage.removeItem(STORAGE_KEYS.role);
  }
}

function notify() {
  for (const fn of listeners) fn();
}

function ensureInit() {
  if (!initialized) {
    globalUser = loadFromStorage();
    initialized = true;
  }
}

export function createUserState(config: DifyClientConfig): UserState {
  const { baseUrl, tokens } = config;

  return {
    setUser(data) {
      globalUser = {
        email: data.email || "",
        phone: data.phone || "",
        loginMethod: data.loginMethod,
        role: data.role || "user",
      };
      persist(globalUser);
      notify();
    },

    getUser() {
      ensureInit();
      return globalUser;
    },

    getContact() {
      ensureInit();
      if (!globalUser) return null;
      if (globalUser.role === "agent") {
        return { key: "user_email" as const, value: globalUser.email };
      }
      return {
        key: globalUser.loginMethod === "email" ? ("user_email" as const) : ("user_phone" as const),
        value: globalUser.loginMethod === "email" ? globalUser.email : globalUser.phone,
      };
    },

    getUserId() {
      ensureInit();
      if (!globalUser) return "anonymous";
      return globalUser.loginMethod === "email" ? globalUser.email : globalUser.phone;
    },

    getDisplayName() {
      ensureInit();
      if (!globalUser) return "";
      if (globalUser.loginMethod === "email" && globalUser.email)
        return globalUser.email.split("@")[0];
      if (globalUser.loginMethod === "phone" && globalUser.phone)
        return globalUser.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
      if (globalUser.email) return globalUser.email.split("@")[0];
      if (globalUser.phone) return globalUser.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
      return "";
    },

    isLogin() {
      ensureInit();
      return !!globalUser;
    },

    logout() {
      globalUser = null;
      persist(null);
      notify();
    },

    /**
     * 查询当前登录用户的个人信息
     * 底层：Dify Workflow [checkUser] → inputs: { user_email 或 user_phone }
     * 返回：UserProfile（已从 Dify 返回的嵌套结构中解析出来）
     */
    async getProfile() {
      const contact = this.getContact();
      if (!contact) throw new Error("未登录");
      if (!tokens.checkUser) throw new Error("未配置 checkUser token");
      const outputs = (await runWorkflow(
        baseUrl!,
        tokens.checkUser,
        { [contact.key]: contact.value },
        contact.value,
      )) as Record<string, unknown>;
      const list = (outputs?.data as Array<{ result: UserProfile[] }>)?.[0]?.result;
      if (Array.isArray(list) && list.length > 0) return list[0];
      throw new Error("获取用户信息失败");
    },

    /**
     * 查询代理信息
     * 底层：Dify Workflow [agentProfile] → inputs: { agent_email }
     * 返回：UserProfile（代理的用户信息）
     */
    async getAgentProfile(agentEmail: string) {
      if (!tokens.agentProfile) throw new Error("未配置 agentProfile token");
      const outputs = (await runWorkflow(
        baseUrl!,
        tokens.agentProfile,
        { agent_email: agentEmail },
        agentEmail,
      )) as Record<string, unknown>;
      const list = (outputs?.data as Array<{ result: UserProfile[] }>)?.[0]?.result;
      if (Array.isArray(list) && list.length > 0) return list[0];
      throw new Error("获取代理信息失败");
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
