import { ref, onBeforeUnmount } from 'vue'

/**
 * 口型同步核心 —— Web Audio API 实时分析音频音量
 *
 * 原理：
 *   <audio> 元素 → MediaElementSource → AnalyserNode → 每帧取波形 → 计算 RMS 音量
 *   → 平滑滤波 → 输出 0~1 的「嘴型开合度」
 *
 * 使用：
 *   const lip = useLipSync()
 *   lip.attach(audioEl)              // 把某个 audio 元素接入分析
 *   // lip.mouthOpen.value 即实时开合度（0~1）
 *   lip.detach()                     // 解除
 */
export function useLipSync() {
  /** 嘴型开合度 0~1，供 Live2D 读取 */
  const mouthOpen = ref(0)
  const isActive = ref(false)

  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let source: MediaElementAudioSourceNode | null = null
  let timeData: Uint8Array<ArrayBuffer> | null = null

  // 调参：放大系数、平滑系数、静音阈值
  const GAIN = 4 // TTS 音量偏小，需放大（建议 2~6）
  const SMOOTH = 0.7 // 当前帧权重越大越跟手但越抖（建议 0.6~0.85）
  const SILENCE = 0.02 // 低于此值视为静音，闭嘴
  let smoothed = 0

  /** 每帧分析循环（用 setInterval 而非 RAF，避免窗口失焦时被节流） */
  let intervalId: ReturnType<typeof setInterval> | null = null
  function loop() {
    if (!analyser || !timeData) return
    analyser.getByteTimeDomainData(timeData)

    // 计算 RMS（均方根）音量
    let sum = 0
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128 // 归一化 -1~1
      sum += v * v
    }
    let rms = Math.sqrt(sum / timeData.length) // 0~1

    // 放大 + 截断
    rms = Math.min(1, rms * GAIN)
    // 静音阈值
    if (rms < SILENCE) rms = 0
    // 平滑滤波（指数移动平均）
    smoothed = rms * SMOOTH + smoothed * (1 - SMOOTH)

    mouthOpen.value = smoothed
  }

  /**
   * 把一个 <audio> 元素接入分析链路。
   *
   * 关键点：
   * 1. AudioContext 受浏览器自动播放策略限制，创建后可能处于 suspended，
   *    必须在用户手势（点发送）后的调用栈里 resume，否则音量数据为空。
   * 2. 每个 audio 元素只能 createMediaElementSource 一次（重复会报错）。
   *    因此每次播放都新建 audio 元素，并缓存已接入的元素避免重复接入。
   */
  const attachedElements = new WeakSet<HTMLAudioElement>()

  /** 启动定时分析循环（~30fps，setInterval 不受窗口失焦节流影响） */
  function startLoop() {
    if (intervalId !== null) return
    intervalId = setInterval(loop, 33)
  }

  function attach(audioEl: HTMLAudioElement) {
    ensureContext()
    if (!audioCtx || !analyser) return

    // 关键：resume AudioContext（解除 suspended 状态）
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }

    // 已接入过的元素不重复接入（createMediaElementSource 重复会报错）
    if (attachedElements.has(audioEl)) {
      isActive.value = true
      startLoop()
      return
    }

    try {
      source = audioCtx.createMediaElementSource(audioEl)
      source.connect(analyser)
      analyser.connect(audioCtx.destination)
      attachedElements.add(audioEl)
    } catch (err) {
      console.warn('[lipSync] attach 失败:', err)
    }

    isActive.value = true
    startLoop()
  }

  /** 仅断开 source（保留 context/analyser 供下次复用） */
  function detachSource() {
    try {
      source?.disconnect()
    } catch {}
    source = null
  }

  /** 完全停止分析 */
  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    detachSource()
    isActive.value = false
    smoothed = 0
    mouthOpen.value = 0
  }

  /** 懒初始化 AudioContext */
  function ensureContext() {
    if (audioCtx) return
    try {
      audioCtx = new AudioContext()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.6
      timeData = new Uint8Array(analyser.fftSize)
    } catch (err) {
      console.error('[lipSync] AudioContext 创建失败:', err)
    }
  }

  /** 主动 resume AudioContext（可在用户点击时提前调用，解锁音频） */
  function unlock() {
    ensureContext()
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
  }

  onBeforeUnmount(() => {
    stop()
    try {
      audioCtx?.close()
    } catch {}
    audioCtx = null
    analyser = null
  })

  return { mouthOpen, isActive, attach, detachSource, stop, unlock }
}
