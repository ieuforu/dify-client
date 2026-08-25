// ═══════════════════════════════════════════════════════════════════════════
//  错误消息映射
// ═══════════════════════════════════════════════════════════════════════════

/** 通用错误码（所有模块共用） */
export const COMMON_MESSAGES: Record<number, string> = {
  200: "操作成功",
  201: "未找到该用户",
  202: "参数错误",
  500: "服务异常",
  2011: "该手机号已被注册",
  2012: "该邮箱已被注册",
};

/** 登录错误码 */
export const LOGIN_MESSAGES: Record<number, string> = {
  201: "账号不存在，请先注册",
  203: "账号已被禁用",
  204: "密码错误",
};

/** 注册错误码 */
export const SIGNUP_MESSAGES: Record<number, string> = {
  201: "账号已被注册，请直接登录",
  203: "邀请码无效",
};

/** 邀请码错误码 */
export const INVITATION_MESSAGES: Record<number, string> = {
  201: "未查询到该用户信息",
  203: "邀请码无效",
  204: "用户已经使用过邀请码",
  205: "该邀请码已过期",
};

/** 积分错误码 */
export const CHECK_POINTS_MESSAGES: Record<number, string> = {
  203: "Token余额不足",
};

/** authenticate 专用错误码（按 mode 分组） */
export const AUTH_ERROR_MESSAGES: Record<string, Record<number, string>> = {
  login: {
    201: "账号不存在，请先注册",
    202: "参数错误",
    203: "账号已被禁用",
    204: "密码错误",
    500: "后台错误，登录失败",
  },
  signup: {
    201: "账号已被注册，请直接登录",
    202: "参数错误（邮箱和电话请至少填写一项）",
    2011: "该手机号已被注册",
    2012: "该邮箱已被注册",
    500: "后台错误，注册失败",
  },
};

/** 工具函数：合并多个错误消息映射 */
export function mergeMessages(...layers: Record<number, string>[]): Record<number, string> {
  return Object.assign({}, ...layers);
}

/** 工具函数：根据 code 获取错误消息 */
export function getErrorMessage(code: number, messages: Record<number, string>): string {
  return messages[code] || "操作失败";
}
