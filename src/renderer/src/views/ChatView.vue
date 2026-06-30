<template>
  <div class="chat-root">
    <!-- 标题栏（可拖动窗口） -->
    <div class="title-bar">
      <span class="title">🌸 流萤</span>
      <div class="title-actions">
        <button class="icon-btn" title="隐藏" @click="api.hideChat()">—</button>
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
        <div class="bubble">{{ msg.content }}</div>
      </div>
      <div v-if="messages.length === 0" class="empty-hint">
        和流萤说点什么吧…<br />
        <small>（阶段 2 接入 AI 对话）</small>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-bar">
      <input
        v-model="input"
        type="text"
        placeholder="对她说…"
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
import { ref, nextTick } from 'vue'
import { useApi } from '@/composables/useApi'

interface Message {
  role: 'user' | 'firefly'
  content: string
}

const api = useApi()
const input = ref('')
const sending = ref(false)
const messages = ref<Message[]>([])
const messagesEl = ref<HTMLElement | null>(null)

const send = async () => {
  const text = input.value.trim()
  if (!text || sending.value) return

  messages.value.push({ role: 'user', content: text })
  input.value = ''
  sending.value = true
  await scrollBottom()

  // 阶段 0 占位回复：阶段 2 将替换为真正的 LLM 流式对话
  await new Promise((r) => setTimeout(r, 500))
  messages.value.push({
    role: 'firefly',
    content: '开拓者…我现在还不会说话呢，等阶段 2 接入 AI 后就能陪你聊天啦。'
  })
  sending.value = false
  await scrollBottom()
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

/* 标题栏：-webkit-app-region: drag 使整个窗口可拖动 */
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
  -webkit-app-region: no-drag;
}

.icon-btn {
  width: 20px;
  height: 20px;
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
