<template>
  <div class="chat-root">
    <!-- 标题栏（可拖动窗口） -->
    <div class="title-bar">
      <span class="title">🌸 流萤</span>
      <div class="title-actions">
        <button
          class="icon-btn"
          :class="{ active: ttsEnabled }"
          :title="ttsEnabled ? '语音开（点击关闭）' : '语音关（点击开启）'"
          @click="toggleTts"
        >{{ ttsEnabled ? '🔊' : '🔇' }}</button>
        <button class="icon-btn" title="设置" @click="showSettings = !showSettings">⚙</button>
        <button class="icon-btn" title="隐藏" @click="api.hideChat()">—</button>
      </div>
    </div>

    <!-- 设置面板（可折叠） -->
    <div v-if="showSettings" class="settings-panel">
      <div class="setting-row">
        <label>API Key</label>
        <input
          v-model="settings.apiKey"
          type="password"
          placeholder="sk-..."
          :class="{ ok: config.hasKey }"
        />
      </div>
      <div class="setting-row">
        <label>Base URL</label>
        <input v-model="settings.baseUrl" placeholder="https://api.deepseek.com/v1" />
      </div>
      <div class="setting-row">
        <label>模型</label>
        <input v-model="settings.model" placeholder="deepseek-chat" />
      </div>
      <div class="setting-actions">
        <button class="save-btn" @click="saveSettings">保存</button>
        <span v-if="config.hasKey" class="status-ok">✓ 已配置</span>
        <span v-else class="status-warn">未配置</span>
      </div>

      <!-- 记忆配置（阶段 5） -->
      <div class="setting-divider">记忆</div>
      <div class="setting-row">
        <label>智谱 Embedding Key（记忆用，可选）</label>
        <input
          v-model="settings.embeddingKey"
          type="password"
          placeholder="智谱 API Key（不填则不记忆）"
          :class="{ ok: memory.hasEmbeddingKey }"
        />
      </div>
      <div class="setting-actions">
        <button class="save-btn" @click="saveEmbeddingKey">保存记忆配置</button>
        <span class="status-ok" v-if="memory.hasEmbeddingKey">✓ 记忆已开启（{{ memory.count }} 条）</span>
        <span class="status-warn" v-else>未开启</span>
        <button v-if="memory.count > 0" class="clear-btn" @click="clearMemory">清空</button>
      </div>
    </div>

    <!-- 消息区 -->
    <div class="messages" ref="messagesEl">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="msg"
        :class="msg.role"
      >
        <div class="bubble">
          <span v-if="msg.role === 'firefly' && msg.content === '' && i === messages.length - 1" class="typing">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </span>
          <span v-else>{{ msg.content }}</span>
        </div>
      </div>
      <div v-if="errorMessage" class="error-banner">⚠️ {{ errorMessage }}</div>
      <div v-if="messages.length === 0 && !errorMessage" class="empty-hint">
        和流萤说点什么吧…<br />
        <small>（试试：「你好」「今天天气真好」「你想吃点什么」）</small>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-bar">
      <input
        v-model="input"
        type="text"
        :placeholder="config.hasKey ? '对她说…' : '请先点 ⚙ 配置 API Key'"
        @keydown.enter="send"
        :disabled="sending"
      />
      <button class="send-btn" @click="send" :disabled="sending || !input.trim()">
        {{ sending ? '…' : '发送' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { useApi } from '@/composables/useApi'
import { useLipSync } from '@/composables/useLipSync'

interface Message {
  role: 'user' | 'firefly'
  content: string
}

const api = useApi()
const input = ref('')
const sending = ref(false)
const messages = ref<Message[]>([])
const messagesEl = ref<HTMLElement | null>(null)
const errorMessage = ref('')
const showSettings = ref(false)

const config = reactive({ baseUrl: '', model: '', hasKey: false })
const settings = reactive({ apiKey: '', baseUrl: '', model: 'deepseek-chat', embeddingKey: '' })

// ===== 长期记忆状态（阶段 5）=====
const memory = reactive({ count: 0, hasEmbeddingKey: false })

// ===== TTS 语音播放 =====
const ttsEnabled = ref(true) // 语音开关（标题栏 🔊 按钮）
const audioQueue = ref<string[]>([]) // 待播放的音频 dataURL 队列
const isPlaying = ref(false)
let currentAudio: HTMLAudioElement | null = null

// ===== 口型同步（阶段 4）=====
// 音频播放时实时分析音量 → 推给 pet 窗口驱动 Live2D 嘴型
const lipSync = useLipSync()
watch(
  () => lipSync.mouthOpen.value,
  (v) => {
    if (lipSync.isActive.value) api.setMouthOpen(v)
  }
)

/** 触发流萤最后一条回复的 TTS 合成 */
function triggerTtsForLastReply() {
  if (!ttsEnabled.value) return
  const lastFirefly = [...messages.value].reverse().find((m) => m.role === 'firefly')
  if (lastFirefly && lastFirefly.content.trim()) {
    // 清空旧队列，开始新的合成
    audioQueue.value = []
    api.synthesize(lastFirefly.content)
  }
}

/** 播放下一段音频（队列驱动，按句顺序播放） */
function playNextAudio() {
  const next = audioQueue.value.shift()
  if (!next) {
    isPlaying.value = false
    // 队列空了：停止说话，闭嘴
    lipSync.stop()
    api.setSpeaking(false)
    api.setMouthOpen(0)
    return
  }
  isPlaying.value = true
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  currentAudio = new Audio(next)
  // 接入口型同步：分析此音频元素的音量
  lipSync.attach(currentAudio)
  api.setSpeaking(true)

  currentAudio.onended = () => playNextAudio()
  currentAudio.onerror = () => playNextAudio() // 出错跳过，继续下一句
  currentAudio.play().catch(() => playNextAudio())
}

/** 停止所有语音播放 */
function stopTts() {
  audioQueue.value = []
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  isPlaying.value = false
  lipSync.stop()
  api.setSpeaking(false)
  api.setMouthOpen(0)
}

/** 切换语音开关（带持久化） */
function toggleTts() {
  ttsEnabled.value = !ttsEnabled.value
  if (!ttsEnabled.value) stopTts()
  api.saveUiSettings({ ttsEnabled: ttsEnabled.value })
}

// 清理 IPC 监听器的函数集合
let cleanups: (() => void)[] = []

onMounted(async () => {
  // 加载当前配置
  const cfg = await api.getLlmConfig()
  config.baseUrl = cfg.baseUrl
  config.model = cfg.model
  config.hasKey = cfg.hasKey
  settings.baseUrl = cfg.baseUrl
  settings.model = cfg.model

  // 加载记忆状态
  await refreshMemoryStatus()
  // 监听记忆更新通知（每轮对话后自动更新条数）
  cleanups.push(api.onMemoryUpdated(({ count }) => { memory.count = count }))

  // 恢复持久化的 UI 设置（语音开关）
  const uiSettings = await api.getUiSettings()
  ttsEnabled.value = uiSettings.ttsEnabled

  // 监听托盘菜单的语音切换
  cleanups.push(
    api.onTtsToggle((enabled) => {
      ttsEnabled.value = enabled
      if (!enabled) stopTts()
    })
  )

  // 注册流式回调
  cleanups.push(
    api.onChatDelta(({ delta }) => {
      // 追加到最后一条流萤消息（即 send 时创建的空占位）
      const lastFirefly = [...messages.value].reverse().find((m) => m.role === 'firefly')
      if (lastFirefly) {
        lastFirefly.content += delta
        scrollBottom()
      }
    }),
    api.onChatDone(() => {
      sending.value = false
      // 回复完成后，自动触发 TTS 语音合成（若开启）
      triggerTtsForLastReply()
    }),
    api.onChatError(({ message }) => {
      sending.value = false
      errorMessage.value = message
      // 移除空的流萤占位消息
      const last = messages.value[messages.value.length - 1]
      if (last && last.role === 'firefly' && last.content === '') {
        messages.value.pop()
      }
    }),
    // TTS：收到合成的音频（逐句推送），加入播放队列
    api.onTtsAudio(({ audio }) => {
      audioQueue.value.push(audio)
      // 若没在播放，启动播放
      if (!isPlaying.value) playNextAudio()
    }),
    api.onTtsDone(() => {}),
    api.onTtsError(({ message }) => {
      console.error('[TTS] 合成失败:', message)
    })
  )

  // 未配置 Key 时自动展开设置面板
  if (!config.hasKey) showSettings.value = true
})

onBeforeUnmount(() => {
  cleanups.forEach((fn) => fn())
  cleanups = []
  stopTts()
})

const send = async () => {
  const text = input.value.trim()
  if (!text || sending.value) return
  if (!config.hasKey) {
    showSettings.value = true
    return
  }

  // 关键：在用户点击发送的调用栈里解锁 AudioContext
  // 否则后续播放音频时 AudioContext 处于 suspended，音量分析失效（嘴不动）
  lipSync.unlock()

  errorMessage.value = ''
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  sending.value = true
  // 立即创建流萤的占位消息，等待增量填充
  messages.value.push({ role: 'firefly', content: '' })
  await scrollBottom()

  try {
    // 构造对话历史（排除空占位）
    const history = messages.value
      .filter((m, i) => !(m.role === 'firefly' && m.content === '' && i === messages.value.length - 1))
      .map((m) => ({
        role: (m.role === 'firefly' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content
      }))
    await api.chat(history)
  } catch (err: any) {
    sending.value = false
    errorMessage.value = err?.message || '发送失败'
    // 移除空占位
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'firefly' && last.content === '') {
      messages.value.pop()
    }
  }
}

const saveSettings = async () => {
  const result = await api.setLlmConfig({
    apiKey: settings.apiKey || undefined,
    baseUrl: settings.baseUrl || undefined,
    model: settings.model || undefined
  })
  config.baseUrl = result.baseUrl
  config.model = result.model
  config.hasKey = result.hasKey
  if (result.hasKey) showSettings.value = false
}

// ===== 记忆管理（阶段 5）=====
const refreshMemoryStatus = async () => {
  const status = await api.getMemoryStatus()
  memory.count = status.count
  memory.hasEmbeddingKey = status.hasEmbeddingKey
}

const saveEmbeddingKey = async () => {
  const result = await api.setEmbeddingKey(settings.embeddingKey)
  memory.hasEmbeddingKey = result.hasEmbeddingKey
  await refreshMemoryStatus()
}

const clearMemory = async () => {
  if (!confirm('确定清空流萤的所有记忆吗？此操作不可撤销。')) return
  const result = await api.clearMemories()
  memory.count = result.count
}

const scrollBottom = async () => {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}
</script>

<style scoped>
.chat-root {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(28, 24, 40, 0.78);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 220, 150, 0.18);
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
}

/* 标题栏 */
.title-bar {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: rgba(255, 200, 120, 0.08);
  border-bottom: 1px solid rgba(255, 220, 150, 0.12);
  -webkit-app-region: drag;
}
.title {
  font-size: 13px;
  color: rgba(255, 235, 190, 0.95);
  font-weight: 500;
}
.title-actions {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}
.icon-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}
.icon-btn.active {
  background: rgba(255, 180, 100, 0.25);
}

