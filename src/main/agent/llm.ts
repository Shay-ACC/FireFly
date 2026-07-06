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
  const client = getClient()
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

  const completion = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: 'system', content: systemContent },
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
