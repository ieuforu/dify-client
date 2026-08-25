// ═══════════════════════════════════════════════════════════════════════════
//  底层 HTTP 请求
// ═══════════════════════════════════════════════════════════════════════════

/** 发送 POST 请求 */
export async function request(
  apiBase: string,
  apiKey: string,
  path: string,
  body: Record<string, any>,
): Promise<any> {
  const url = `${apiBase}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 504) throw new Error("请求服务器超时，请稍后重试");
  if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);

  return res.json();
}

/** 上传文件 */
export async function uploadRequest(
  apiBase: string,
  apiKey: string,
  file: File,
  userId: string,
): Promise<any> {
  // 上传接口路径：/v1/files/upload
  const url = `${apiBase}/files/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("user", userId);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) throw new Error("文件上传失败");
  return res.json();
}
