# @skxc/dify-client

Dify API 客户端，封装了 Workflow、Chatflow、文件上传等通用能力，以及认证、计费、用户状态管理等业务模块。

## 安装

```bash
pnpm add @skxc/dify-client
```

## 快速开始

### 1. 创建 Client 实例

```typescript
import { createDifyClient } from "@skxc/dify-client";

const dify = createDifyClient({
  // 默认 '/api'（代理模式），直连时改为 Dify API 地址
  baseUrl: "/api",
  tokens: {
    // 认证
    login: "app-xxx",
    signup: "app-yyy",
    sendEmailCode: "app-zzz",
    sendPhoneCode: "app-www",
    checkCode: "app-aaa",
    resetPassword: "app-bbb",
    checkUser: "app-ccc",
    checkInvitationCode: "app-ddd",
    giftPoints: "app-eee",

    // 计费
    checkPoints: "app-fff",
    deductPoints: "app-ggg",
    recharge: "app-hhh",

    // 文件
    upload: "app-iii",

    // 代理（可选）
    agentProfile: "app-jjj",
  },

  // 可选：自定义错误消息，与默认消息合并，相同 code 会覆盖
  errorMessages: {
    203: "自定义：Token 余额不足",
  },
});
```

### 2. 认证（推荐方式）

```typescript
// 登录（自动持久化用户状态到 localStorage，失败 throw DifyError）
await dify.auth.authenticate("login", {
  account: "email@example.com",
  password: "123456",
});

// 注册（不自动持久化，失败 throw DifyError）
await dify.auth.signupOnly({
  name: "张三",
  email: "email@example.com",
  password: "123456",
});

// 注册后赠送积分
await dify.auth.giftPoints({ key: "user_email", value: "email@example.com" }, "email@example.com");
```

### 3. 认证（原始 API）

```typescript
// 登录（返回 AuthResult，需手动判断 code）
const result = await dify.auth.login(
  { user_account: "email@example.com", password: "123456" },
  "email@example.com",
);
if (result.code !== 200) console.log("登录失败");

// 注册（返回 AuthResult，需手动判断 code）
const result = await dify.auth.signup(
  { user_name: "张三", user_email: "email@example.com", password: "123456" },
  "email@example.com",
);

// 发送验证码（失败 throw DifyError）
await dify.auth.sendEmailVercode("email@example.com");
await dify.auth.sendPhoneVercode("13800138000");

// 校验验证码（失败 throw DifyError）
await dify.auth.checkVerifyCode("email@example.com", "123456");

// 重置密码（失败 throw DifyError）
await dify.auth.resetPassword({ key: "user_email", value: "email@example.com" }, "newPassword123");

// 检查用户是否存在（不存在 throw DifyError）
await dify.auth.checkUser({ key: "user_email", value: "email@example.com" });

// 邀请码核销（失败 throw DifyError）
await dify.auth.checkInvitationCode("INVITE_CODE", {
  key: "user_email",
  value: "email@example.com",
});
```

### 4. 用户状态管理

```typescript
// 获取当前登录用户（未登录返回 null）
const user = dify.user.getUser();

// 获取 DifyContact（用于传给其他 API）
const contact = dify.user.getContact();

// 获取显示名称（邮箱前缀 / 手机号脱敏）
const name = dify.user.getDisplayName();

// 是否已登录
if (dify.user.isLogin()) { ... }

// 查询当前用户个人信息（自动解析，返回 UserProfile）
const profile = await dify.user.getProfile();

// 查询代理信息
const agent = await dify.user.getAgentProfile("agent@example.com");

// 登出（清除 localStorage）
dify.user.logout();

// 监听用户状态变化（用于 React/Vue 响应式）
const unsubscribe = dify.user.subscribe(() => {
  console.log("用户状态变化");
});
```

### 5. 计费

```typescript
const contact = { key: "user_email", value: "email@example.com" };

// 检查余额（不足 throw DifyError，code=203 表示余额不足）
try {
  await dify.billing.checkPoints(contact, 10000);
} catch (e) {
  if (e instanceof DifyError && e.code === 203) {
    // 弹充值窗
  }
}

// 扣除积分（失败 throw DifyError）
await dify.billing.handleDeductPoints(contact, 5000, {
  difyAppId: "your-app-id",
  remark: "标书助手-全文生成",
});

// 充值（返回支付宝支付链接）
const paymentUrl = await dify.billing.recharge(contact, 100);
window.open(paymentUrl);
```

### 6. 文件上传

```typescript
const result = await dify.file.upload(file, userId);
console.log(result.id); // 文件 ID
```

### 7. 底层 API

```typescript
// Workflow（阻塞式，底层 API，推荐用 auth.* / billing.* 封装方法）
const outputs = await dify.workflow.run({
  token: "app-xxx",
  inputs: { key: "value" },
  user: "user-id",
});

// Chatflow（SSE 流式，底层 API）
await dify.chatflow.stream(
  {
    token: "app-xxx",
    inputs: { key: "value" },
    query: "你好",
    user: "user-id",
  },
  {
    onText: (text) => console.log(text),
    onConversationId: (id) => console.log("会话ID:", id),
    onFinal: () => console.log("完成"),
    onError: (error) => console.error(error),
    onProgress: (event) => console.log(event),
    onCredits: (credits) => console.log("消耗:", credits),
  },
);
```

## API 参考

### createDifyClient(config)

创建 DifyClient 实例。

```typescript
interface DifyClientConfig {
  baseUrl?: string; // API 基础地址，默认 '/api'（代理模式）
  tokens: DifyTokens;
  errorMessages?: Record<number, string>; // 自定义错误消息
}
```

