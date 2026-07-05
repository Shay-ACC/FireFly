import { contextBridge, ipcRenderer } from 'electron'

/**
 * 暴露给渲染进程的安全 API。
 * 渲染进程通过 window.api 调用，无法直接访问 Node/Electron 内部能力。
 */
const api = {
  /** 设置/取消人物窗口点击穿透 */
  setIgnoreMouse: (ignore: boolean) => ipcRenderer.send('pet:set-ignore-mouse', ignore),

  /** 聊天窗口显隐 */
  toggleChat: () => ipcRenderer.send('chat:toggle'),
  showChat: () => ipcRenderer.send('chat:show'),
  hideChat: () => ipcRenderer.send('chat:hide'),

  /** 退出应用 */
  quit: () => ipcRenderer.send('app:quit'),

  /** 查询屏幕工作区尺寸 */
  screenSize: () => ipcRenderer.invoke('screen:size'),

  /** 扫描模型目录，返回 .model3.json 的可访问路径（找不到返回 null） */
  scanModel: () => ipcRenderer.invoke('model:scan'),

  // ===== Agent 大脑（阶段 2）=====
  /** 发起流式对话，返回 requestId；实际内容通过 onChatDelta/onChatDone/onChatError 回调推送 */
  chat: (messages: { role: 'user' | 'assistant'; content: string }[]) =>
    ipcRenderer.invoke('agent:chat', {
      requestId: String(Math.random().toString(36).slice(2)),
      messages
    }),
  /** 监听对话增量（打字机效果） */
  onChatDelta: (cb: (data: { requestId: string; delta: string }) => void) => {
    const handler = (_e: unknown, data: { requestId: string; delta: string }) => cb(data)
    ipcRenderer.on('agent:chat:delta', handler as any)
    return () => ipcRenderer.removeListener('agent:chat:delta', handler as any)
  },
  onChatDone: (cb: (data: { requestId: string }) => void) => {
    const handler = (_e: unknown, data: { requestId: string }) => cb(data)
    ipcRenderer.on('agent:chat:done', handler as any)
    return () => ipcRenderer.removeListener('agent:chat:done', handler as any)
  },
  onChatError: (cb: (data: { requestId: string; message: string }) => void) => {
    const handler = (_e: unknown, data: { requestId: string; message: string }) => cb(data)
    ipcRenderer.on('agent:chat:error', handler as any)
    return () => ipcRenderer.removeListener('agent:chat:error', handler as any)
  },
  /** LLM 配置（API Key / baseUrl / model） */
  getLlmConfig: () =>
    ipcRenderer.invoke('agent:get-config') as Promise<{
      baseUrl: string
      model: string
      hasKey: boolean
    }>,
  setLlmConfig: (cfg: { apiKey?: string; baseUrl?: string; model?: string }) =>
    ipcRenderer.invoke('agent:set-config', cfg) as Promise<{
      baseUrl: string
      model: string
      hasKey: boolean
    }>,

  // ===== TTS 语音合成（阶段 3）=====
  /** 合成文本为语音，结果通过 onTtsAudio/onTtsDone/onTtsError 回调推送 */
  synthesize: (text: string, voice?: string) =>
    ipcRenderer.invoke('tts:synthesize', {
      requestId: String(Math.random().toString(36).slice(2)),
      text,
      voice
    }),
  onTtsAudio: (cb: (data: { requestId: string; audio: string }) => void) => {
    const handler = (_e: unknown, data: { requestId: string; audio: string }) => cb(data)
    ipcRenderer.on('tts:audio', handler as any)
    return () => ipcRenderer.removeListener('tts:audio', handler as any)
  },
  onTtsDone: (cb: (data: { requestId: string }) => void) => {
    const handler = (_e: unknown, data: { requestId: string }) => cb(data)
    ipcRenderer.on('tts:done', handler as any)
    return () => ipcRenderer.removeListener('tts:done', handler as any)
  },
  onTtsError: (cb: (data: { requestId: string; message: string }) => void) => {
    const handler = (_e: unknown, data: { requestId: string; message: string }) => cb(data)
    ipcRenderer.on('tts:error', handler as any)
    return () => ipcRenderer.removeListener('tts:error', handler as any)
  }
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (非 contextIsolation 场景的降级，本项目默认开启 contextIsolation)
  window.api = api
}
