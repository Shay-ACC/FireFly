import { ipcMain, BrowserWindow, screen, app } from 'electron'
import { join, sep } from 'path'
import { existsSync, readdirSync, statSync } from 'fs'
import { chatStream, setLlmConfig, getLlmConfig, type ChatMessage } from './agent/llm'
import { synthesizeText } from './tts/edge-tts'
import {
  extractMemories,
  storeMemories,
  getMemoryCount,
  clearAllMemories,
  setEmbeddingConfig,
  hasEmbeddingKey
} from './memory/recall'

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

  /**
   * 口型同步（阶段 4）：chat 窗口播放音频时实时分析音量，
   * 通过此通道把「嘴型开合度 0~1」转发给 pet 窗口驱动 Live2D 嘴型。
   */
  ipcMain.on('pet:set-mouth-open', (_event, value: number) => {
    getWindows().pet?.webContents.send('pet:mouth-open', value)
  })

  /** 语音开始/结束信号（让 pet 窗口知道流萤开始/停止说话） */
  ipcMain.on('pet:speaking', (_event, speaking: boolean) => {
    getWindows().pet?.webContents.send('pet:speaking', speaking)
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
        const fullReply = await chatStream(messages, (delta) => {
          sender.send('agent:chat:delta', { requestId, delta })
        })
        sender.send('agent:chat:done', { requestId })

        // 异步提取并保存长期记忆（不阻塞对话流程）
        // 取最后一条 user 消息和流萤的完整回复
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')
        if (lastUser && fullReply && hasEmbeddingKey()) {
          extractAndStoreMemory(lastUser.content, fullReply).catch((err) => {
            console.warn('[Memory] 后台提取失败:', err)
          })
        }
      } catch (err: any) {
        sender.send('agent:chat:error', { requestId, message: err?.message || String(err) })
      }
    }
  )

  /** 提取记忆并存储（异步，失败不影响对话） */
  async function extractAndStoreMemory(userText: string, fireflyText: string): Promise<void> {
    const facts = await extractMemories(userText, fireflyText)
    if (facts.length === 0) {
      console.log('[Memory] 本轮无需记忆')
      return
    }
    console.log('[Memory] 提取出', facts.length, '条记忆:', facts)
    await storeMemories(facts)
    // 通知渲染进程记忆已更新（可选，用于记忆面板显示）
    getWindows().chat?.webContents.send('memory:updated', { count: getMemoryCount() })
  }

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

  // ===== 长期记忆管理（阶段 5）=====

  /** 查询记忆状态 */
  ipcMain.handle('memory:status', () => {
    return { count: getMemoryCount(), hasEmbeddingKey: hasEmbeddingKey() }
  })

  /** 设置 Embedding API Key（智谱） */
  ipcMain.handle('memory:set-embedding-key', (_event, apiKey: string) => {
    setEmbeddingConfig({ apiKey })
    return { hasEmbeddingKey: hasEmbeddingKey() }
  })

  /** 清空所有记忆 */
  ipcMain.handle('memory:clear', () => {
    clearAllMemories()
    return { count: getMemoryCount() }
  })

  // ===== TTS 语音合成（阶段 3）=====
  /**
   * 合成文本为语音。主进程按句切分，逐句合成 MP3 后推送回渲染进程。
   * 约定事件：'tts:audio'（一句的 base64 MP3）/ 'tts:done' / 'tts:error'
   */
  ipcMain.handle(
    'tts:synthesize',
    async (event, payload: { requestId: string; text: string; voice?: string }) => {
      const { requestId, text, voice } = payload
      const sender = event.sender
      try {
        await synthesizeText(text, voice, (idx, total) => {
          // 进度回调（可选，预留）
          void idx
          void total
        }).then((buffers) => {
          // 逐句推送
          for (const buf of buffers) {
            sender.send('tts:audio', {
              requestId,
              audio: 'data:audio/mp3;base64,' + buf.toString('base64')
            })
          }
          sender.send('tts:done', { requestId })
        })
      } catch (err: any) {
        sender.send('tts:error', { requestId, message: err?.message || String(err) })
      }
    }
  )

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
