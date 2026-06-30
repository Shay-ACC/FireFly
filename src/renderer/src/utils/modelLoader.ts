import { useApi } from '@/composables/useApi'

/**
 * 模型加载入口解析。
 *
 * 设计说明：
 * - Live2D 模型文件放在 src/renderer/public/model/<modelname>/ 下，
 *   打包后映射为根路径 /model/<modelname>/。
 * - 渲染进程无法直接读取本地文件系统（contextIsolation + 沙盒），
 *   因此通过 IPC 让主进程扫描 public/model 目录，找到 .model3.json 入口。
 * - 若扫描失败，回退到约定默认路径。
 */

const FALLBACK_ENTRIES = [
  '/model/firefly/FileReferences_Moc_0.model3.json',
  '/model/firefly.model3.json',
  '/model/index.model3.json'
]

export async function findModelEntry(): Promise<string> {
  const api = useApi()

  // 1. 主进程扫描模型目录
  try {
    const scanned = await api.scanModel()
    if (scanned && typeof scanned === 'string' && scanned.endsWith('.model3.json')) {
      return scanned
    }
  } catch {
    // 通道未实现，走回退
  }

  // 2. 回退：逐个探测约定路径
  for (const entry of FALLBACK_ENTRIES) {
    if (await exists(entry)) return entry
  }

  // 3. 都没找到——返回默认值，让 Live2DCanvas 显示错误提示
  return FALLBACK_ENTRIES[0]
}

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}