### dify.auth

| 方法                                  | 参数                                         | 返回值                | 说明                                           |
| ------------------------------------- | -------------------------------------------- | --------------------- | ---------------------------------------------- |
| `authenticate(mode, params)`          | mode: 'login'\|'signup', params              | `Promise<AuthResult>` | **推荐**。登录自动持久化，失败 throw DifyError |
| `signupOnly(params)`                  | params: { name?, email?, phone?, password? } | `Promise<void>`       | **推荐**。注册不持久化，失败 throw DifyError   |
| `login(inputs, user)`                 | inputs: 登录参数, user: 用户标识             | `Promise<AuthResult>` | 原始登录 API                                   |
| `signup(inputs, user)`                | inputs: 注册参数, user: 用户标识             | `Promise<AuthResult>` | 原始注册 API                                   |
| `sendEmailVercode(email)`             | email: 邮箱                                  | `Promise<void>`       | 失败 throw DifyError                           |
| `sendPhoneVercode(phone)`             | phone: 手机号                                | `Promise<void>`       | 失败 throw DifyError                           |
| `checkVerifyCode(contact, code)`      | contact: 邮箱/手机号, code: 验证码           | `Promise<void>`       | 失败 throw DifyError                           |
| `resetPassword(contact, newPassword)` | contact: DifyContact, newPassword: 新密码    | `Promise<void>`       | 失败 throw DifyError                           |
| `checkUser(contact)`                  | contact: DifyContact                         | `Promise<void>`       | 不存在 throw DifyError                         |
| `checkInvitationCode(code, contact)`  | code: 邀请码, contact: DifyContact           | `Promise<void>`       | 失败 throw DifyError                           |
| `giftPoints(contact, user)`           | contact: DifyContact, user: 用户标识         | `Promise<void>`       | 注册赠送积分，失败 throw DifyError             |

### dify.user

| 方法                     | 参数                                         | 返回值                 | 说明                                                  |
| ------------------------ | -------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| `setUser(data)`          | data: { email?, phone?, loginMethod, role? } | `void`                 | 设置用户并持久化到 localStorage                       |
| `getUser()`              | -                                            | `UserData \| null`     | 获取当前用户，未登录返回 null                         |
| `getContact()`           | -                                            | `DifyContact \| null`  | 获取 DifyContact，未登录返回 null                     |
| `getUserId()`            | -                                            | `string`               | 获取 userId（email 或 phone），未登录返回 'anonymous' |
| `getDisplayName()`       | -                                            | `string`               | 获取显示名称（邮箱前缀 / 手机号脱敏）                 |
| `isLogin()`              | -                                            | `boolean`              | 是否已登录                                            |
| `logout()`               | -                                            | `void`                 | 登出，清除 localStorage                               |
| `getProfile()`           | -                                            | `Promise<UserProfile>` | 查询当前用户个人信息                                  |
| `getAgentProfile(email)` | email: 代理邮箱                              | `Promise<UserProfile>` | 查询代理信息                                          |
| `subscribe(listener)`    | listener: 回调函数                           | `() => void`           | 监听用户状态变化，返回取消订阅函数                    |

### dify.billing

| 方法                                             | 参数                                  | 返回值            | 说明                                |
| ------------------------------------------------ | ------------------------------------- | ----------------- | ----------------------------------- |
| `checkPoints(contact, limit)`                    | contact: DifyContact, limit: 预估消耗 | `Promise<void>`   | 余额不足 throw DifyError (code=203) |
| `handleDeductPoints(contact, credits, options?)` | contact, credits, options             | `Promise<void>`   | 扣除积分，失败 throw DifyError      |
| `recharge(contact, amount, options?)`            | contact, amount, options              | `Promise<string>` | 充值，返回支付宝支付链接            |

### dify.file

| 方法                   | 参数                       | 返回值                    | 说明     |
| ---------------------- | -------------------------- | ------------------------- | -------- |
| `upload(file, userId)` | file: File, userId: string | `Promise<{ id: string }>` | 上传文件 |

### dify.workflow / dify.chatflow

底层 API，详见代码注释。上层推荐使用 `auth.*` / `billing.*` 封装方法。

## DifyError

SDK 统一错误类型：

```typescript
import { DifyError } from "@skxc/dify-client";

try {
  await dify.auth.authenticate("login", { account, password });
} catch (e) {
  if (e instanceof DifyError) {
    console.log(e.code); // Dify 业务错误码，如 203 = 余额不足
    console.log(e.message); // 中文可读错误，可直接 toast
  }
}
```

## 类型定义

```typescript
interface DifyContact {
  key: "user_email" | "user_phone";
  value: string;
}

interface UserData {
  email: string;
  phone: string;
  loginMethod: "email" | "phone";
  role: "user" | "agent";
}

interface AuthResult {
  code: number;
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

interface UserProfile {
  id: number;
  user_name: string;
  email: string | null;
  phone: string | null;
  points_balance: number;
  total_consumed_points: number;
  total_recharge_points: number;
  type_name: string;
  create_time: string;
  agent_invite_code: string | null;
}

interface ProgressEvent {
  type: "node_started" | "iteration_next" | "iteration_completed";
  title?: string;
}
```

## 错误消息自定义

默认错误消息可通过 `errorMessages` 配置覆盖：

```typescript
const dify = createDifyClient({
  tokens: { ... },
  errorMessages: {
    203: "自定义：Token 余额不足",
    500: "自定义：服务器错误",
  },
});
```

## License

MIT
