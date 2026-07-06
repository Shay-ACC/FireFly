import OpenAI from 'openai'
import {
  initMemoryStore,
  saveMemory,
  searchMemories,
  clearAllMemories,
  getMemoryCount,
  closeMemoryStore,
  type MemoryRecord
} from './store'

/**
 * 记忆提取与召回模块 —— 让流萤「记住你」
 *
 * 流程：
 *   1. 用户发消息时：把消息向量化 → 语义检索 Top-K 相关记忆 → 注入 system prompt
 *   2. 流萤回复后：让 LLM 提取「该记住的关键事实」→ 向量化 → 存入记忆库
 *
 * Embedding 用智谱 GLM 的 embedding-3（OpenAI 兼容接口，免费额度）。
 */

/** 智谱 Embedding 配置（独立于对话 LLM，因为 DeepSeek 无 embedding） */
const EMBEDDING_API_BASE =
  process.env['EMBEDDING_API_BASE'] || 'https://open.bigmodel.cn/api/paas/v4'
const EMBEDDING_API_KEY = process.env['ZHIPU_API_KEY'] || process.env['EMBEDDING_API_KEY'] || ''
const EMBEDDING_MODEL = process.env['EMBEDDING_MODEL'] || 'embedding-3'

/** 运行时覆盖（设置面板可改） */
let runtimeEmbeddingKey: string | null = null

export function setEmbeddingConfig(cfg: { apiKey?: string }): void {
  if (cfg.apiKey !== undefined) runtimeEmbeddingKey = cfg.apiKey || null
}

function getEmbeddingKey(): string {
  return runtimeEmbeddingKey || EMBEDDING_API_KEY
}

export function hasEmbeddingKey(): boolean {
  return !!getEmbeddingKey()
}

let embeddingClient: OpenAI | null = null
function getEmbeddingClient(): OpenAI {
  if (!embeddingClient) {
    embeddingClient = new OpenAI({
      apiKey: getEmbeddingKey(),
      baseURL: EMBEDDING_API_BASE
    })
  }
  return embeddingClient
}

/**
 * 把文本转向量。
 */
export async function embedText(text: string): Promise<number[]> {
  if (!getEmbeddingKey()) {
    throw new Error('未配置 Embedding API Key（智谱 ZHIPU_API_KEY）')
  }
  const client = getEmbeddingClient()
  const resp = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text
  })
  const vec = resp.data?.[0]?.embedding
  if (!vec || !Array.isArray(vec)) {
    throw new Error('Embedding 返回为空')
  }
  return vec as number[]
}

/**
 * 记忆提取：让 LLM 从一轮对话中提取「该长期记住的关键事实」。
 * 返回的事实数组；若无值得记住的内容，返回空数组。
 *
 * 用对话用的同一个 client（DeepSeek），因为这是普通 chat 能力，不需要 embedding。
 */
import { getLlmClient } from '../agent/llm'

export async function extractMemories(
  userText: string,
  fireflyText: string
): Promise<string[]> {
  const client = getLlmClient()
  const prompt = `你是一个记忆提取器。从下面的对话中，提取出「值得流萤长期记住的、关于开拓者（用户）的关键事实」。

规则：
1. 只提取具体、稳定的事实（如姓名、喜好、职业、重要经历、性格特点、关系信息等）。
2. 忽略寒暄、临时情绪、无关紧要的细节。
3. 每条事实用一句简短的话描述，主语用「开拓者」。
4. 如果没有值得记住的内容，返回空数组 []。
5. 严格只输出 JSON 数组，不要任何解释文字。

对话内容：
开拓者说：${userText}
流萤回复：${fireflyText}

输出示例：
["开拓者是一名程序员", "开拓者喜欢猫"]
或
[]`

  try {
    const completion = await client.chat.completions.create({
      model: process.env['LLM_MODEL'] || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300
    })
    const text = completion.choices?.[0]?.message?.content?.trim() || '[]'
    // 提取 JSON 数组（容错：模型可能包裹 ```json）
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    const facts = JSON.parse(match[0])
    if (!Array.isArray(facts)) return []
    return facts.filter((f) => typeof f === 'string' && f.trim()).map((f: string) => f.trim())
  } catch (err) {
    console.error('[Memory] 提取记忆失败:', err)
    return []
  }
}

/**
 * 保存提取出的记忆（批量向量化存储）。
 */
export async function storeMemories(facts: string[]): Promise<void> {
  for (const fact of facts) {
    try {
      const emb = await embedText(fact)
      saveMemory(fact, emb)
    } catch (err) {
      console.error('[Memory] 存储失败:', fact, err)
    }
  }
}

/**
 * 召回相关记忆：把用户输入向量化，检索 Top-K 最相关记忆。
 */
export async function recallMemories(userInput: string, topK = 5): Promise<MemoryRecord[]> {
  try {
    const queryEmb = await embedText(userInput)
    return searchMemories(queryEmb, topK)
  } catch (err) {
    console.error('[Memory] 召回失败:', err)
    return []
  }
}

/**
 * 把召回的记忆格式化为可注入 system prompt 的文本。
 */
export function formatMemoriesForPrompt(memories: MemoryRecord[]): string {
  if (memories.length === 0) return ''
  const lines = memories.map((m) => `- ${m.content}`).join('\n')
  return `\n\n# 你记得的关于开拓者的事\n（这些是你长久以来记住的，可以在合适的时候自然地提及，但不要生硬罗列）\n${lines}`
}

// 重导出存储操作，便于集中调用
export {
  initMemoryStore,
  clearAllMemories,
  getMemoryCount,
  closeMemoryStore,
  type MemoryRecord
}
