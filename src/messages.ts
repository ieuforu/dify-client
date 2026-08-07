// ── 通用错误码（三个项目100%一致） ──

export const COMMON_MESSAGES: Record<number, string> = {
  200: "操作成功",
  201: "未找到该用户",
  202: "参数错误",
  500: "服务异常",
  2011: "该手机号已被注册",
  2012: "该邮箱已被注册",
};

// ── Context-specific（同一code不同含义） ──

export const LOGIN_MESSAGES: Record<number, string> = {
  203: "账号已被禁用",
  204: "密码错误",
};

export const SIGNUP_MESSAGES: Record<number, string> = {
  201: "账号已被注册，请直接登录",
  203: "邀请码无效",
};

export const INVITATION_MESSAGES: Record<number, string> = {
  201: "未查询到该用户信息",
  203: "邀请码无效",
  204: "用户已经使用过邀请码",
  205: "该邀请码已过期",
};

export const CHECK_POINTS_MESSAGES: Record<number, string> = {
  203: "Token余额不足",
};

// ── 合并工具 ──

/** 合并多层错误码映射，后者覆盖前者 */
export function mergeMessages(...layers: Record<number, string>[]): Record<number, string> {
  return Object.assign({}, ...layers);
}

/** 从合并后的映射中获取消息，兜底 '操作失败' */
export function getErrorMessage(code: number, messages: Record<number, string>): string {
  return messages[code] || "操作失败";
}
