import OpenAI from 'openai'
import { PERSONA_PROMPT } from './persona'

/**
 * LLM 调用模块 —— 流萤的「大脑」
 *
 * 使用 OpenAI 兼容 SDK，可对接 DeepSeek / 智谱 / OpenAI 等任意兼容供应商。
 * 通过环境变量配置（.env），支持运行时切换 API Key。
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
 * @param messages 近期对话历史（不含 system prompt，本函数内部注入）
 * @param onDelta  每收到一段文本时的回调（用于打字机效果）
 * @returns 完整回复文本
 */
export async function chatStream(
  messages: ChatMessage[],
  onDelta: (text: string) => void
): Promise<string> {
  const client = getClient()
  const { model } = getLlmConfig()

  const completion = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: 'system', content: PERSONA_PROMPT },
      // 保留最近 20 轮，避免上下文过长
      ...messages.slice(-20)
    ],
    temperature: 0.8, // 略高温度，让流萤的回复更生动自然
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
}
