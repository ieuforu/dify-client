// ═══════════════════════════════════════════════════════════════════════════
//  文件模块
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig } from "../types";
import { uploadRequest } from "../http";

export interface FileModule {
  upload(file: File, userId: string): Promise<{ id: string }>;
}

export function createFileModule(config: DifyClientConfig): FileModule {
  const { baseUrl, tokens } = config;

  return {
    async upload(file, userId) {
      if (!tokens.upload) throw new Error("未配置 upload token");
      return uploadRequest(baseUrl!, tokens.upload, file, userId);
    },
  };
}
