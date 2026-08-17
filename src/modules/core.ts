// ═══════════════════════════════════════════════════════════════════════════
//  底层 Workflow 和 Chatflow
// ═══════════════════════════════════════════════════════════════════════════

import type { DifyClientConfig, ProgressEvent } from '../types'
import { request } from '../http'
import { readSSEStream } from '../stream'
import { toast } from 'sonner'

export interface WorkflowModule {
  run<T = any>(options: {
    token?: string
    inputs: Record<string, any>
    user?: string
  }): Promise<T>
}

export interface ChatflowModule {
  stream(
    body: {
      token?: string
      inputs: Record<string, any>
      query: string
      user: string
    },
    options: {
      signal?: AbortSignal
      onText: (text: string) => void
      onConversationId?: (id: string) => void
      onFinal?: () => void
      onError?: (error: string) => void
      onProgress?: (event: ProgressEvent) => void
      onCredits?: (credits: number) => void
    }
  ): Promise<void>
}

export function createWorkflowModule(config: DifyClientConfig): WorkflowModule {
  const { baseUrl } = config

  return {
    async run({ token, inputs, user = 'anonymous' }) {
      if (!token) throw new Error('未提供 token')

      const result = await request(baseUrl!, token, '/workflows/run', {
        inputs,
        user,
        response_mode: 'blocking',
      })

      if (result.data?.status === 'succeeded') {
        return result.data.outputs
      }

      throw new Error(result.data?.error || '工作流执行失败')
    },
  }
}

export function createChatflowModule(config: DifyClientConfig): ChatflowModule {
  const { baseUrl } = config

  return {
    async stream(body, options) {
      const { token, ...rest } = body
      if (!token) throw new Error('未提供 token')

      const { signal: externalSignal, ...callbacks } = options
      const internalController = externalSignal ? null : new AbortController()
      const signal = externalSignal || internalController!.signal
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

      try {
        const chatUrl = `${baseUrl}/chat-messages`

        const response = await fetch(chatUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...rest, response_mode: 'streaming' }),
          signal,
        })

        if (response.status === 504) throw new Error('请求服务器超时，请稍后重试')
        if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)

        reader = response.body?.getReader() ?? null
        if (!reader) throw new Error('无法读取响应流')

        for await (const data of readSSEStream(reader, signal)) {
          if (data.conversation_id) {
            callbacks.onConversationId?.(data.conversation_id)
          }

          if (data.event === 'message') {
            callbacks.onText(data.answer || '')
          } else if (data.event === 'error') {
            const msg = data.message || '生成失败'
            toast.error(msg)
            callbacks.onError?.(msg)
          } else if (data.event === 'workflow_finished') {
            const errorMsg = data.data?.error || ''

            if (errorMsg.includes('免费额度已结束')) {
              toast.error('AI 免费额度已耗尽，请更换模型后重试！')
              return
            }

            if (data.data?.status === 'failed') {
              const isPluginError =
                errorMsg.includes('not found') || errorMsg.includes('iterator variable')
              const displayMsg = isPluginError
                ? 'Dify 内部插件错误，请重新生成，本次不消耗 Token'
                : '解析任务遇到一点问题，请重试'
              toast.error(displayMsg)
              callbacks.onError?.(displayMsg)
              return
            }

            // credits 提取
            const finalAnswer = data.data?.outputs?.answer || ''
            const creditsMatch = finalAnswer.match(/credits[：:]\s*(\d+)/)
            if (creditsMatch) {
              callbacks.onCredits?.(Number(creditsMatch[1]))
            }

            callbacks.onFinal?.()
          } else if (data.event === 'node_started') {
            callbacks.onProgress?.({ type: 'node_started', title: data.data?.title })
          } else if (data.event === 'iteration_next') {
            callbacks.onProgress?.({ type: 'iteration_next' })
          } else if (data.event === 'iteration_completed') {
            callbacks.onProgress?.({ type: 'iteration_completed' })
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('SSE Stream safely aborted by the controller.')
        } else {
          const msg = err.message || '连接失败'
          toast.error(msg)
          callbacks.onError?.(msg)
        }
      } finally {
        if (reader) {
          reader.cancel().catch((e) => console.warn('reader cancel failed:', e))
        }
        if (internalController && !internalController.signal.aborted) {
          internalController.abort()
        }
      }
    },
  }
}
