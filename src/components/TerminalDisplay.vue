<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { SearchAddon } from '@xterm/addon-search'
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
let searchAddon = null

// 日志数据跟踪
let logEntries = [] // 存储所有日志条目 { id, line }
const MAX_LOG_COUNT = 1000 // xterm 最大行数

// 搜索功能
const showSearch = ref(false)
const searchQuery = ref('')
const searchMatchCount = ref(0)
const currentMatchIndex = ref(0)

// 右键菜单
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedText = ref('')

// 打开搜索框
const openSearch = () => {
  showSearch.value = true
  // 重置搜索状态
  searchMatchCount.value = 0
  currentMatchIndex.value = 0
  nextTick(() => {
    const input = document.querySelector('.search-input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

// 搜索防抖定时器
let searchDebounceTimer = null

// 带防抖的搜索
const debouncedSearch = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    performSearch()
  }, 150) // 150ms 防抖
}

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

// 格式化日志行 - 使用 ANSI 转义码添加颜色
const getHexLengthPerLine = () => {
  // 根据终端实际列数动态计算（减去时间戳和前缀占用的空间）
  const terminalCols = terminal?.cols || 100
  const reservedCols = 18 // 时间戳 (8) + 空格 (1) + 前缀 (4) + 空格 (1) + 续行标记 (2) + 余量 (2)
  return Math.max(4, terminalCols - reservedCols)
}

const formatLogLine = (log) => {
  const timestamp = log.timestamp.padEnd(8)
  const prefix = getLogPrefix(log.type)
  const maxCharsPerLine = getHexLengthPerLine()

  let content = ''
  if (portDisplaySettings.value.hexReceive && log.hexData) {
    // Hex 模式 - hexData 是带空格的格式（如 "41 42 43"），每字节占 3 字符
    const hexData = log.hexData
    // 计算每行能容纳的最大字节数（每字节 3 字符：2 位 hex+1 空格）
    const bytesPerLine = Math.floor(maxCharsPerLine / 3)

    if (hexData.length <= maxCharsPerLine) {
      content = hexData
    } else {
      // 分段显示长数据 - 按字节分割
      const lines = []
      const hexBytes = hexData.split(' ') // 按空格分割成字节数组
      for (let i = 0; i < hexBytes.length; i += bytesPerLine) {
        const segment = hexBytes.slice(i, i + bytesPerLine).join(' ')
        const continuation = i > 0 ? '  ' : '' // 续行标记
        lines.push(continuation + segment)
      }
      content = lines.join('\n')
    }
    if (portDisplaySettings.value.showAscii) {
      const ascii = hexData.split(' ').map(h => {
        const code = parseInt(h, 16)
        return (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.'
      }).join('')
      content += ` [${ascii}]`
    }
  } else {
    content = log.message
  }

  // 根据日志类型应用不同颜色（使用 ANSI 转义码）
  const colorCodes = {
    tx: '\x1b[38;5;39m',    // 青色 - TX
    rx: '\x1b[38;5;40m',    // 绿色 - RX
    info: '\x1b[38;5;252m', // 浅灰色 - INFO
    success: '\x1b[38;5;71m', // 浅绿色 - OK
    error: '\x1b[38;5;196m',  // 红色 - ERR
    warning: '\x1b[38;5;214m' // 橙色 - WARN
  }

  const reset = '\x1b[0m'
  const color = colorCodes[log.type] || colorCodes.info

  return `${timestamp} ${color}${prefix}${reset} ${content}`
}

// 获取日志前缀
const getLogPrefix = (type) => {
  const prefixes = {
    tx: '[TX]',
    rx: '[RX]',
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }
  return prefixes[type] || 'ℹ️'
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
      yellow: '#ffd700',
      blue: '#569cd6',
      magenta: '#c586c0',
      cyan: '#4ec9b0',
      white: '#cccccc',
      brightBlack: '#808080',
      brightRed: '#f44747',
      brightGreen: '#6a9955',
      brightYellow: '#ffd700',
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
  searchAddon = new SearchAddon({
    highlightLimit: 1000,
    highlightStyle: {
      match: { backgroundColor: '#ffd700', color: '#000000', fontWeight: 'bold' },
      currentMatch: { backgroundColor: '#ff8c00', color: '#ffffff', fontWeight: 'bold' }
    }
  })

  terminal.loadAddon(fitAddon)
  terminal.loadAddon(searchAddon)
  terminal.open(terminalContainer.value)
  fitAddon.fit()

  // 加载历史日志
  loadHistoryLogs()

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
}

// 处理窗口大小变化 - 防抖处理
let resizeDebounceTimer = null
const handleResize = () => {
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
  }
  resizeDebounceTimer = setTimeout(() => {
    if (fitAddon) {
      fitAddon.fit()
      // 等待终端列数更新后再刷新显示
      nextTick(() => {
        refreshDisplay()
      })
    }
  }, 100) // 100ms 防抖
}

// ResizeObserver 监听容器大小变化
let resizeObserver = null
const initResizeObserver = () => {
  if (!terminalContainer.value || resizeObserver) return

  resizeObserver = new ResizeObserver(() => {
    handleResize()
  })
  resizeObserver.observe(terminalContainer.value)
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
  if (!searchQuery.value || !terminal || !searchAddon) {
    searchMatchCount.value = 0
    currentMatchIndex.value = 0
    return
  }

  // 清除之前的搜索结果
  terminal.clearSelection()
  searchAddon.clearDecorations()

  // 计算总匹配数 - 遍历所有日志
  let matchCount = 0
  const searchStr = searchQuery.value.toLowerCase()

  for (let i = 0; i < logEntries.length; i++) {
    const log = portLogs.value?.find(l => l.id === logEntries[i].id)
    if (log) {
      const lineText = formatLogLine(log).toLowerCase()
      let pos = 0
      while ((pos = lineText.indexOf(searchStr, pos)) !== -1) {
        matchCount++
        pos += searchStr.length
      }
    }
  }

  // 使用 xterm SearchAddon 查找第一个匹配项
  const found = searchAddon.findNext(searchQuery.value, {
    caseSensitive: false,
    wholeWord: false,
    regex: false
  })

  if (found) {
    searchMatchCount.value = matchCount > 0 ? matchCount : 1
    currentMatchIndex.value = 1
  } else {
    searchMatchCount.value = 0
    currentMatchIndex.value = 0
  }
}

// 导航到下一个匹配项
const goToNextMatch = () => {
  if (!searchQuery.value || !terminal || !searchAddon) return
  const found = searchAddon.findNext(searchQuery.value, {
    caseSensitive: false,
    wholeWord: false,
    regex: false
  })
  if (found && searchMatchCount.value > 0) {
    currentMatchIndex.value = (currentMatchIndex.value % searchMatchCount.value) + 1
  }
}

// 导航到上一个匹配项
const goToPreviousMatch = () => {
  if (!searchQuery.value || !terminal || !searchAddon) return
  const found = searchAddon.findPrevious(searchQuery.value, {
    caseSensitive: false,
    wholeWord: false,
    regex: false
  })
  if (found && searchMatchCount.value > 0) {
    currentMatchIndex.value = currentMatchIndex.value <= 1 ? searchMatchCount.value : currentMatchIndex.value - 1
  }
}

// 处理 Enter 键导航
const handleEnterKey = () => {
  goToNextMatch()
}

// 清除搜索
const clearSearch = () => {
  showSearch.value = false
  searchQuery.value = ''
  searchMatchCount.value = 0
  currentMatchIndex.value = 0
  clearSearchDebounce()
  if (terminal) {
    terminal.clearSelection()
  }
  if (searchAddon) {
    searchAddon.clearDecorations()
  }
}

// 监听搜索输入
watch(searchQuery, () => {
  debouncedSearch()
})

// 清除搜索防抖定时器
const clearSearchDebounce = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
}

