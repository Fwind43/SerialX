# SerialX

一款基于 Electron + Vue 3 的桌面串口调试工具，面向日常串口联调、日志观察、HEX 数据分析和多窗口工作流。

## 当前状态

- 平台：Windows
- 桌面框架：Electron 41
- 前端：Vue 3 + Pinia
- 终端渲染：xterm.js
- 串口通信：serialport

项目仍处于快速迭代阶段，`docs/` 目录中维护了最近几个版本的计划和缺陷记录。

## 已实现能力

### 串口与终端

- 多串口同时连接
- 每个串口独立终端面板
- TX / RX 日志分色显示
- 文本模式与 HEX 接收模式
- HEX + ASCII 联合显示
- 自动滚动、清屏、复制、全选
- 复制当前屏幕
- 终端搜索
- 终端右键菜单与常用快捷操作
- 日志导出支持 JSON 和纯文本

### 工作区

- 多分屏布局
- 分屏拖动调宽
- 分屏位置拖拽换位
- 标签可在分屏之间拖拽
- 工作区快照导入 / 导出
- 工作区快照保存、重命名、快速切换和删除
- 当前工作区快照高亮显示
- 会话与布局持久化恢复

### 发送与命令

- 文本发送
- HEX 发送
- 循环发送
- 启动延时、次数上限、失败阈值
- 常用命令管理与分组
- 命令面板快速调用与分组筛选
- 最近发送历史回填

### 外观系统

- 内置浅色 / 深色主题
- 统一的主题方案系统
- 应用与终端外观联动
- 独立的外观设置窗口
- 本地自定义壁纸
- 侧栏 / 工作区 / 终端透明度调节
- 终端字体大小与粗细调节

### 工具与辅助能力

- 独立进制转换工具窗口
- 设置导入 / 导出
- 工作区导入 / 导出

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 桌面应用 | Electron, electron-builder |
| 前端界面 | Vue 3, Vite, electron-vite |
| 状态管理 | Pinia |
| 串口通信 | serialport |
| 终端能力 | xterm, xterm-addon-fit, xterm-addon-search |

## 运行与开发

### 环境要求

- Node.js 18+
- npm 9+
- Windows 10 或更高版本

### 本地开发

```bash
git clone https://gitcode.com/Fwind43/SerialX.git
cd SerialX
npm install
npm run dev
```

### 构建

```bash
npm run build
```

### 打包

```bash
npm run dist:win
```

## 项目结构

```text
SerialX/
├─ electron/                     # Electron 主进程与 preload
├─ src/
│  ├─ components/                # 主界面、终端、设置与工具窗口组件
│  ├─ stores/                    # Pinia 状态与核心业务逻辑
│  ├─ assets/                    # 静态资源
│  ├─ App.vue                    # 应用壳层与全局主题变量
│  └─ main.js                    # 渲染进程入口
├─ docs/                         # 版本计划与 bug log
├─ logo/                         # 图标资源
├─ release/                      # 打包输出目录
└─ README.md
```

## 关键组件

- [App.vue](/E:/SerialX/src/App.vue)
  负责主窗口结构、菜单、主题变量、壁纸层和独立页面入口。
- [serial.js](/E:/SerialX/src/stores/serial.js)
  负责串口状态、工作区布局、主题方案、命令持久化和会话恢复。
- [TerminalView.vue](/E:/SerialX/src/components/TerminalView.vue)
  负责多分屏布局、标签拖拽和工作区交互。
- [TerminalDisplay.vue](/E:/SerialX/src/components/TerminalDisplay.vue)
  负责 xterm 终端渲染、搜索、选区、HEX 排版与复制行为。
- [AppearanceSettingsModal.vue](/E:/SerialX/src/components/AppearanceSettingsModal.vue)
  负责主题方案、应用外观、终端外观和壁纸相关设置。

## 文档约定

- [v0.1.0-plan.md](/E:/SerialX/docs/v0.1.0-plan.md)
  当前开发周期计划。
- [v0.1.0-bug-log.md](/E:/SerialX/docs/v0.1.0-bug-log.md)
  当前开发周期已修复缺陷记录。

后续版本沿用同样的 `plan + bug-log` 结构。

## 已知边界

- 当前 README 只描述已经落地的功能，不承诺尚未发布的路线图。
- 项目目前没有自动化测试基线，主要依赖实际交互验证和构建检查。
- 主题系统和工作区系统仍在持续迭代，界面细节可能随版本调整。
- `v0.1.0` 的发布基线会持续维护在 `docs/v0.1.0-plan.md` 和 `docs/v0.1.0-regression-checklist.md`。

## 许可证

ISC

## 仓库

- 仓库地址：[https://gitcode.com/Fwind43/SerialX](https://gitcode.com/Fwind43/SerialX)
- 问题反馈：[https://gitcode.com/Fwind43/SerialX/issues](https://gitcode.com/Fwind43/SerialX/issues)
