import { ElectronAPI } from '@electron-toolkit/preload'

/** LLM 配置返回类型 */
export interface LlmConfig {
  baseUrl: string
  model: string
  hasKey: boolean
}

declare global {
  interface Window {
    api: {
      // 窗口控制
      setIgnoreMouse: (ignore: boolean) => void
      toggleChat: () => void
      showChat: () => void
      hideChat: () => void
      quit: () => void
      screenSize: () => Promise<{ width: number; height: number }>
      scanModel: () => Promise<string | null>

      // Agent 大脑
      chat: (messages: { role: 'user' | 'assistant'; content: string }[]) => Promise<void>
      onChatDelta: (cb: (data: { requestId: string; delta: string }) => void) => () => void
      onChatDone: (cb: (data: { requestId: string }) => void) => () => void
      onChatError: (cb: (data: { requestId: string; message: string }) => void) => () => void
      getLlmConfig: () => Promise<LlmConfig>
      setLlmConfig: (cfg: { apiKey?: string; baseUrl?: string; model?: string }) => Promise<LlmConfig>
    }
    electron: ElectronAPI
  }
}

export {}
