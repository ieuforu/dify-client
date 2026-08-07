// ── Types ──
export type {
  LoginMethod,
  DifyContact,
  ProgressEvent,
  DifyClientOptions,
  ChatflowOptions,
  WorkflowResult,
} from "./types";
export { difyUserInput } from "./types";

// ── Stream ──
export { readSSEStream } from "./stream";

// ── Client ──
export { difyWorkflow, difyChatflow, uploadFile } from "./client";

// ── Messages ──
export {
  COMMON_MESSAGES,
  LOGIN_MESSAGES,
  SIGNUP_MESSAGES,
  INVITATION_MESSAGES,
  CHECK_POINTS_MESSAGES,
  mergeMessages,
  getErrorMessage,
} from "./messages";

// ── Auth ──
export {
  buildContact,
  authenticate,
  sendEmailVercode,
  sendPhoneVercode,
  checkVerifyCode,
  resetPassword,
  checkUser,
  checkInvitationCode,
  fetchUserProfile,
} from "./auth";

// ── Billing ──
export type { CheckPointsResult } from "./billing";
export { checkPoints, handleDeductPoints } from "./billing";
