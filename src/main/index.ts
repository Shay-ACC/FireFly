import { app, shell, globalShortcut, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createPetWindow, createChatWindow } from './windows'
import { registerIpc } from './ipc'
import { initMemoryStore, closeMemoryStore } from './memory/recall'
import { loadSettings } from './settings'
import { setLlmConfig } from './agent/llm'
import { setEmbeddingConfig } from './memory/recall'
import { createTray, destroyTray, setTtsStateCache } from './tray'

// 加载 .env 环境变量（必须在其他模块使用 process.env 之前）
import 'dotenv/config'

// 全局窗口引用，避免被垃圾回收
let petWindow: BrowserWindow | undefined
let chatWindow: BrowserWindow | undefined

app.whenReady().then(() => {
  // 设置应用元信息
  electronApp.setAppUserModelId('com.firefly.companion')

  // 初始化长期记忆库（SQLite）
  initMemoryStore()

  // 恢复持久化设置：把本地保存的 API Key 应用到运行时
  const saved = loadSettings()
  if (saved.llmApiKey || saved.llmBaseUrl || saved.llmModel) {
    setLlmConfig({
      apiKey: saved.llmApiKey,
      baseUrl: saved.llmBaseUrl,
      model: saved.llmModel
    })
  }
  if (saved.embeddingApiKey) {
    setEmbeddingConfig({ apiKey: saved.embeddingApiKey })
  }
  setTtsStateCache(saved.ttsEnabled ?? true)

  // 开发者工具默认快捷键优化（F12），并禁止在 vue 路由跳转时打开新窗口
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 创建窗口
  petWindow = createPetWindow()
  chatWindow = createChatWindow(petWindow.getBounds())

  // 注册 IPC
  registerIpc(() => ({ pet: petWindow, chat: chatWindow }))

  // 创建系统托盘
  createTray(() => ({ pet: petWindow, chat: chatWindow }))

  // 全局快捷键：Cmd/Ctrl+Shift+F 唤出/隐藏聊天窗
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (!chatWindow) return
    if (chatWindow.isVisible()) chatWindow.hide()
    else chatWindow.show()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      petWindow = createPetWindow()
      chatWindow = createChatWindow(petWindow.getBounds())
    }
  })
})

// 关闭所有窗口时不退出应用（保持托盘常驻），macOS 行为本就如此
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Windows/Linux：不退出，留在托盘；通过托盘菜单的「退出」真正退出
    // 若想直接退出，取消下面注释
    // app.quit()
  }
})

// 应用退出时注销快捷键 + 关闭记忆库 + 销毁托盘
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  closeMemoryStore()
  destroyTray()
})

// 屏蔽本地资源外部链接（安全）
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})