/* 设置面板 */
.settings-panel {
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 220, 150, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.setting-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.setting-row label {
  font-size: 11px;
  color: rgba(255, 220, 150, 0.7);
}
.setting-row input {
  height: 30px;
  border: 1px solid rgba(255, 220, 150, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  padding: 0 10px;
  font-size: 12px;
  outline: none;
}
.setting-row input:focus {
  border-color: rgba(255, 180, 100, 0.5);
}
.setting-row input.ok {
  border-color: rgba(100, 220, 150, 0.5);
}
.setting-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}
.save-btn {
  height: 28px;
  padding: 0 16px;
  border: none;
  border-radius: 6px;
  background: linear-gradient(135deg, #ffb86b, #ff8a3d);
  color: #2a1c0a;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.status-ok {
  color: rgba(120, 220, 150, 0.9);
  font-size: 11px;
}
.status-warn {
  color: rgba(255, 180, 100, 0.9);
  font-size: 11px;
}
.setting-divider {
  font-size: 11px;
  color: rgba(255, 220, 150, 0.5);
  margin-top: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 220, 150, 0.1);
}
.clear-btn {
  margin-left: auto;
  height: 28px;
  padding: 0 12px;
  border: 1px solid rgba(255, 100, 80, 0.4);
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 150, 130, 0.9);
  font-size: 11px;
  cursor: pointer;
}
.clear-btn:hover {
  background: rgba(255, 100, 80, 0.15);
}

