# 🌸 Firefly Companion · 流萤陪伴 Agent

> 让《崩坏：星穹铁道》的「流萤」以**她本人**的方式陪伴你 —— 桌面 Live2D 桌宠 + AI 对话 + 语音口型同步

<p align="center">
  <strong>会动 · 会聊 · 会说话 · 说话时嘴型还跟着声音同步</strong>
</p>

---

## ✨ 功能特性

| 能力 | 状态 | 说明 |
|---|:---:|---|
| **桌面浮动人物** | ✅ | 透明置顶、可拖动、点击穿透、眼神跟随鼠标 |
| **Live2D 模型** | ✅ | 加载 Cubism 4 moc3 模型，待机动作定时随机切换 |
| **AI 对话** | ✅ | 流萤人设 System Prompt，流式打字机回复 |
| **语音合成** | ✅ | edge-tts 免费中文语音，按句切分播放 |
| **口型同步** | ✅ | Web Audio 实时分析音量 → 驱动 Live2D 嘴型开合 |
| **长期记忆** | ✅ | 智谱 Embedding + SQLite，跨会话记住用户 |
| **设置持久化** | ✅ | API Key / 语音开关重启不丢失 |
| **系统托盘** | ✅ | 托盘菜单 + 关窗常驻 |
| **错误处理** | ✅ | 自动重试 + 友好提示 |
| **打包分发** | ✅ | 一键生成 DMG / EXE 安装包 |

---

## 🛠️ 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 桌面外壳 | **Electron 31** | 透明置顶窗口 + 多窗口 IPC 通信 |
| 前端框架 | **Vue 3 + electron-vite** | 组合式 API，TypeScript |
| Live2D 渲染 | **PixiJS 6 + pixi-live2d-display** | 加载 moc3，驱动嘴型参数 |
| Cubism 运行时 | `live2dcubismcore.min.js` | Live2D 官方 Cubism 4 Core |
| Agent 大脑 | **OpenAI SDK → DeepSeek** | OpenAI 兼容接口，流式输出 |
| 语音合成 | **msedge-tts** | 微软免费中文神经语音 |
| 口型同步 | **Web Audio API** | AnalyserNode 实时 RMS 音量分析 |
| 长期记忆 | **智谱 Embedding-3 + better-sqlite3** | 向量检索 + 本地持久化 |
| 配置/打包 | **dotenv + electron-builder** | 环境变量 + DMG/EXE 打包 |

