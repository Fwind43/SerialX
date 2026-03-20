# SerialX

<div align="center">

一款基于 Electron + Vue 3 的现代化串口调试工具

![Version](https://img.shields.io/badge/version-v0.0.1-blue)
![Electron](https://img.shields.io/badge/Electron-41.0.3-47848F?logo=electron&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)

[下载](https://gitcode.com/Fwind43/SerialX) · [反馈问题](https://gitcode.com/Fwind43/SerialX/issues)

</div>

---

## 简介

SerialX 是一款现代化的串口调试工具，结合了 SSCOM 的稳定性和 VS Code 的优秀用户体验。支持 Windows 平台，适用于嵌入式开发、硬件调试、物联网设备通信等场景。

## 功能特性

### 核心功能

- 🔌 **串口管理** - 自动扫描可用串口，支持多串口同时连接
- 📊 **实时监控** - 终端视图实时显示收发数据，带 TX/RX 指示
- 🔢 **进制转换** - 内置进制转换工具（二进制/八进制/十进制/十六进制）
- 📝 **常用命令** - 支持常用命令配置和一键发送
- 🔄 **循环发送** - 可设置定时自动发送数据
- 🎨 **无框窗口** - 自定义窗口样式，简洁美观

### 高级功能

- **Hex 模式** - 支持十六进制格式收发数据
- **多串口支持** - 同时打开多个串口独立调试
- **自定义波特率** - 支持 300 ~ 921600 任意波特率
- **配置持久化** - 自动保存串口参数和常用命令
- **数据过滤** - 支持正则表达式过滤接收数据

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| **框架** | Electron 41+ | 跨平台桌面应用 |
| **前端** | Vue 3.5 | SFC + Composition API |
| **构建** | Vite 6 + Electron-Vite | 快速开发和打包 |
| **状态管理** | Pinia 3 | 轻量级状态管理 |
| **串口通信** | serialport 12 | 跨平台串口库 |

## 安装使用

### 系统要求

- Windows 10 或更高版本
- Node.js 18+ (开发需要)

### 下载安装

1. 从 [Release 页面](https://gitcode.com/Fwind43/SerialX/releases) 下载安装包
2. 运行 `SerialX-1.0.0-Setup.exe` 完成安装
3. 启动 SerialX 即可使用

### 开发环境运行

```bash
# 克隆项目
git clone https://gitcode.com/Fwind43/SerialX.git

# 进入项目目录
cd SerialX

# 安装依赖
npm install

# 启动开发模式
npm run dev

# 打包构建
npm run dist:win
```

## 界面预览

### 主界面
- **菜单栏**: 工具、设置、帮助
- **标题栏**: 应用名称 + 窗口控制（最小化/最大化/关闭）
- **左侧边栏**: 串口列表和配置
- **主终端区**: 多串口终端显示
- **底部状态栏**: 串口状态信息

## 使用指南

### 连接串口

1. 在左侧串口列表中选择可用串口
2. 配置波特率、数据位、停止位、校验位
3. 点击「连接串口」按钮或双击串口名称

### 发送数据

1. 在底部输入框输入要发送的数据
2. 按 Enter 键或点击发送按钮
3. 支持常用命令快捷发送

### 进制转换

1. 点击菜单栏「工具」→「进制转换工具」
2. 在弹出窗口中进行进制转换计算

### 常用命令配置

1. 点击菜单栏「设置」→「常用命令配置」
2. 添加/编辑/删除命令
3. 在终端侧边栏快速发送已配置命令

## 项目结构

```
SerialX/
├── electron/              # Electron 主进程
│   ├── main.js           # 主进程入口
│   └── preload.js        # 预加载脚本
├── src/                  # Vue 渲染进程
│   ├── assets/           # 样式和资源
│   ├── components/       # Vue 组件
│   │   ├── SerialSidebar.vue    # 串口侧边栏
│   │   ├── SerialPanel.vue      # 串口面板
│   │   ├── TerminalView.vue     # 终端视图
│   │   ├── DataConverter.vue    # 进制转换
│   │   └── CommandsModal.vue    # 命令配置弹窗
│   ├── stores/           # Pinia 状态管理
│   │   └── serial.js     # 串口状态
│   ├── App.vue           # 根组件
│   └── main.js           # Vue 应用入口
├── logo/                 # 应用图标
├── release/              # 打包输出
├── package.json          # 项目配置
└── README.md             # 项目文档
```

## 版本历史

### v0.0.1 (2026-03) - 当前版本

**新功能**
- ✅ 无框窗口设计，自定义标题栏
- ✅ 顶部菜单栏（工具/设置/帮助）
- ✅ 进制转换工具（独立窗口）
- ✅ 常用命令配置和管理
- ✅ 常用命令持久化存储
- ✅ 窗口最小化/最大化/关闭控制

**优化**
- ✅ 菜单栏交互优化
- ✅ 侧边栏 UI 精简
- ✅ 命令配置全局弹窗

**修复**
- ✅ 编辑弹窗显示问题

### v0.0.2-dev (开发中)

- 🚧 新功能开发中...

## 开发计划

### 短期计划

- [ ] 自动保存和恢复会话
- [ ] 发送/接收数据统计
- [ ] 快捷命令面板 (Ctrl+P)
- [ ] 搜索终端历史

### 中期计划

- [ ] 数据曲线显示（示波器模式）
- [ ] 脚本支持（Lua/Python）
- [ ] 协议解析（Modbus 等）
- [ ] 多语言支持

### 长期计划

- [ ] 插件系统
- [ ] 云端配置同步
- [ ] 协作调试功能

## 常见问题

### Q: 找不到串口？
A: 请确认：
1. 设备已通过 USB 连接电脑
2. 已安装正确的驱动程序
3. 串口未被其他程序占用

### Q: 接收数据乱码？
A: 检查波特率、数据位、停止位、校验位是否与发送端一致

### Q: 如何反馈问题？
A: 请在 [GitCode Issues](https://gitcode.com/Fwind43/SerialX/issues) 中提交问题

## 参与贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 添加新功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 许可证

ISC License

## 联系方式

- 项目地址：https://gitcode.com/Fwind43/SerialX
- 问题反馈：https://gitcode.com/Fwind43/SerialX/issues
