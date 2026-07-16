# 更新日志 / Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

## [v0.1.0] - 2026-07-06

🌸 流萤陪伴 Agent 首个完整版本。

### 新增

#### 阶段 0 · 环境与脚手架
- Electron 31 + Vue 3 + electron-vite + TypeScript 项目骨架
- 透明置顶、无边框的浮动人物窗口（petWindow）
- 独立聊天窗口（chatWindow），吸附在人物左侧
- 鼠标点击穿透（鼠标进入人物区域才接管，离开则放行到桌面）
- 全局快捷键 `Cmd/Ctrl+Shift+F` 唤出/隐藏聊天窗
- 安全 IPC 桥（contextBridge + contextIsolation）

#### 阶段 1 · Live2D 流萤登场
- 接入 PixiJS 6 + pixi-live2d-display 加载 Cubism 4 moc3 模型
- 模型自动缩放居中，适配窗口尺寸
- 待机动作定时随机切换（Tick2 组：笑一笑 / 一起看 / 很可爱）
- 眼神自动跟随鼠标
- 模型入口自动扫描（无需手改配置）
- Cubism 4 Core 运行时加载

#### 阶段 2 · AI 对话
- 完整流萤人设 System Prompt（身份 / 性格 / 说话方式 / 行为准则）
- OpenAI SDK + DeepSeek 流式对话（流式打字机效果）
- 思考动画（回复前的三点跳动）
- API Key 设置面板（⚙ 按钮，支持运行时配置）
- 会话上下文记忆（最近 20 轮）

#### 阶段 3 · 语音合成（TTS）
- msedge-tts 微软免费中文语音合成
- 文本自动按句切分（长回复分段播放，体验自然）
- 标题栏 🔊 / 🔘 语音开关，可随时关闭/停止
- 音频队列按句顺序播放

#### 阶段 4 · 口型同步
- Web Audio API（AnalyserNode）实时分析音频 RMS 音量
- 音量值跨窗口 IPC 传递（chat → pet）
- 高频 setInterval 直接驱动 Live2D `ParamMouthOpenY` 嘴型参数
- 说话期间停止表情/动作，避免覆盖嘴型
- 适配调参：放大系数（GAIN）、平滑滤波（SMOOTH）、静音阈值（SILENCE）

#### 阶段 5 · 长期记忆
- better-sqlite3 本地持久化（重启不丢失）
- 智谱 Embedding-3 向量化（语义检索）
- 每轮对话后 LLM 自动提取「该记住的关键事实」
- 请求前召回 Top-5 相关记忆注入 system prompt
- 余弦相似度向量检索
- 记忆管理 UI（条数显示、清空）

#### 阶段 6 · 打磨与打包
- 设置持久化（API Key / 语音开关 / Embedding Key，重启不丢失）
- 系统托盘（右键菜单：显示/隐藏流萤·聊天、切换语音、退出）
- 关窗常驻（不退出，留在托盘）
- LLM 调用失败自动重试（最多 2 次，指数退避）
- 友好错误提示（Key 无效 / 余额不足 / 网络失败等）
- electron-builder 打包配置（macOS DMG + Windows NSIS）

### 修复
- 修复 preload 脚本路径（index.js → index.mjs，适配 type:module 编译产物）
- 修复 Pixi v8 的 erase blend mode 回归导致 Live2D 渲染空白（回退至 v6）
- 修复 AudioContext 自动播放策略导致口型同步间歇失效
- 修复 better-sqlite3 原生模块版本不匹配（electron-rebuild 重编译）
- 修复打包后模型/cubism core 加载失败（extraResources → asarUnpack + 相对路径）
- 修复打包后窗口路由错误（hash 缺少 `/` 前缀导致两个窗口都显示流萤）

### 技术决策
- 采用 Pixi v6 而非 v8：规避 [pixijs#11377](https://github.com/pixijs/pixijs/issues/11377) erase blend mode 回归
- 对话用 DeepSeek、向量化用智谱：DeepSeek 不提供 embedding 接口
- 口型同步用 setInterval 而非 RAF：避免窗口失焦时被节流
- 记忆提取用 LLM、召回用向量检索：兼顾准确性与相关性
