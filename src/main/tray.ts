import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * 系统托盘模块（阶段 6）
 *
 * 提供常驻托盘图标 + 右键菜单：
 *   - 显示/隐藏流萤
 *   - 显示/隐藏聊天
 *   - 切换语音
 *   - 退出
 *
 * macOS 上左键点击托盘也会触发点击事件（可弹出菜单或切换聊天窗）。
 */

let tray: Tray | null = null

export function createTray(getWindows: () => {
  pet?: BrowserWindow
  chat?: BrowserWindow
}): Tray {
  // 加载托盘图标
  const iconCandidates = [
    join(app.getAppPath(), 'resources/tray-icon.png'),
    join(__dirname, '../../resources/tray-icon.png'),
    join(process.resourcesPath || '', 'tray-icon.png')
  ]
  let iconPath = ''
  for (const p of iconCandidates) {
    if (existsSync(p)) {
      iconPath = p
      break
    }
  }

  let image = nativeImage.createEmpty()
  if (iconPath) {
    image = nativeImage.createFromPath(iconPath)
    // macOS 托盘图标建议 16x16 或 22x22（模板图标）
    image.setTemplateImage(true)
  }

  tray = new Tray(image)
  tray.setToolTip('🌸 流萤陪伴')

  /** 刷新菜单（根据窗口状态动态显示） */
  const buildMenu = () => {
    const { pet, chat } = getWindows()
    const ttsEnabled = ttsStateCache
    return Menu.buildFromTemplate([
      {
        label: '显示流萤',
        click: () => pet?.show()
      },
      {
        label: '隐藏流萤',
        click: () => pet?.hide()
      },
      { type: 'separator' },
      {
        label: chat?.isVisible() ? '隐藏聊天' : '显示聊天',
        click: () => {
          if (!chat) return
          if (chat.isVisible()) chat.hide()
          else chat.show()
        }
      },
      {
        label: ttsEnabled ? '🔇 关闭语音' : '🔊 开启语音',
        click: () => {
          ttsStateCache = !ttsStateCache
          // 通知 chat 窗口切换语音状态
          chat?.webContents.send('tts:toggle', ttsStateCache)
          // 持久化
          try {
            const { saveSettings } = require('./settings')
            saveSettings({ ttsEnabled: ttsStateCache })
          } catch {}
          tray?.setContextMenu(buildMenu())
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          tray?.destroy()
          app.quit()
        }
      }
    ])
  }

  tray.setContextMenu(buildMenu())

  // macOS 左键点击：切换聊天窗
  tray.on('click', () => {
    const { chat } = getWindows()
    if (!chat) return
    if (chat.isVisible()) chat.hide()
    else chat.show()
  })

  return tray
}

/** TTS 状态缓存（托盘菜单切换用） */
let ttsStateCache = true

/** 更新 TTS 状态缓存（chat 窗口切换时同步） */
export function setTtsStateCache(enabled: boolean): void {
  ttsStateCache = enabled
}

/** 销毁托盘 */
export function destroyTray(): void {
  try {
    tray?.destroy()
  } catch {}
  tray = null
}