> 💡 **为什么用 Pixi v6 而非 v8？** Pixi v8 存在 `erase` blend mode 回归 bug（[pixijs#11377](https://github.com/pixijs/pixijs/issues/11377)），会导致 Live2D 蒙版渲染空白。v6 是经过验证的稳定方案。

> 💡 **为什么记忆用两个供应商？** DeepSeek 不提供 embedding 接口，所以对话用 DeepSeek，向量化用智谱 Embedding-3（免费额度）。两者都是 OpenAI 兼容接口。

---

## 📦 快速开始

### 1. 克隆并安装
```bash
git clone git@github.com:Shay-ACC/FireFly.git
cd FireFly
npm install
```
> 已配置 npmmirror 镜像，国内安装更快。

### 2. ⚠️ 补全必需资源（已被 gitignore 排除）

由于体积/版权原因，以下资源未入库，**必须手动补全**：

#### ① Cubism Core 运行时
```bash
curl -L -o src/renderer/public/live2dcubismcore.min.js \
  "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"
```

#### ② Live2D 模型
将流萤 moc3 模型放入 `src/renderer/public/model/firefly/`：
```
src/renderer/public/model/firefly/
├─ FileReferences_Moc_0.model3.json   ← 入口（程序自动扫描）
├─ FileReferences_Moc_0.moc3
├─ textures/*.png
├─ motions/*.motion3.json
├─ expressions/*.exp3.json
└─ physics/*.physic3.json
```
> ⚠️ 模型版权归米哈游及原作者所有，仅限个人自用，禁止商用/分发。

#### ③ 配置 API Key
复制 `.env.example` 为 `.env`，填入 API Key：
```bash
cp .env.example .env
```
```env
# 对话用（必需）
DEEPSEEK_API_KEY=sk-你的key
LLM_API_BASE=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

# 记忆用（可选，不填则不记忆）
ZHIPU_API_KEY=你的智谱key
EMBEDDING_API_BASE=https://open.bigmodel.cn/api/paas/v4
EMBEDDING_MODEL=embedding-3
```
| Key | 用途 | 获取地址 | 是否必需 |
|---|---|---|:---:|
| DeepSeek | 对话/记忆提取 | https://platform.deepseek.com | ✅ 必需 |
| 智谱 | 记忆向量化 | https://open.bigmodel.cn | ⬜ 可选 |

> 也可启动后在聊天窗右上角 **⚙ 设置** 里临时填写（会持久化到本地，重启不丢失）。

### 3. 启动
```bash
npm run dev
```
启动后会同时弹出：
- **右下角透明窗口**：流萤漂浮在桌面（会动、眼神跟随鼠标）
- **左侧聊天框**：和流萤对话（流式回复 + 自动语音 + 口型同步）

---

## 🎮 使用说明

| 操作 | 效果 |
|---|---|
| 鼠标移到流萤上 | 取消点击穿透，可交互 |
| 鼠标移开 | 恢复点击穿透，点穿到桌面 |
| `Cmd/Ctrl+Shift+F` | 显示/隐藏聊天窗 |
| 聊天窗标题栏 | 可拖动整个聊天窗 |
| 💬 按钮 | 切换聊天窗显隐 |
| 🔊 / 🔘 按钮 | 开启/关闭语音播放 |
| ⚙ 按钮 | 设置 API Key / 模型 / 记忆 |
| 托盘图标右键 | 显示/隐藏流萤·聊天、切换语音、退出 |
| 关闭窗口 | 不退出，常驻托盘（托盘菜单点「退出」才真正退出） |

---

## 🏗️ 项目结构

```
firefly-companion/
├─ src/
│  ├─ main/                          # 主进程（Node 环境）
│  │  ├─ index.ts                    # 入口：窗口/生命周期/初始化
│  │  ├─ windows.ts                  # pet/chat 窗口创建
│  │  ├─ ipc.ts                      # 所有 IPC 通道注册
│  │  ├─ settings.ts                 # 设置持久化（本地 JSON）
│  │  ├─ tray.ts                     # 系统托盘
│  │  ├─ agent/                      # Agent 大脑
│  │  │  ├─ persona.ts               # 流萤人设 System Prompt
│  │  │  └─ llm.ts                   # LLM 流式调用 + 重试
│  │  ├─ memory/                     # 长期记忆
│  │  │  ├─ store.ts                 # SQLite 存储 + 向量检索
│  │  │  └─ recall.ts                # 智谱 embedding + 记忆提取/召回
│  │  └─ tts/
│  │     └─ edge-tts.ts              # 语音合成（按句切分）
│  ├─ preload/
│  │  ├─ index.ts                    # 安全 IPC 桥（contextBridge）
│  │  └─ index.d.ts                  # window.api 类型声明
│  └─ renderer/                      # 渲染进程（Vue 3）
│     ├─ index.html                  # 引入 cubism core
│     └─ src/
│        ├─ main.ts                  # 按 hash 路由到 pet/chat
│        ├─ views/
│        │  ├─ PetView.vue           # 浮动人物窗口
│        │  └─ ChatView.vue          # 聊天 + 语音 + 设置面板
│        ├─ components/
│        │  └─ Live2DCanvas.vue      # Live2D 渲染 + 嘴型驱动
│        ├─ composables/
│        │  ├─ useApi.ts             # window.api 封装
│        │  └─ useLipSync.ts         # Web Audio 音量分析
│        └─ utils/
│           └─ modelLoader.ts        # 模型入口扫描
├─ resources/                        # 托盘图标
└─ .env.example                      # 环境变量模板
```

---

## 🧠 架构与核心数据流

```
┌─────────────────────────── 主进程 (Node) ───────────────────────────┐
│  窗口管理  │  Agent(LLM流式)  │  TTS(edge-tts)  │  记忆(SQLite+向量) │
│           │                  │                 │  设置持久化/托盘    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ IPC (contextBridge)
┌─────────────────────────────────┴───────────────────────────────────┐
│  chat 窗口                       │  pet 窗口                        │
│  · 聊天 UI / 流式文字            │  · Live2D 渲染 (Pixi)            │
│  · <audio> 播放 TTS              │  · 待机动作 / 眼神跟随            │
│  · Web Audio 分析音量 ──IPC────→│  · ParamMouthOpenY 嘴型驱动      │
└──────────────────────────────────┴───────────────────────────────────┘
```

**一次对话的完整流程：**
```
用户输入 → [unlock AudioContext]
  → 召回相关长期记忆 → 注入 system prompt
  → LLM 流式回复（打字机效果）
  → 回复完成 → 异步提取记忆 → 智谱 embedding → SQLite 存储
  → 同时 edge-tts 按句合成 MP3
  → chat 窗口 <audio> 播放
  → Web Audio 实时分析音量(RMS) → IPC 推给 pet 窗口
  → pet 窗口高频写入 ParamMouthOpenY → 嘴型随声音开合
```

---

## 🔧 口型同步实现要点

本项目最有技术含量的部分，解决了 4 个深坑：

| 难点 | 方案 |
|---|---|
| AudioContext 自动播放策略 | 用户点击「发送」时 `unlock()` resume |
| 窗口失焦 RAF 被节流 | `setInterval(33ms)` 替代 `requestAnimationFrame` |
| 库 update 覆盖嘴型参数 | 高频 `setInterval` 直接写 `ParamMouthOpenY`，绕开 Pixi 管线 |
| 表情/动作覆盖嘴型 | 说话时 `stopAllMotions()` + 停止 idle 循环 |

详见 `src/renderer/src/composables/useLipSync.ts` 和 `Live2DCanvas.vue`。

---

## 📜 脚本

```bash
npm run dev          # 开发模式（热重载）
npm run build        # 生产构建（类型检查 + 编译）
npm run typecheck    # 仅类型检查
npm run build:mac    # 打包成 macOS DMG（arm64 + x64）
npm run build:win    # 打包成 Windows EXE（NSIS 安装包）
```

打包产物在 `release/` 目录，可直接分发安装。

---

## 🗺️ 开发路线图

- ✅ **阶段 0**：环境与脚手架
- ✅ **阶段 1**：Live2D 流萤登场（桌面浮动 + 待机动作 + 眼神跟随）
- ✅ **阶段 2**：Agent 对话（LLM + 人设 + 流式回复）
- ✅ **阶段 3**：TTS 语音（edge-tts 中文语音）
- ✅ **阶段 4**：口型同步 ⭐（边说边动嘴）
- ✅ **阶段 5**：长期记忆 ⭐（智谱 Embedding + SQLite，跨会话记住用户）
- ✅ **阶段 6**：打磨与打包（设置持久化 + 托盘 + 错误重试 + DMG 打包）

> 🎉 **全部 7 个阶段已完成**。核心能力齐备：会动、会聊、会说话、嘴型同步、记住你、可分发。

---

## ⚖️ 版权与合规

- **流萤（Firefly）角色版权归米哈游所有**。本项目为个人学习与自用的二次创作，**不得用于商业用途**，不得公开分发模型素材。
- Live2D 同人模型请遵循原作者的使用授权条款。
- edge-tts 为微软「大声朗读」的非官方接口，仅用于学习；商用请使用官方授权 TTS 服务。
- 使用在线 LLM API 时，注意不输入敏感个人信息。

---

## 📄 License

UNLICENSED（仅供个人学习使用）
