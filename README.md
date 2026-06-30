# 🌸 流萤陪伴 Agent · Firefly Companion

桌面 Live2D 桌宠 + AI 对话 + 语音口型同步 —— 让《崩坏：星穹铁道》的流萤陪伴你。

> 📖 完整设计见上级目录的 **[《计划书.md》](../计划书.md)**

---

## 当前阶段：阶段 0（环境与脚手架）✅

已完成：
- ✅ electron-vite + Vue 3 + TypeScript 脚手架
- ✅ 透明、置顶、无边框的**浮动人物窗口**（petWindow）
- ✅ 独立的**聊天窗口**（chatWindow），吸附在人物左侧
- ✅ **点击穿透**（鼠标进入人物区域才接管，离开则放行到桌面）
- ✅ 全局快捷键 `Cmd/Ctrl+Shift+F` 唤出/隐藏聊天窗
- ✅ 两个窗口的占位 UI（流萤形象区 + 聊天面板）

> 阶段 1 起：接入 Live2D 模型 → AI 对话 → TTS → 口型同步 → 长期记忆。

---

## 快速开始

### 1. 安装依赖
```bash
cd firefly-companion
npm install
```
> 已配置 npmmirror 镜像，国内安装更快。

### 2. 启动开发
```bash
npm run dev
```
启动后会同时弹出两个窗口：
- 右下角：透明浮动的人物占位区（带萤火虫光晕）
- 左侧：聊天面板（占位回复）

### 3. 交互
| 操作 | 效果 |
|---|---|
| 鼠标移到人物区 | 取消点击穿透，人物区高亮放大 |
| 鼠标移开 | 恢复点击穿透，可点穿到桌面 |
| `Cmd/Ctrl+Shift+F` | 显示/隐藏聊天窗 |
- 聊天窗标题栏可**拖动**整个聊天窗位置
- 人物窗右上角 💬 切换聊天窗、✕ 退出

---

## 目录结构
```
firefly-companion/
├─ 计划书.md              ← （在上级目录 ../计划书.md）
├─ src/
│  ├─ main/              ← 主进程：窗口、IPC
│  │  ├─ index.ts        ← 入口
│  │  ├─ windows.ts      ← pet/chat 窗口创建
│  │  └─ ipc.ts          ← IPC 通道
│  ├─ preload/index.ts   ← 安全 IPC 桥
│  └─ renderer/          ← 渲染进程（Vue 3）
│     └─ src/
│        ├─ main.ts      ← 按 hash 路由到 pet/chat 视图
│        ├─ views/
│        │  ├─ PetView.vue   ← 浮动人物（阶段1放 Live2D）
│        │  └─ ChatView.vue  ← 聊天面板
│        └─ assets/styles.css
└─ resources/model/      ← 放流萤 Live2D 模型（阶段1）
```

---

## 后续阶段路线（见计划书）
1. ⭐ Live2D 登场（接入 moc3 模型）
2. ⭐ Agent 对话（接 LLM）
3. TTS 语音
4. ⭐ 口型同步
5. ⭐ 长期记忆
6. 打磨与打包

---

## 版权
流萤（Firefly）角色版权归米哈游所有。本项目为个人学习自用的二次创作，**不得商用**。
