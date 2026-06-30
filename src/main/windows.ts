import { BrowserWindow, shell, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

/**
 * 浮动人物窗口（承载 Live2D 流萤）
 * 特点：透明 / 无边框 / 置顶 / 跳过任务栏
 */
export function createPetWindow(): BrowserWindow {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 360,
    height: 480,
    x: width - 380, // 默认靠右下角
    y: 80,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/pet')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'pet' })
  }

  return win
}

/**
 * 聊天窗口
 * 特点：无边框 / 可置顶 / 可隐藏（快捷键唤出）
 */
export function createChatWindow(petBounds?: Electron.Rectangle): BrowserWindow {
  const win = new BrowserWindow({
    width: 380,
    height: 540,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // 默认吸附在人物窗口左侧
  if (petBounds) {
    win.setPosition(petBounds.x - 390, petBounds.y)
  }

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/chat')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'chat' })
  }

  return win
}