// 处理键盘快捷键 - F3 和 Escape
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

  // F3 和 Shift+F3 导航（只有搜索打开时才响应）
  if (showSearch.value && searchQuery.value && e.key === 'F3') {
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) {
      goToPreviousMatch()
    } else {
      goToNextMatch()
    }
  }
}

// 监听全局搜索打开事件
const handleOpenSearch = () => {
  console.log('[TerminalDisplay] Received serialx-open-search')
  openSearch()
}

// 直接在组件内监听键盘事件（捕获阶段）
const handleKeyDown = (e) => {
  console.log('[TerminalDisplay] Keydown:', e.key, 'Ctrl:', e.ctrlKey)

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    e.stopPropagation()
    console.log('[TerminalDisplay] Opening search')
    openSearch()
  }
}

// 监听日志变化
watch(() => portLogs.value?.length, () => {
  if (!terminal) return

  const logs = portLogs.value
  if (!logs || logs.length === 0) {
    // 日志被清空
    terminal.clear()
    logEntries = []
    return
  }

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
    initResizeObserver()
  })
  // 监听全局键盘事件（F3、Escape）
  document.addEventListener('keydown', handleGlobalKeyDown, true)
  // 监听全局搜索打开事件
  window.addEventListener('serialx-open-search', handleOpenSearch)
  // 直接监听键盘事件（捕获阶段，优先处理 Ctrl+F）
  document.addEventListener('keydown', handleKeyDown, true)
  // 监听右键菜单
  if (terminalContainer.value) {
    terminalContainer.value.addEventListener('contextmenu', handleContextMenu)
  }
  // 点击其他地方关闭菜单
  document.addEventListener('click', closeContextMenu)
})

