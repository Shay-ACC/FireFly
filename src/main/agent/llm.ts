import OpenAI from 'openai'
import { PERSONA_PROMPT } from './persona'
import { recallMemories, formatMemoriesForPrompt } from '../memory/recall'

/**
 * LLM 调用模块 —— 流萤的「大脑」
 *
 * 使用 OpenAI 兼容 SDK，可对接 DeepSeek / 智谱 / OpenAI 等任意兼容供应商。
 * 通过环境变量配置（.env），支持运行时切换 API Key。
 *
 * 集成长期记忆（阶段 5）：
 *   - 请求前：召回相关记忆，注入 system prompt
 *   - 回复后：调用方可触发记忆提取（见 memory/recall.ts）
 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** 从环境变量读取配置，并提供运行时覆盖（设置面板修改的 Key 优先） */
let runtimeApiKey: string | null = null
let runtimeBaseUrl: string | null = null
let runtimeModel: string | null = null

export function setLlmConfig(cfg: { apiKey?: string; baseUrl?: string; model?: string }): void {
  if (cfg.apiKey !== undefined) runtimeApiKey = cfg.apiKey || null
  if (cfg.baseUrl !== undefined) runtimeBaseUrl = cfg.baseUrl || null
  if (cfg.model !== undefined) runtimeModel = cfg.model || null
}

export function getLlmConfig() {
  return {
    apiKey: runtimeApiKey || process.env['DEEPSEEK_API_KEY'] || process.env['LLM_API_KEY'] || '',
    baseUrl:
      runtimeBaseUrl ||
      process.env['LLM_API_BASE'] ||
      'https://api.deepseek.com/v1',
    model: runtimeModel || process.env['LLM_MODEL'] || 'deepseek-chat'
  }
}

/** 获取 LLM 客户端（记忆提取等模块复用） */
export function getLlmClient(): OpenAI {
  return getClient()
}

function getClient(): OpenAI {
  const { apiKey, baseUrl } = getLlmConfig()
  if (!apiKey) {
    throw new Error('未配置 API Key，请在设置中填写，或在 .env 中配置 DEEPSEEK_API_KEY')
  }
  return new OpenAI({ apiKey, baseURL: baseUrl })
}

/**
 * 流式对话：逐 token 返回流萤的回复。
 *
 * 集成记忆：自动召回与用户最新消息相关的长期记忆，注入 system prompt。
 *
 * @param messages 近期对话历史（不含 system prompt，本函数内部注入）
 * @param onDelta  每收到一段文本时的回调（用于打字机效果）
 * @returns 完整回复文本
 */
export async function chatStream(
  messages: ChatMessage[],
  onDelta: (text: string) => void
): Promise<string> {
  const { model } = getLlmConfig()

  // 召回相关记忆（基于用户最后一条消息）
  let memoryContext = ''
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  if (lastUserMsg) {
    try {
      const memories = await recallMemories(lastUserMsg.content, 5)
      memoryContext = formatMemoriesForPrompt(memories)
      if (memories.length > 0) {
        console.log('[LLM] 召回记忆', memories.length, '条')
      }
    } catch (err) {
      // 记忆召回失败不阻断对话
      console.warn('[LLM] 记忆召回失败:', err)
    }
  }

  const systemContent = PERSONA_PROMPT + memoryContext

  // 带重试的流式调用（网络波动/API 限流时自动重试）
  const MAX_RETRIES = 2
  let lastErr: any
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = getClient() // 每次重试重新获取（key 可能中途被设置）
      const completion = await client.chat.completions.create({
        model,
        stream: true,
        messages: [
          { role: 'system', content: systemContent },
          ...messages.slice(-20)
        ],
        temperature: 0.8,
        max_tokens: 600
      })

      let full = ''
      for await (const chunk of completion) {
        const delta = chunk.choices?.[0]?.delta?.content || ''
        if (delta) {
          full += delta
          onDelta(delta)
        }
      }
      return full
    } catch (err: any) {
      lastErr = err
      // 4xx 错误（除 429 外）不重试（如 401 鉴权失败）
      const status = err?.status || err?.response?.status
      if (status && status >= 400 && status < 500 && status !== 429) break
      // 最后一次不再等待
      if (attempt < MAX_RETRIES) {
        console.warn(`[LLM] 第 ${attempt + 1} 次失败，${1}s 后重试:`, err?.message)
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }
  // 全部重试失败，抛出友好错误
  throw friendlyError(lastErr)
}

/**
 * 把底层 API 错误转成用户友好的提示。
 */
function friendlyError(err: any): Error {
  const status = err?.status || err?.response?.status
  const msg: string = err?.message || String(err)
  if (status === 401) return new Error('API Key 无效或已过期，请检查设置')
  if (status === 429) return new Error('请求太频繁或余额不足，请稍后再试或检查账户额度')
  if (status >= 500) return new Error('服务器繁忙，请稍后再试')
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('ECONN')) {
    return new Error('网络连接失败，请检查网络')
  }
  return new Error(msg)
}
