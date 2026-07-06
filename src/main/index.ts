import { app, shell, globalShortcut, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createPetWindow, createChatWindow } from './windows'
import { registerIpc } from './ipc'
import { initMemoryStore, closeMemoryStore } from './memory/recall'

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

  // 开发者工具默认快捷键优化（F12），并禁止在 vue 路由跳转时打开新窗口
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 创建窗口
  petWindow = createPetWindow()
  chatWindow = createChatWindow(petWindow.getBounds())

  // 注册 IPC
  registerIpc(() => ({ pet: petWindow, chat: chatWindow }))

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

app.on('window-all-closed', () => {
  petWindow = undefined
  chatWindow = undefined
  if (process.platform !== 'darwin') app.quit()
})

// 应用退出时注销快捷键 + 关闭记忆库
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  closeMemoryStore()
})

// 屏蔽本地资源外部链接（安全）
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})