// 右键菜单处理
const handleContextMenu = (e) => {
  e.preventDefault()
  const text = terminal?.getSelection()?.trim()
  if (text) {
    selectedText.value = text
    contextMenuPosition.value = { x: e.clientX, y: e.clientY }
    showContextMenu.value = true
  }
}

// 复制选中的文本
const copySelection = async () => {
  const text = terminal?.getSelection()
  if (text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      // 降级处理
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }
  showContextMenu.value = false
}

// 全选
const selectAll = () => {
  if (terminal) {
    const range = document.createRange()
    range.selectNodeContents(terminal.element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  showContextMenu.value = false
}

// 关闭右键菜单
const closeContextMenu = (e) => {
  // 如果点击的是菜单内部，不关闭
  if (e && e.target && e.target.closest('.context-menu')) return
  showContextMenu.value = false
  selectedText.value = ''
}

// 组件卸载
onUnmounted(() => {
  clearSearchDebounce()
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  document.removeEventListener('keydown', handleGlobalKeyDown, true)
  document.removeEventListener('keydown', handleKeyDown, true)
  window.removeEventListener('serialx-open-search', handleOpenSearch)
  if (terminalContainer.value) {
    terminalContainer.value.removeEventListener('contextmenu', handleContextMenu)
  }
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
          @keydown.enter.prevent="handleEnterKey"
          @keydown.shift.enter.prevent="goToPreviousMatch"
        />
        <div class="search-controls">
          <span class="search-count">
            {{ !searchQuery ? '' : (searchMatchCount > 0 ? `${currentMatchIndex} / ${searchMatchCount}` : '无匹配项') }}
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

    <!-- 右键菜单 -->
    <div
      v-if="showContextMenu"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="copySelection">
        <span>📋</span>
        <span>复制</span>
      </div>
      <div class="context-menu-item" @click="selectAll">
        <span>✓</span>
        <span>全选</span>
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
  width: 100%;
  display: flex;
  flex-direction: column;
}

.terminal-container {
  flex: 1;
  width: 100%;
  position: relative;
  padding: 4px 8px;
  box-sizing: border-box;
  overflow: hidden;
}

/* 隐藏 xterm 默认滚动条样式，使用自定义样式 */
.terminal-container ::v-deep(.xterm-viewport) {
  width: auto !important;
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
  width: 100% !important;
  height: 100% !important;
}

/* 确保 xterm 所有内部容器宽度动态 */
.terminal-container ::v-deep(.xterm .xterm-screen),
.terminal-container ::v-deep(.xterm .xterm-screen-canvas),
.terminal-container ::v-deep(.xterm .xterm-rows),
.terminal-container ::v-deep(.xterm .xterm-scroll-area) {
  width: 100% !important;
  max-width: 100% !important;
}

/* 修复 xterm-rows 子 div 宽度 - 这些是实际的行元素 */
.terminal-container ::v-deep(.xterm-rows > div) {
  width: auto !important;
  max-width: 100% !important;
}

/* 搜索高亮样式 - 鲜艳黄色 */
.terminal-container ::v-deep(.xterm-find-match) {
  background-color: #ffd700 !important;
  color: #000000 !important;
  font-weight: bold;
}

.terminal-container ::v-deep(.xterm-find-match-current) {
  background-color: #ff8c00 !important;
  color: #ffffff !important;
  font-weight: bold;
}

/* xterm SearchAddon 高亮样式 */
.terminal-container ::v-deep(.xterm .xterm-find-match-decoration) {
  background-color: #ffd700 !important;
}

.terminal-container ::v-deep(.xterm .xterm-find-match-current-decoration) {
  background-color: #ff8c00 !important;
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

/* 右键菜单 */
.context-menu {
  position: fixed;
  background-color: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  padding: 4px 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 10000;
  min-width: 120px;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: #cccccc;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.context-menu-item:hover {
  background-color: #007acc;
  color: #ffffff;
}

.context-menu-item span:first-child {
  font-size: 14px;
}
</style>
