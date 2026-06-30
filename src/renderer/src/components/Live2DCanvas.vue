<template>
  <div ref="containerEl" class="live2d-container">
    <!-- 加载/错误提示 -->
    <div v-if="status !== 'ready'" class="status-overlay">
      <template v-if="status === 'loading'">
        <div class="firefly-spinner"></div>
        <p>流萤正在苏醒…</p>
      </template>
      <template v-else-if="status === 'error'">
        <p class="error-msg">⚠️ {{ errorMsg }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import * as PIXI from 'pixi.js'
// 原版 pixi-live2d-display 的 Cubism 4 专用入口（仅支持 Cubism 3/4，体积更小）
import { Live2DModel } from 'pixi-live2d-display/cubism4'

/**
 * 关键：将 PIXI 暴露到 window。
 * pixi-live2d-display 需要通过 window.PIXI.Ticker 自动驱动模型更新，
 * 否则模型不会动（Pixi v6 同样需要这一步）。
 */
;(globalThis as any).PIXI = PIXI

const props = defineProps<{
  modelPath: string
}>()

const emit = defineEmits<{
  (e: 'ready', model: any): void
  (e: 'error', message: string): void
}>()

const containerEl = ref<HTMLElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMsg = ref('')

const appRef = shallowRef<PIXI.Application | null>(null)
const modelRef = shallowRef<any>(null)

onMounted(async () => {
  try {
    const hasCore = typeof (globalThis as any).Live2DCubismCore !== 'undefined'
    if (!hasCore) {
      throw new Error('Live2DCubismCore 未加载（cubism core 脚本加载失败）')
    }

    // 1. 创建 Pixi v6 应用（同步构造，透明背景）
    const app = new PIXI.Application({
      view: undefined as any,
      width: containerEl.value!.clientWidth,
      height: containerEl.value!.clientHeight,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      transparent: true
    })
    appRef.value = app
    containerEl.value!.appendChild(app.view)

    // 2. 加载 Live2D 模型
    const model = await Live2DModel.from(props.modelPath)
    modelRef.value = model
    app.stage.addChild(model)

    // 3. 缩放居中
    fitModel()

    // 4. 内置自动交互：眼神跟随鼠标、点击触发动作（pixi-live2d-display 开箱即用）
    // 5. 待机动作 + 定时切换
    playIdleMotion()
    startIdleLoop()

    // 窗口尺寸变化重适配
    app.renderer.on('resize', fitModel)

    console.log('[Live2D] 模型加载完成')
    status.value = 'ready'
    emit('ready', model)
  } catch (err: any) {
    console.error('[Live2D] 模型加载失败:', err)
    status.value = 'error'
    errorMsg.value = `模型加载失败：${err?.message || String(err)}`
    emit('error', errorMsg.value)
  }
})

/**
 * 缩放并居中。
 * 原版 pixi-live2d-display 支持 anchor，居中用 anchor.set(0.5) + 定位到画布中心。
 */
function fitModel(): void {
  const model = modelRef.value
  const app = appRef.value
  if (!model || !app) return

  const cw = app.screen.width
  const ch = app.screen.height
  const modelW = model.width
  const modelH = model.height
  if (!modelW || !modelH) return

  // 先复位
  model.scale.set(1)
  model.anchor.set(0.5, 0.5)

  // 等比缩放适配画布，留 10% 边距
  const scale = Math.min((cw * 0.9) / modelW, (ch * 0.95) / modelH)
  model.scale.set(scale)

  // anchor 居中后，定位到画布中心
  model.x = cw / 2
  model.y = ch / 2 + 20
}

/**
 * 待机动作：流萤模型的待机组为 Tick2。
 */
function playIdleMotion(): void {
  const model = modelRef.value
  if (!model) return
  try {
    const defs = model.internalModel?.motionManager?.definitions
    const groups = defs ? Object.keys(defs) : []
    if (groups.length === 0) return
    const idleGroup =
      groups.find((g: string) => /^idle$/i.test(g)) ||
      groups.find((g: string) => /tick2|tick/i.test(g)) ||
      groups.find((g: string) => /idle|standby|breath|待机/i.test(g)) ||
      groups[0]
    if (idleGroup) {
      const count = defs[idleGroup]?.length || 1
      model.motion(idleGroup, Math.floor(Math.random() * count))
    }
  } catch {}
}

let idleTimer: number | null = null
function startIdleLoop(): void {
  stopIdleLoop()
  const schedule = () => {
    idleTimer = window.setTimeout(
      () => {
        playIdleMotion()
        schedule()
      },
      15000 + Math.random() * 15000
    )
  }
  schedule()
}
function stopIdleLoop(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

onBeforeUnmount(() => {
  stopIdleLoop()
  try {
    modelRef.value?.destroy()
  } catch {}
  appRef.value?.destroy(true)
  appRef.value = null
  modelRef.value = null
})

defineExpose({
  getModel: () => modelRef.value,
  resize: fitModel
})
</script>

<style scoped>
.live2d-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.status-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 240, 200, 0.85);
  font-size: 13px;
  z-index: 5;
}

.error-msg {
  color: #ff9a8b;
  text-align: center;
  padding: 0 20px;
  line-height: 1.6;
}

.firefly-spinner {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 220, 130, 0.9) 0%,
    rgba(255, 180, 80, 0.3) 60%,
    transparent 100%
  );
  animation: firefly-pulse 1.4s ease-in-out infinite;
  filter: drop-shadow(0 0 16px rgba(255, 190, 90, 0.7));
}

@keyframes firefly-pulse {
  0%,
  100% {
    transform: scale(0.7);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}
</style>
