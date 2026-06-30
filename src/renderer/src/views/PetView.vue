<template>
  <div
    class="pet-root"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <!--
      阶段 0 占位：这里之后会放 Live2DCanvas.vue（PixiJS + pixi-live2d-display）。
      当前用一个占位框示意人物区域，演示点击穿透 + 拖动。
    -->
    <div class="placeholder" :class="{ hovering: isHovering }">
      <div class="firefly-glow"></div>
      <div class="placeholder-text">
        <span>🦋</span>
        <p>流萤将在此出现</p>
        <small>（阶段 1 接入 Live2D 模型）</small>
      </div>
    </div>

    <!-- 右上角小工具栏 -->
    <div class="toolbar">
      <button class="tool-btn" title="聊天" @click="api.toggleChat()">💬</button>
      <button class="tool-btn" title="退出" @click="api.quit()">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'

// window.api 由 preload 通过 contextBridge 暴露，类型见 src/preload/index.d.ts
const api = useApi()
const isHovering = ref(false)

/**
 * 点击穿透的核心技巧：
 * - 鼠标进入人物区域 → 取消穿透，使其可交互、可拖动
 * - 鼠标离开人物区域 → 开启穿透，让鼠标能点穿到桌面/其他应用
 * （主进程用 setIgnoreMouseEvents(true, {forward:true}) 实现细粒度控制）
 */
const onMouseEnter = () => {
  isHovering.value = true
  api.setIgnoreMouse(false)
}
const onMouseLeave = () => {
  isHovering.value = false
  api.setIgnoreMouse(true)
}

// 初始化：默认开启穿透，仅当鼠标悬停在人物上时才接管
api.setIgnoreMouse(true)
</script>

<style scoped>
.pet-root {
  width: 100%;
  height: 100%;
  position: relative;
  /* 整个根区域默认不接管鼠标事件，由 JS 动态切换 */
  pointer-events: auto;
}

.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: transform 0.3s ease;
}

.placeholder.hovering {
  transform: scale(1.03);
}

/* 萤火虫光晕 */
.firefly-glow {
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 220, 130, 0.35) 0%,
    rgba(255, 200, 100, 0.12) 40%,
    transparent 70%
  );
  animation: pulse 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.15);
    opacity: 1;
  }
}

.placeholder-text {
  text-align: center;
  color: rgba(255, 240, 200, 0.85);
  z-index: 2;
}

.placeholder-text span {
  font-size: 56px;
  display: block;
  margin-bottom: 8px;
  filter: drop-shadow(0 0 12px rgba(255, 200, 100, 0.6));
}

.placeholder-text p {
  font-size: 14px;
  margin-bottom: 4px;
}

.placeholder-text small {
  font-size: 11px;
  opacity: 0.6;
}

/* 工具栏 */
.toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  /* 工具栏始终可点击（不随主体穿透切换，因为根容器 pointer-events:auto） */
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
