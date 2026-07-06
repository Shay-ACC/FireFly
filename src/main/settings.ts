import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

/**
 * 设置持久化模块
 *
 * 把用户的运行时配置（API Key、窗口位置、语音开关等）存到本地 JSON 文件，
 * 重启后自动恢复。
 *
 * 文件位置：{userData}/settings.json
 * 注意：敏感信息（API Key）也存这里，该文件不应入库（已在 .gitignore 的 userData 外）。
 */

export interface AppSettings {
  /** LLM 对话配置 */
  llmApiKey?: string
  llmBaseUrl?: string
  llmModel?: string
  /** Embedding 记忆配置 */
  embeddingApiKey?: string
  /** TTS 语音配置 */
  ttsEnabled?: boolean
  ttsVoice?: string
  /** 窗口位置（pet 窗口） */
  petWindowX?: number
  petWindowY?: number
  /** 聊天窗口位置 */
  chatWindowX?: number
  chatWindowY?: number
}

const DEFAULT_SETTINGS: AppSettings = {
  ttsEnabled: true,
  ttsVoice: 'zh-CN-XiaoyiNeural'
}

let cache: AppSettings | null = null

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** 加载设置（启动时调用） */
export function loadSettings(): AppSettings {
  if (cache) return cache
  const path = getSettingsPath()
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf8')
      cache = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    } else {
      cache = { ...DEFAULT_SETTINGS }
    }
  } catch (err) {
    console.warn('[Settings] 加载失败，使用默认值:', err)
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache!
}

/** 保存设置（修改后调用） */
export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  if (!cache) cache = loadSettings()
  cache = { ...cache, ...patch }
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(getSettingsPath(), JSON.stringify(cache, null, 2), 'utf8')
  } catch (err) {
    console.error('[Settings] 保存失败:', err)
  }
  return cache
}

/** 获取当前设置 */
export function getSettings(): AppSettings {
  if (!cache) return loadSettings()
  return cache
}
