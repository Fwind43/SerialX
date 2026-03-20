<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { useSerialStore } from '../stores/serial'
import 'xterm/css/xterm.css'

const props = defineProps({
  portPath: {
    type: String,
    required: true
  }
})

const serialStore = useSerialStore()
const terminalContainer = ref(null)

// xterm 实例
let terminal = null
let fitAddon = null

// 日志数据跟踪
let logEntries = [] // 存储所有日志条目 { id, line }
const MAX_LOG_COUNT = 1000 // xterm 最大行数

// 获取当前串口的显示设置
const portDisplaySettings = computed(() => {
  return serialStore.getPortDisplaySettings(props.portPath)
})

// 获取当前串口的控制设置
const portControlSettings = computed(() => {
  return serialStore.getPortControlSettings(props.portPath)
})

// 获取当前串口的过滤器
const portFilters = computed(() => {
  return serialStore.getPortFilters(props.portPath)
})

// 获取当前串口的日志
const portLogs = computed(() => {
  return serialStore.getPortLogs(props.portPath)
})

// 检查日志是否应该被过滤（hide 模式）
const shouldHideLog = (log) => {
  const filters = portFilters.value
  if (!filters.enabled || filters.mode !== 'hide' || !filters.pattern) return false
  if (log.type !== 'rx') return true // 只过滤 RX 数据

  const filterTarget = filters.filterTarget || 'both'
  let dataToCheck = []

  if (portDisplaySettings.value.hexReceive && log.hexData) {
    if (filterTarget === 'hexData' || filterTarget === 'both') {
      dataToCheck.push(log.hexData)
    }
    if (filterTarget === 'asciiData' || filterTarget === 'both') {
      const ascii = log.hexData.split(' ').map(h => {
        const code = parseInt(h, 16)
        return (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.'
      }).join('')
      dataToCheck.push(ascii)
    }
  } else {
    dataToCheck.push(log.message)
  }

  if (dataToCheck.length === 0) return false

  // 关键字匹配
  if (filters.matchMode === 'keyword') {
    return dataToCheck.some(data => data.includes(filters.pattern))
  }

  // 正则表达式匹配
  if (filters.matchMode === 'regex') {
    try {
      const regex = new RegExp(filters.pattern)
      return dataToCheck.some(data => regex.test(data))
    } catch {
      return false
    }
  }

  return false
}

// 格式化日志行
const formatLogLine = (log) => {
  const timestamp = log.timestamp.padEnd(8)
  const prefix = getLogPrefix(log.type).padEnd(4)

  let content = ''
  if (portDisplaySettings.value.hexReceive && log.hexData) {
    // Hex 模式
    content = log.hexData
    if (portDisplaySettings.value.showAscii) {
      const ascii = log.hexData.split(' ').map(h => {
        const code = parseInt(h, 16)
        return (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.'
      }).join('')
      content += ` [${ascii}]`
    }
  } else {
    content = log.message
  }

  return `${timestamp} ${prefix} ${content}`
}

// 获取日志前缀
const getLogPrefix = (type) => {
  const prefixes = {
    tx: 'TX',
    rx: 'RX',
    info: 'INFO',
    success: 'OK',
    error: 'ERR',
    warning: 'WARN'
  }
  return prefixes[type] || 'INFO'
}

// 初始化 xterm
const initTerminal = () => {
  if (!terminalContainer.value) return

  terminal = new Terminal({
    fontSize: 13,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#cccccc',
      cursor: '#cccccc',
      cursorAccent: '#1e1e1e',
      selection: '#404040',
      black: '#1e1e1e',
      red: '#f44747',
      green: '#6a9955',
      yellow: '#dcdcaa',
      blue: '#569cd6',
      magenta: '#c586c0',
      cyan: '#4ec9b0',
      white: '#cccccc',
      brightBlack: '#808080',
      brightRed: '#f44747',
      brightGreen: '#6a9955',
      brightYellow: '#dcdcaa',
      brightBlue: '#569cd6',
      brightMagenta: '#c586c0',
      brightCyan: '#4ec9b0',
      brightWhite: '#ffffff'
    },
    scrollback: 1000,
    convertEol: true,
    cursorBlink: false,
    disableStdin: true
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(terminalContainer.value)
  fitAddon.fit()

  // 加载历史日志
  loadHistoryLogs()

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
}

// 处理窗口大小变化
const handleResize = () => {
  if (fitAddon) {
    fitAddon.fit()
  }
}

// 加载历史日志
const loadHistoryLogs = () => {
  if (!terminal || !portLogs.value) return

  const logs = portLogs.value
  logEntries = []

  terminal.clear()

  const startIdx = Math.max(0, logs.length - MAX_LOG_COUNT)
  for (let i = startIdx; i < logs.length; i++) {
    const log = logs[i]
    // 跳过被隐藏的日志
    if (shouldHideLog(log)) continue

    const line = formatLogLine(log)
    terminal.writeln(line)
    logEntries.push({
      id: log.id,
      line: terminal.rows - 1
    })
  }

  terminal.scrollToBottom()
}

// 添加新日志
const addLogEntry = (log) => {
  if (!terminal) return

  // 跳过被隐藏的日志
  if (shouldHideLog(log)) return

  const line = formatLogLine(log)
  terminal.writeln(line)

  logEntries.push({
    id: log.id,
    line: terminal.rows - 1
  })

  // 限制行数
  if (logEntries.length > MAX_LOG_COUNT) {
    logEntries.shift()
  }

  // 自动滚动
  if (portControlSettings.value.isAutoScroll) {
    terminal.scrollToBottom()
  }
}

// 刷新显示（用于设置变更）
const refreshDisplay = () => {
  if (!terminal) return
  loadHistoryLogs()
}

// 监听日志变化
watch(() => portLogs.value?.length, () => {
  if (!terminal) return

  const logs = portLogs.value
  if (!logs || logs.length === 0) return

  // 检查是否有新日志
  const lastLog = logs[logs.length - 1]
  const lastEntry = logEntries[logEntries.length - 1]

  if (!lastEntry || lastEntry.id !== lastLog.id) {
    // 新日志，添加
    addLogEntry(lastLog)
  }
}, { deep: true })

// 监听设置变更
watch([portDisplaySettings, portFilters], () => {
  refreshDisplay()
}, { deep: true })

// 监听 HEX 接收设置
watch(() => portDisplaySettings.value.hexReceive, () => {
  refreshDisplay()
})

// 组件挂载
onMounted(() => {
  nextTick(() => {
    initTerminal()
  })
})

// 组件卸载
onUnmounted(() => {
  if (terminal) {
    terminal.dispose()
    terminal = null
  }
})

// 暴露方法给父组件
defineExpose({
  refreshDisplay
})
</script>

<template>
  <div class="terminal-wrapper">
    <!-- xterm 容器 -->
    <div ref="terminalContainer" class="terminal-container"></div>
  </div>
</template>

<style scoped>
.terminal-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
  background-color: #1e1e1e;
}

.terminal-container {
  width: 100%;
  height: 100%;
  padding: 4px 8px;
  box-sizing: border-box;
}

/* 自定义滚动条 - VS Code 风格 */
.terminal-container ::v-deep(.xterm-viewport) {
  width: 14px !important;
  background-color: #1e1e1e;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: #1e1e1e;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: #424242;
  border-radius: 7px;
  border: 2px solid #1e1e1e;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background: #555;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb:active) {
  background: #666;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-corner) {
  background: #1e1e1e;
}
</style>
