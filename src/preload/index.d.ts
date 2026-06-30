import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    api: {
      setIgnoreMouse: (ignore: boolean) => void
      toggleChat: () => void
      showChat: () => void
      hideChat: () => void
      quit: () => void
      screenSize: () => Promise<{ width: number; height: number }>
    }
    electron: ElectronAPI
  }
}

export {}
