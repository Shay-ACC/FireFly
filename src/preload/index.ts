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
  scanModel: () => ipcRenderer.invoke('model:scan')

  // ===== 后续阶段将在此扩展（agent / tts / memory）=====
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
