# @skxc/dify-client

Dify API 客户端，封装了 Workflow、Chatflow、文件上传等通用能力，以及认证、计费等业务模块。

## 安装

```bash
pnpm add @skxc/dify-client
```

## 快速开始

### 1. 创建 Client 实例

```typescript
import { createDifyClient } from "@skxc/dify-client";

const dify = createDifyClient({
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

    // 计费
    checkPoints: "app-eee",
    deductPoints: "app-fff",
    recharge: "app-ggg",

    // 文件
    upload: "app-hhh",
  },

  // 可选：自定义错误消息
  errorMessages: {
    203: "自定义：Token 余额不足",
  },
});
```

### 2. 使用认证模块

```typescript
// 登录
const result = await dify.auth.login(
  { user_account: "email@example.com", password: "123456" },
  "email@example.com",
);

// 注册
await dify.auth.signup(
  { user_name: "张三", user_email: "email@example.com", password: "123456" },
  "email@example.com",
);

// 发送验证码
await dify.auth.sendEmailVercode("email@example.com");
await dify.auth.sendPhoneVercode("13800138000");

// 校验验证码
await dify.auth.checkVerifyCode("email@example.com", "123456");

// 重置密码
await dify.auth.resetPassword({ key: "user_email", value: "email@example.com" }, "newPassword123");

// 获取用户信息
const profile = await dify.auth.fetchUserProfile({ key: "user_email", value: "email@example.com" });

// 邀请码核销
await dify.auth.checkInvitationCode("INVITE_CODE", {
  key: "user_email",
  value: "email@example.com",
});
```

### 3. 使用计费模块

```typescript
const contact = { key: "user_email", value: "email@example.com" };

// 检查积分
const result = await dify.billing.checkPoints(contact, 10000);
if (result.code !== 200) {
  console.log(result.message); // 'Token余额不足'
}

// 扣除积分
await dify.billing.handleDeductPoints(contact, 5000, {
  difyAppId: "your-app-id",
  remark: "标书助手-全文生成",
});

// 充值（支付宝）
const paymentUrl = await dify.billing.recharge(contact, 100);
window.open(paymentUrl);
```

### 4. 使用文件模块

```typescript
// 上传文件
const result = await dify.file.upload(file, userId);
console.log(result.id); // 文件 ID
```

### 5. 使用底层 API

```typescript
// Workflow（阻塞式）
const outputs = await dify.workflow.run({
  token: "app-xxx",
  inputs: { key: "value" },
  user: "user-id",
});

// Chatflow（流式）
await dify.chatflow.stream(
  {
    token: "app-xxx",
    inputs: { key: "value" },
    query: "你好",
    user: "user-id",
  },
  {
    onText: (text) => console.log(text),
    onFinal: () => console.log("完成"),
    onError: (error) => console.error(error),
  },
);
```

## API 参考

### createDifyClient(config)

创建 DifyClient 实例。

**参数：**

```typescript
interface DifyClientConfig {
  baseUrl?: string; // API 基础地址，默认 'https://ai.vskxc.com/v1'
  tokens: DifyTokens;
  errorMessages?: Record<number, string>; // 自定义错误消息
}
```

### dify.auth

认证模块，包含以下方法：

| 方法                                  | 参数                                   | 返回值                 | 说明             |
| ------------------------------------- | -------------------------------------- | ---------------------- | ---------------- |
| `login(inputs, user)`                 | inputs: 登录参数, user: 用户标识       | `Promise<AuthResult>`  | 登录             |
| `signup(inputs, user)`                | inputs: 注册参数, user: 用户标识       | `Promise<AuthResult>`  | 注册             |
| `sendEmailVercode(email)`             | email: 邮箱                            | `Promise<any>`         | 发送邮箱验证码   |
| `sendPhoneVercode(phone)`             | phone: 手机号                          | `Promise<any>`         | 发送手机验证码   |
| `checkVerifyCode(contact, code)`      | contact: 邮箱/手机号, code: 验证码     | `Promise<any>`         | 校验验证码       |
| `resetPassword(contact, newPassword)` | contact: 用户标识, newPassword: 新密码 | `Promise<any>`         | 重置密码         |
| `checkUser(contact)`                  | contact: 用户标识                      | `Promise<any>`         | 检查用户是否存在 |
| `fetchUserProfile(contact)`           | contact: 用户标识                      | `Promise<UserProfile>` | 获取用户信息     |
| `checkInvitationCode(code, contact)`  | code: 邀请码, contact: 用户标识        | `Promise<any>`         | 邀请码核销       |

### dify.billing

计费模块，包含以下方法：

| 方法                                             | 参数                                                    | 返回值                       | 说明                |
| ------------------------------------------------ | ------------------------------------------------------- | ---------------------------- | ------------------- |
| `checkPoints(contact, limit)`                    | contact: 用户标识, limit: 预估消耗                      | `Promise<CheckPointsResult>` | 检查积分余额        |
| `handleDeductPoints(contact, credits, options?)` | contact: 用户标识, credits: 消耗积分, options: 可选配置 | `Promise<any>`               | 扣除积分            |
| `recharge(contact, amount, options?)`            | contact: 用户标识, amount: 充值金额, options: 可选配置  | `Promise<string>`            | 充值（返回支付URL） |

### dify.file

文件模块，包含以下方法：

| 方法                   | 参数                           | 返回值                    | 说明     |
| ---------------------- | ------------------------------ | ------------------------- | -------- |
| `upload(file, userId)` | file: 文件对象, userId: 用户ID | `Promise<{ id: string }>` | 上传文件 |

### dify.workflow

底层 Workflow API：

| 方法           | 参数                               | 返回值       | 说明          |
| -------------- | ---------------------------------- | ------------ | ------------- |
| `run(options)` | options: { token?, inputs, user? } | `Promise<T>` | 执行 Workflow |

### dify.chatflow

底层 Chatflow API：

| 方法                    | 参数                              | 返回值          | 说明          |
| ----------------------- | --------------------------------- | --------------- | ------------- |
| `stream(body, options)` | body: 请求参数, options: 回调配置 | `Promise<void>` | 流式 Chatflow |

## 类型定义

```typescript
interface DifyContact {
  key: "user_email" | "user_phone";
  value: string;
}

interface AuthResult {
  code: number;
  success?: boolean;
  message?: string;
  [key: string]: any;
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

interface CheckPointsResult {
  code: number;
  message?: string;
}

interface ProgressEvent {
  type: "node_started" | "iteration_next" | "iteration_completed";
  title?: string;
}
```

## 错误处理

默认错误消息在 `messages.ts` 中定义，可以通过 `errorMessages` 配置覆盖：

```typescript
const dify = createDifyClient({
  tokens: { ... },
  errorMessages: {
    203: '自定义：Token 余额不足',
    500: '自定义：服务器错误',
  },
})
```

## License

MIT
