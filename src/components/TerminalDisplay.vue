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

// 搜索功能
const showSearch = ref(false)
const searchQuery = ref('')
const currentMatchIndex = ref(0)
const matchedLogIndices = ref([])

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

// 搜索功能
const performSearch = () => {
  if (!searchQuery.value || !terminal) {
    matchedLogIndices.value = []
    currentMatchIndex.value = 0
    return
  }

  const query = searchQuery.value.toLowerCase()
  matchedLogIndices.value = []

  // 遍历所有行查找匹配
  const buffer = terminal.buffer.active
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i)
    if (line) {
      const text = line.translateToString().toLowerCase()
      if (text.includes(query)) {
        matchedLogIndices.value.push(i)
      }
    }
  }

  currentMatchIndex.value = 0
  if (matchedLogIndices.value.length > 0) {
    scrollToCurrentMatch()
  }
}

// 滚动到当前匹配项
const scrollToCurrentMatch = () => {
  if (matchedLogIndices.value.length === 0 || !terminal) return
  terminal.scrollToLine(matchedLogIndices.value[currentMatchIndex.value])
}

// 导航到下一个匹配项
const goToNextMatch = () => {
  if (matchedLogIndices.value.length === 0) return
  currentMatchIndex.value = (currentMatchIndex.value + 1) % matchedLogIndices.value.length
  scrollToCurrentMatch()
}

// 导航到上一个匹配项
const goToPreviousMatch = () => {
  if (matchedLogIndices.value.length === 0) return
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matchedLogIndices.value.length) % matchedLogIndices.value.length
  scrollToCurrentMatch()
}

// 清除搜索
const clearSearch = () => {
  showSearch.value = false
  searchQuery.value = ''
  matchedLogIndices.value = []
  currentMatchIndex.value = 0
  if (terminal) {
    terminal.clearSelection()
  }
}

// 监听搜索输入
watch(searchQuery, () => {
  performSearch()
})

// 处理键盘快捷键 - 全局捕获
const handleGlobalKeyDown = (e) => {
  // 如果搜索框已打开，只响应 Escape
  if (showSearch.value) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      clearSearch()
    }
    return
  }

  // Ctrl+F 打开搜索 - 检查是否有输入框获得焦点
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    const activeElement = document.activeElement
    const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
    if (!isInputFocused) {
      e.preventDefault()
      e.stopPropagation()
      showSearch.value = true
      nextTick(() => {
        const input = document.querySelector('.search-input')
        if (input) {
          input.focus()
          input.select()
        }
      })
      return
    }
  }

  // F3 和 Shift+F3 导航（只有搜索打开时才响应）
  if (showSearch.value && matchedLogIndices.value.length > 0 && e.key === 'F3') {
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) {
      goToPreviousMatch()
    } else {
      goToNextMatch()
    }
  }
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
  // 添加全局键盘监听 - 捕获阶段
  document.addEventListener('keydown', handleGlobalKeyDown, true)
})

// 组件卸载
onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeyDown, true)
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
    <!-- 搜索浮窗 -->
    <div v-if="showSearch" class="search-widget">
      <div class="search-input-wrapper">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索日志内容..."
        />
        <div class="search-controls">
          <span class="search-count" v-if="searchQuery">
            {{ matchedLogIndices.length > 0 ? currentMatchIndex + 1 : 0 }} / {{ matchedLogIndices.length }}
          </span>
          <button @click="goToPreviousMatch" class="search-btn" title="上一个匹配项 (Shift+F3)">
            <span>↑</span>
          </button>
          <button @click="goToNextMatch" class="search-btn" title="下一个匹配项 (F3)">
            <span>↓</span>
          </button>
          <button @click="clearSearch" class="search-btn close" title="关闭 (Esc)">
            <span>✕</span>
          </button>
        </div>
      </div>
    </div>

    <!-- xterm 容器 -->
    <div ref="terminalContainer" class="terminal-container"></div>
  </div>
</template>

<style scoped>
/* 自定义滚动条 - VS Code 风格 */
.terminal-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
  background-color: #1e1e1e;
  min-height: 0;
}

.terminal-container {
  width: 100%;
  height: 100%;
  padding: 4px 8px;
  box-sizing: border-box;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* 隐藏 xterm 默认滚动条样式，使用自定义样式 */
.terminal-container ::v-deep(.xterm-viewport) {
  width: 14px !important;
  background-color: #1e1e1e !important;
  border-left: none !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar) {
  width: 14px !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: #1e1e1e !important;
  border: none !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: #424242 !important;
  border-radius: 7px !important;
  border: 2px solid #1e1e1e !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background: #555 !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb:active) {
  background: #666 !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-corner) {
  background: #1e1e1e !important;
}

/* 确保 xterm 内部元素不显示额外边框 */
.terminal-container ::v-deep(.xterm) {
  background: transparent !important;
}

/* 搜索浮窗 */
.search-widget {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 100;
  background-color: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-input {
  padding: 6px 10px;
  background-color: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 3px;
  color: #cccccc;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  width: 250px;
  outline: none;
}

.search-input:focus {
  border-color: #007acc;
}

.search-input::placeholder {
  color: #6a6a6a;
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-count {
  font-size: 12px;
  color: #858585;
  min-width: 50px;
  text-align: right;
  padding: 0 4px;
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: #3c3c3c;
  border: 1px solid #555;
  border-radius: 3px;
  color: #cccccc;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  transition: all 0.15s;
}

.search-btn:hover {
  background-color: #4a4a4a;
  border-color: #007acc;
}

.search-btn.close:hover {
  background-color: #c42b1c;
  border-color: #a02015;
}
</style>
