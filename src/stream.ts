// ── SSE 流解析 ──

/** 逐行解析 SSE 流，yield 每个 JSON 事件对象 */
export async function* readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<any, void, undefined> {
  const decoder = new TextDecoder();
  let partialLine = "";

  while (!signal?.aborted) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = (partialLine + chunk).split("\n");
    partialLine = lines.pop() || "";

    for (const line of lines) {
      if (signal?.aborted) return;
      if (!line.startsWith("data:")) continue;
      try {
        yield JSON.parse(line.slice(5).trim());
      } catch (e) {
        console.error("SSE parse error:", e, line);
      }
    }
  }

  if (!signal?.aborted && partialLine.startsWith("data:")) {
    try {
      yield JSON.parse(partialLine.slice(5).trim());
    } catch (e) {
      console.error("SSE final partial parse error:", e);
    }
  }
}
