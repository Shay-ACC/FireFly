import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

/**
 * TTS 语音合成模块 —— 让流萤「开口说话」
 *
 * 使用 msedge-tts（微软 Edge 浏览器「大声朗读」API），免费、无需 API Key、中文音质好。
 *
 * 设计：
 * - 将流萤的回复按句切分，逐句合成 MP3 buffer（长文本分段播放体验更自然，
 *   也便于阶段 4 口型同步按句驱动）。
 * - 主进程合成 → 通过 IPC 把 MP3 的 base64 传给渲染进程 → <audio> 播放。
 */

/** 默认中文音色（流萤推荐：晓伊，活泼少女音） */
const DEFAULT_VOICE = process.env['TTS_VOICE'] || 'zh-CN-XiaoyiNeural'

/** 一次合成的最大字符数（edge-tts 单次合成上限约 3000，留余量） */
const MAX_CHARS = 500

/**
 * 将文本切分成适合 TTS 的小段。
 * 按句号/问号/感叹号/换行切，超长段落再按逗号/空格兜底。
 */
export function splitSentences(text: string): string[] {
  const cleaned = text.trim()
  if (!cleaned) return []

  // 第一轮：按句末标点 + 换行切
  const rough = cleaned
    .split(/(?<=[。！？!?\n])\s*/)
    .map((s) => s.trim())
    .filter(Boolean)

  // 第二轮：过长的段再按逗号切（避免单次合成过长）
  const result: string[] = []
  for (const seg of rough) {
    if (seg.length <= MAX_CHARS) {
      result.push(seg)
    } else {
      // 按逗号/分号切，累加到接近上限
      const parts = seg.split(/(?<=[，,；;])\s*/)
      let buf = ''
      for (const p of parts) {
        if ((buf + p).length > MAX_CHARS && buf) {
          result.push(buf.trim())
          buf = p
        } else {
          buf += p
        }
      }
      if (buf.trim()) result.push(buf.trim())
    }
  }
  return result
}

/**
 * 合成单段文本为 MP3 buffer。
 */
export async function synthesize(text: string, voice: string = DEFAULT_VOICE): Promise<Buffer> {
  const tts = new MsEdgeTTS()
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    const { audioStream } = tts.toStream(text)

    audioStream.on('data', (data: Buffer) => {
      chunks.push(Buffer.from(data))
    })

    audioStream.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    audioStream.on('close', () => {
      // 流关闭时若还没 resolve（某些版本不触发 end），用已收集数据兜底
      if (chunks.length > 0) {
        resolve(Buffer.concat(chunks))
      }
    })

    audioStream.on('error', (err: Error) => {
      reject(err)
    })
  })
}

/**
 * 合成完整文本（自动分句），返回每句的 MP3 buffer 列表。
 * 渲染进程按顺序播放即可实现「逐句朗读」。
 */
export async function synthesizeText(
  text: string,
  voice?: string,
  onProgress?: (index: number, total: number) => void
): Promise<Buffer[]> {
  const sentences = splitSentences(text)
  const results: Buffer[] = []
  for (let i = 0; i < sentences.length; i++) {
    onProgress?.(i, sentences.length)
    try {
      const buf = await synthesize(sentences[i], voice)
      results.push(buf)
    } catch (err) {
      console.error(`[TTS] 第 ${i + 1} 句合成失败:`, err)
      // 单句失败不阻断整体，跳过继续
    }
  }
  return results
}
