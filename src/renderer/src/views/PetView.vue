<template>
  <div
    class="pet-root"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <!-- Live2D 模型画布（流萤） -->
    <Live2DCanvas
      v-if="modelPath"
      :model-path="modelPath"
      @ready="onModelReady"
      @error="onModelError"
    />

    <!-- 右上角小工具栏 -->
    <div class="toolbar">
      <button class="tool-btn" title="聊天" @click="api.toggleChat()">💬</button>
      <button class="tool-btn" title="退出" @click="api.quit()">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Live2DCanvas from '@/components/Live2DCanvas.vue'
import { useApi } from '@/composables/useApi'
import { findModelEntry } from '@/utils/modelLoader'

const api = useApi()

/**
 * 模型入口路径。
 * Live2D 模型通过 Vite 的静态资源机制加载，需给出可被 fetch 的 URL。
 * 这里约定模型放在 src/renderer/public/model/ 下，入口为 xxx.model3.json。
 */
const modelPath = ref<string>('')

/**
 * 扫描并确定模型入口路径。
 * 由于渲染进程无法直接遍历本地文件，模型入口路径通过约定 + 配置方式确定。
 */
onMounted(async () => {
  try {
    modelPath.value = await findModelEntry()
  } catch (err) {
    console.error('[PetView] 未找到模型:', err)
    modelPath.value = ''
  }
})

const onModelReady = () => {}
const onModelError = (msg: string) => {
  console.error('[PetView] 模型加载失败:', msg)
}

// ===== 点击穿透 =====
// 鼠标进入人物区域 → 取消穿透，使其可交互
// 鼠标离开人物区域 → 开启穿透，让鼠标点穿到桌面
const onMouseEnter = () => api.setIgnoreMouse(false)
const onMouseLeave = () => api.setIgnoreMouse(true)

// 初始化默认开启穿透
onMounted(() => api.setIgnoreMouse(true))
</script>

<style scoped>
.pet-root {
  width: 100%;
  height: 100%;
  position: relative;
  pointer-events: auto;
}

.toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  z-index: 10;
}

.tool-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  color: white;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}
</style>
