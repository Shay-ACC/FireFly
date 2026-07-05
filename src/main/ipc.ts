import { ipcMain, BrowserWindow, screen, app } from 'electron'
import { join, sep } from 'path'
import { existsSync, readdirSync, statSync } from 'fs'
import { chatStream, setLlmConfig, getLlmConfig, type ChatMessage } from './agent/llm'

/**
 * 注册所有 IPC 通道
 * 阶段 0 仅包含窗口交互相关通道；后续 Agent/TTS/Memory 通道在各阶段陆续加入。
 */
export function registerIpc(getWindows: () => {
  pet?: BrowserWindow
  chat?: BrowserWindow
}): void {
  // ===== 窗口控制 =====

  // 切换点击穿透（人物透明区域放行鼠标，仅人物本身可交互）
  ipcMain.on('pet:set-ignore-mouse', (_event, ignore: boolean) => {
    getWindows().pet?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  // 唤出/隐藏聊天窗口
  ipcMain.on('chat:toggle', () => {
    const chat = getWindows().chat
    if (!chat) return
    if (chat.isVisible()) chat.hide()
    else chat.show()
  })

  ipcMain.on('chat:show', () => getWindows().chat?.show())
  ipcMain.on('chat:hide', () => getWindows().chat?.hide())

  // 关闭整个应用
  ipcMain.on('app:quit', () => {
    process.exit(0)
  })

  // ===== Agent 大脑（阶段 2）=====

  /**
   * 流式对话。渲染进程发来对话历史，主进程调 LLM 流式返回。
   * 用 webContents.send 把每个 token 增量推回渲染进程（打字机效果）。
   *
   * 约定事件名 'agent:chat:delta' / 'agent:chat:done' / 'agent:chat:error'。
   */
  ipcMain.handle(
    'agent:chat',
    async (event, payload: { requestId: string; messages: ChatMessage[] }) => {
      const { requestId, messages } = payload
      const sender = event.sender
      try {
        await chatStream(messages, (delta) => {
          sender.send('agent:chat:delta', { requestId, delta })
        })
        sender.send('agent:chat:done', { requestId })
      } catch (err: any) {
        sender.send('agent:chat:error', { requestId, message: err?.message || String(err) })
      }
    }
  )

  /** 读取/保存 LLM 配置（API Key 等）。Key 仅存在内存，重启需重填或写入 .env */
  ipcMain.handle('agent:get-config', () => {
    const cfg = getLlmConfig()
    return { baseUrl: cfg.baseUrl, model: cfg.model, hasKey: !!cfg.apiKey }
  })

  ipcMain.handle('agent:set-config', (_event, cfg: { apiKey?: string; baseUrl?: string; model?: string }) => {
    setLlmConfig(cfg)
    const after = getLlmConfig()
    return { baseUrl: after.baseUrl, model: after.model, hasKey: !!after.apiKey }
  })

  // ===== 占位：后续阶段实现的通道 =====
  // tts:synthesize    —— 阶段 3 实现（edge-tts 语音合成）
  // memory:recall     —— 阶段 5 实现（长期记忆检索）

  // 屏幕尺寸查询（渲染进程布局用）
  ipcMain.handle('screen:size', () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    return { width, height }
  })

  /**
   * 扫描模型目录，返回 .model3.json 的可访问 URL。
   *
   * 模型约定放在 src/renderer/public/model/<name>/ 下，
   * 开发期映射到 renderer 进程根，打包后映射到 /model/。
   *
   * 这里递归查找第一个 .model3.json，返回形如 "/model/<name>/xxx.model3.json" 的路径。
   */
  ipcMain.handle('model:scan', () => {
    // public 目录在不同环境下位置不同，分别尝试
    const candidates = [
      // 开发期：electron-vite 的 public 目录就在 src/renderer/public
      join(app.getAppPath(), 'src/renderer/public/model'),
      // 开发期 out 目录
      join(__dirname, '../renderer/model'),
      // 打包后 asar 内
      join(process.resourcesPath || '', 'model')
    ]

    for (const modelRoot of candidates) {
      if (!existsSync(modelRoot)) continue
      const entry = findModel3Json(modelRoot)
      if (entry) return entry
    }
    return null
  })

  /**
   * 递归查找 .model3.json 文件，返回相对于 public 根的可访问路径。
   */
  function findModel3Json(dir: string, depth = 0): string | null {
    if (depth > 3) return null
    let entries: string[] = []
    try {
      entries = readdirSync(dir)
    } catch {
      return null
    }
    for (const name of entries) {
      const full = join(dir, name)
      if (name.endsWith('.model3.json')) {
        // 转成 URL 路径：保留 model/ 之后的相对部分
        const idx = full.split(sep).indexOf('model')
        if (idx >= 0) {
          return '/' + full.split(sep).slice(idx).join('/')
        }
        return null
      }
    }
    // 没找到则进入子目录
    for (const name of entries) {
      if (name.startsWith('.')) continue
      const full = join(dir, name)
      try {
        if (statSync(full).isDirectory()) {
          const found = findModel3Json(full, depth + 1)
          if (found) return found
        }
      } catch {
        // 不是目录或无权限，跳过
      }
    }
    return null
  }
}