/* 消息区 */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.empty-hint {
  margin: auto;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  line-height: 1.8;
}
.empty-hint small {
  font-size: 11px;
  opacity: 0.7;
}

.msg {
  display: flex;
  max-width: 100%;
}
.msg.user {
  justify-content: flex-end;
}
.msg.firefly {
  justify-content: flex-start;
}
.bubble {
  max-width: 78%;
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
}
.msg.user .bubble {
  background: linear-gradient(135deg, #ffb86b, #ff9a52);
  color: #2a1c0a;
  border-bottom-right-radius: 4px;
}
.msg.firefly .bubble {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 245, 230, 0.95);
  border: 1px solid rgba(255, 220, 150, 0.15);
  border-bottom-left-radius: 4px;
}

/* 打字动画（流萤正在思考） */
.typing {
  display: inline-flex;
  gap: 3px;
  padding: 2px 0;
}
.typing .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 220, 150, 0.7);
  animation: typing-bounce 1.2s infinite;
}
.typing .dot:nth-child(2) {
  animation-delay: 0.2s;
}
.typing .dot:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes typing-bounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* 错误提示 */
.error-banner {
  background: rgba(255, 100, 80, 0.15);
  border: 1px solid rgba(255, 100, 80, 0.3);
  color: #ffb0a0;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
}

/* 输入区 */
.input-bar {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid rgba(255, 220, 150, 0.12);
  background: rgba(0, 0, 0, 0.15);
}
.input-bar input {
  flex: 1;
  height: 34px;
  border: 1px solid rgba(255, 220, 150, 0.2);
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 0 14px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.input-bar input:focus {
  border-color: rgba(255, 180, 100, 0.5);
}
.input-bar input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}
.send-btn {
  height: 34px;
  padding: 0 16px;
  border: none;
  border-radius: 17px;
  background: linear-gradient(135deg, #ffb86b, #ff8a3d);
  color: #2a1c0a;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
