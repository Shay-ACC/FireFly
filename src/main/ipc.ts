import { ipcMain, BrowserWindow, screen } from 'electron'

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

  // ===== 占位：后续阶段实现的通道（此处仅声明，避免渲染进程调用时报错）=====
  // agent:chat        —— 阶段 2 实现（LLM 流式对话）
  // tts:synthesize    —— 阶段 3 实现（edge-tts 语音合成）
  // memory:recall     —— 阶段 5 实现（长期记忆检索）

  // 屏幕尺寸查询（渲染进程布局用）
  ipcMain.handle('screen:size', () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    return { width, height }
  })
}
