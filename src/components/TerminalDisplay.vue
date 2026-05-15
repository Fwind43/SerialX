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
const contextMenuRef = ref(null)
const searchInput = ref(null)

let terminal = null
let fitAddon = null
let searchAddon = null

let logEntries = []
const formattedLogCache = new Map()
const MAX_LOG_COUNT = 1000
let renderedLogCount = 0
let renderedFirstLogId = null
let renderedLastLogId = null

const showSearch = ref(false)
const searchQuery = ref('')
const searchCaseSensitive = ref(false)
const searchWholeWord = ref(false)
const searchUseRegex = ref(false)
const searchError = ref('')
const searchMatchCount = ref(0)
const currentMatchIndex = ref(0)
const isSearchPending = ref(false)
const searchStatusText = computed(() => {
  if (!searchQuery.value) {
    return '输入内容开始搜索'
  }

  if (searchError.value) {
    return searchError.value
  }

  if (isSearchPending.value) {
    return '正在搜索...'
  }

  if (searchMatchCount.value === 0) {
    return '未找到匹配项'
  }

  const currentIndex = currentMatchIndex.value || 1
  return `第 ${currentIndex} / 共 ${searchMatchCount.value} 项`
})
const isSearchEmpty = computed(() => searchQuery.value && !isSearchPending.value && (searchMatchCount.value === 0 || Boolean(searchError.value)))
const canNavigateSearchMatches = computed(() => (
  Boolean(searchQuery.value) &&
  !isSearchPending.value &&
  !searchError.value &&
  searchMatchCount.value > 0
))

const searchElementIdSuffix = computed(() => props.portPath.replace(/[^a-zA-Z0-9_-]/g, '-'))
const searchInputId = computed(() => `terminal-search-input-${searchElementIdSuffix.value}`)
const searchStatusId = computed(() => `terminal-search-status-${searchElementIdSuffix.value}`)
const searchCountId = computed(() => `terminal-search-count-${searchElementIdSuffix.value}`)

const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedText = ref('')

let searchDebounceTimer = null
let resizeDebounceTimer = null
let resizeObserver = null

const portDisplaySettings = computed(() => serialStore.getPortDisplaySettings(props.portPath))
const portControlSettings = computed(() => serialStore.getPortControlSettings(props.portPath))
const terminalAppearance = computed(() => serialStore.terminalAppearance)
const portLogs = computed(() => serialStore.getPortLogs(props.portPath))
const themeMode = computed(() => serialStore.appUiState?.themeMode || 'dark')
const terminalAppearanceMode = computed(() => serialStore.appUiState?.terminalAppearanceMode || 'preset-dark')
const wallpaperEnabled = computed(() => Boolean(serialStore.appUiState?.wallpaperEnabled && serialStore.appUiState?.wallpaperPath))
const terminalOpacity = computed(() => {
  const value = Number(serialStore.appUiState?.terminalOpacity ?? 0.34)
  return Number.isFinite(value) ? Math.min(0.82, Math.max(0.04, value)) : 0.34
})

const isUsingLightPreset = computed(() => (
  themeMode.value === 'light' && terminalAppearanceMode.value === 'preset-light'
))

const hexToRgb = (color) => {
  if (typeof color !== 'string') return null
  const normalized = color.trim().replace('#', '')
  const hex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  }
}

const lightForegroundRgb = computed(() => (
  hexToRgb(terminalAppearance.value.terminalForeground) || { r: 23, g: 52, b: 71 }
))

const effectiveSelectionStyle = computed(() => {
  if (isUsingLightPreset.value) {
    const { r, g, b } = lightForegroundRgb.value
    return {
      background: `rgba(${r}, ${g}, ${b}, 0.28)`,
      inactiveBackground: `rgba(${r}, ${g}, ${b}, 0.18)`,
      foreground: undefined,
      outline: `rgba(${r}, ${g}, ${b}, 0.38)`,
      shadow: `inset 0 0 0 1px rgba(${r}, ${g}, ${b}, 0.38), inset 0 1px 0 rgba(${r}, ${g}, ${b}, 0.14)`
    }
  }

  return {
    background: terminalAppearance.value.selectionColor,
    inactiveBackground: terminalAppearance.value.selectionColor,
    foreground: undefined,
    outline: 'transparent',
    shadow: 'none'
  }
})

const effectiveSearchPalette = computed(() => {
  if (isUsingLightPreset.value) {
    return {
      matchBackground: 'rgba(51, 136, 204, 0.22)',
      matchBorder: 'rgba(0, 120, 212, 0.4)',
      matchTextColor: '#0f2940',
      matchShadow: 'inset 0 -0.9em 0 rgba(122, 184, 235, 0.8)',
      activeMatchBackground: 'rgba(0, 120, 212, 0.28)',
      activeMatchBorder: 'rgba(0, 120, 212, 0.58)',
      activeMatchTextColor: '#082235',
      activeMatchShadow: 'inset 0 -0.92em 0 rgba(0, 120, 212, 0.34)',
      overviewRuler: 'rgba(0, 120, 212, 0.55)'
    }
  }

  return {
    matchBackground: 'rgba(29, 61, 75, 0.92)',
    matchBorder: 'rgba(76, 130, 154, 0.88)',
    matchTextColor: terminalAppearance.value.terminalForeground,
    matchShadow: 'inset 0 -0.72em 0 rgba(29, 61, 75, 0.92)',
    activeMatchBackground: 'rgba(41, 88, 107, 0.98)',
    activeMatchBorder: 'rgba(118, 184, 214, 0.95)',
    activeMatchTextColor: '#ffffff',
    activeMatchShadow: 'inset 0 -0.78em 0 rgba(41, 88, 107, 0.98)',
    overviewRuler: 'rgba(29, 61, 75, 0.92)'
  }
})

const terminalCssVars = computed(() => ({
  '--terminal-background': wallpaperEnabled.value
    ? (
        themeMode.value === 'light'
          ? `rgba(245, 251, 255, ${Math.max(0.02, terminalOpacity.value - 0.08)})`
          : `rgba(17, 22, 28, ${Math.max(0.02, terminalOpacity.value)})`
      )
    : terminalAppearance.value.terminalBackground,
  '--terminal-surface-bg': wallpaperEnabled.value
    ? (
        themeMode.value === 'light'
          ? `rgba(${lightForegroundRgb.value.r}, ${lightForegroundRgb.value.g}, ${lightForegroundRgb.value.b}, ${Math.max(0.02, terminalOpacity.value * 0.08)})`
          : `rgba(9, 16, 22, ${Math.max(0.02, terminalOpacity.value - 0.06)})`
      )
    : terminalAppearance.value.terminalBackground,
  '--terminal-foreground': terminalAppearance.value.terminalForeground,
  '--terminal-frame-bg': wallpaperEnabled.value
    ? (
        themeMode.value === 'light'
          ? `rgba(${lightForegroundRgb.value.r}, ${lightForegroundRgb.value.g}, ${lightForegroundRgb.value.b}, ${Math.max(0.02, terminalOpacity.value * 0.06)})`
          : `rgba(7, 13, 18, ${Math.max(0.02, terminalOpacity.value - 0.16)})`
      )
    : (themeMode.value === 'light' ? '#ffffff' : 'rgba(7, 13, 18, 0.22)'),
  '--terminal-frame-border': themeMode.value === 'light' ? 'rgba(0, 102, 153, 0.12)' : 'rgba(255, 255, 255, 0.04)',
  '--terminal-selection-bg': effectiveSelectionStyle.value.background,
  '--terminal-selection-outline': effectiveSelectionStyle.value.outline,
  '--terminal-selection-shadow': effectiveSelectionStyle.value.shadow,
  '--terminal-inner-shadow': themeMode.value === 'light'
    ? 'none'
    : 'none',
  '--search-match-text-color': effectiveSearchPalette.value.matchTextColor,
  '--search-match-shadow': effectiveSearchPalette.value.matchShadow,
  '--search-current-match-text-color': effectiveSearchPalette.value.activeMatchTextColor,
  '--search-current-match-shadow': effectiveSearchPalette.value.activeMatchShadow,
  '--search-line-highlight': terminalAppearance.value.searchLineHighlightColor
}))

const resolvedFontSize = computed(() => {
  const value = Number(terminalAppearance.value.fontSize ?? 13)
  return Number.isFinite(value) ? Math.min(24, Math.max(10, value)) : 13
})

const resolvedFontWeight = computed(() => {
  const value = String(terminalAppearance.value.fontWeight ?? '400')
  return ['300', '400', '500', '600', '700'].includes(value) ? value : '400'
})

const focusSearchInput = () => {
  nextTick(() => {
    if (searchInput.value) {
      searchInput.value.focus()
      searchInput.value.select()
    }
  })
}

const clearSearchDebounce = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
}

const openSearch = () => {
  showSearch.value = true
  closeContextMenu()
  searchMatchCount.value = 0
  currentMatchIndex.value = 0
  isSearchPending.value = Boolean(searchQuery.value)
  focusSearchInput()
}

const syncTerminalViewport = () => {
  nextTick(() => {
    if (!terminal || !fitAddon) return
    fitAddon.fit()
    refreshDisplay()
  })
}

const getHexLengthPerLine = () => {
  const terminalCols = terminal?.cols || 100
  const reservedCols = 18
  return Math.max(4, terminalCols - reservedCols)
}

const getLogPrefix = (type) => {
  const prefixes = {
    tx: '[TX]',
    rx: '[RX]',
    info: '[INFO]',
    success: '[OK]',
    error: '[ERR]',
    warning: '[WARN]'
  }
  return prefixes[type] || '[INFO]'
}

const clearFormattedLogCache = () => {
  formattedLogCache.clear()
}

const buildLogCacheKey = (log) => {
  return [
    log.id,
    portDisplaySettings.value.hexReceive ? 'hex' : 'text',
    portDisplaySettings.value.showAscii ? 'ascii' : 'plain',
    portDisplaySettings.value.alignHexContinuation ? 'aligned' : 'single',
    getHexLengthPerLine()
  ].join(':')
}

const formatAlignedHexContent = (hexData, prefixWidth, asciiSuffix = '') => {
  const terminalCols = terminal?.cols || 100
  const indentWidth = Math.max(0, prefixWidth)
  const continuationIndent = ' '.repeat(indentWidth)
  const availableCols = Math.max(8, terminalCols - indentWidth)
  const hexBytes = hexData.split(' ')
  const bytesPerLine = Math.max(1, Math.floor((availableCols + 1) / 3))
  const lines = []

  for (let i = 0; i < hexBytes.length; i += bytesPerLine) {
    const segment = hexBytes.slice(i, i + bytesPerLine).join(' ')
    lines.push(i === 0 ? segment : `${continuationIndent}${segment}`)
  }

  if (asciiSuffix) {
    if (lines.length === 0) {
      return asciiSuffix
    }
    const singleLineCandidate = `${lines[0]} ${asciiSuffix}`
    if (lines.length === 1 && singleLineCandidate.length <= availableCols) {
      lines[0] += ` ${asciiSuffix}`
    } else {
      lines.push(`${continuationIndent}${asciiSuffix}`)
    }
  }

  return lines.join('\n')
}

const formatLogLine = (log) => {
  const cacheKey = buildLogCacheKey(log)
  const cachedLine = formattedLogCache.get(cacheKey)
  if (cachedLine) {
    return cachedLine
  }

  const timestamp = `[${log.timestamp.padEnd(8)}]`
  const prefix = getLogPrefix(log.type)
  const prefixText = `${timestamp} ${prefix} `

  let content = ''
  if (portDisplaySettings.value.hexReceive && log.hexData) {
    const hexData = log.hexData
    const asciiSuffix = portDisplaySettings.value.showAscii
      ? ` [${hexData.split(' ').map((h) => {
          const code = parseInt(h, 16)
          return code >= 32 && code <= 126 ? String.fromCharCode(code) : '.'
        }).join('')}]`
      : ''

    content = portDisplaySettings.value.alignHexContinuation
      ? formatAlignedHexContent(hexData, prefixText.length, asciiSuffix)
      : `${hexData}${asciiSuffix}`
  } else {
    content = log.message
  }

  const colorCodes = {
    tx: '\x1b[38;5;39m',
    rx: '\x1b[38;5;40m',
    info: '\x1b[38;5;252m',
    success: '\x1b[38;5;71m',
    error: '\x1b[38;5;196m',
    warning: '\x1b[38;5;214m'
  }

  const timestampColor = '\x1b[38;2;103;136;153m'
  const reset = '\x1b[0m'
  const color = colorCodes[log.type] || colorCodes.info
  const formattedLine = `${timestampColor}${timestamp}${reset} ${color}${prefix}${reset} ${content}`

  formattedLogCache.set(cacheKey, formattedLine)
  if (formattedLogCache.size > MAX_LOG_COUNT * 8) {
    formattedLogCache.clear()
  }

  return formattedLine
}

const getTerminalTheme = () => ({
  background: terminalAppearance.value.terminalBackground,
  foreground: terminalAppearance.value.terminalForeground,
  cursor: terminalAppearance.value.cursorColor,
  cursorAccent: terminalAppearance.value.terminalBackground,
  selection: effectiveSelectionStyle.value.background,
  selectionInactiveBackground: effectiveSelectionStyle.value.inactiveBackground,
  selectionForeground: effectiveSelectionStyle.value.foreground,
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
})

const getSearchOptions = () => ({
  caseSensitive: searchCaseSensitive.value,
  wholeWord: searchWholeWord.value,
  regex: searchUseRegex.value,
  decorations: {
    matchBackground: effectiveSearchPalette.value.matchBackground,
    matchBorder: effectiveSearchPalette.value.matchBorder,
    matchOverviewRuler: effectiveSearchPalette.value.overviewRuler,
    activeMatchBackground: effectiveSearchPalette.value.activeMatchBackground,
    activeMatchBorder: effectiveSearchPalette.value.activeMatchBorder,
    activeMatchColorOverviewRuler: effectiveSearchPalette.value.overviewRuler
  }
})

const resetSearchResults = () => {
  searchMatchCount.value = 0
  currentMatchIndex.value = 0
  isSearchPending.value = false
}

const isSearchPatternValid = () => {
  if (!searchUseRegex.value || !searchQuery.value) {
    searchError.value = ''
    return true
  }

  try {
    new RegExp(searchQuery.value)
    searchError.value = ''
    return true
  } catch {
    searchError.value = '正则表达式无效'
    return false
  }
}

const clearSearchHighlights = () => {
  if (terminal) {
    terminal.clearSelection()
  }
  if (searchAddon?.clearDecorations) {
    searchAddon.clearDecorations()
  }
}

const refreshSearchResults = () => {
  if (!showSearch.value || !searchQuery.value || !terminal || !searchAddon) return
  if (!isSearchPatternValid()) {
    resetSearchResults()
    clearSearchHighlights()
    return
  }
  isSearchPending.value = true
  nextTick(() => {
    searchAddon.findNext(searchQuery.value, getSearchOptions())
  })
}

const performSearch = () => {
  if (!terminal || !searchAddon) {
    searchMatchCount.value = 0
    currentMatchIndex.value = 0
    isSearchPending.value = false
    return
  }

  if (!searchQuery.value) {
    searchError.value = ''
    clearSearchHighlights()
    resetSearchResults()
    return
  }

  if (!isSearchPatternValid()) {
    resetSearchResults()
    clearSearchHighlights()
    return
  }

  clearSearchHighlights()
  isSearchPending.value = true
  searchAddon.findNext(searchQuery.value, getSearchOptions())
}

const debouncedSearch = () => {
  clearSearchDebounce()
  isSearchPending.value = Boolean(searchQuery.value)
  searchDebounceTimer = setTimeout(() => {
    performSearch()
  }, 150)
}

const goToNextMatch = () => {
  if (!canNavigateSearchMatches.value || !terminal || !searchAddon) return
  searchAddon.findNext(searchQuery.value, getSearchOptions())
}

const goToPreviousMatch = () => {
  if (!canNavigateSearchMatches.value || !terminal || !searchAddon) return
  searchAddon.findPrevious(searchQuery.value, getSearchOptions())
}

const handleSearchKeyDown = (event) => {
  if (event.key !== 'Enter') return

  if (event.shiftKey) {
    goToPreviousMatch()
    return
  }

  goToNextMatch()
}

const clearSearch = () => {
  showSearch.value = false
  searchQuery.value = ''
  searchCaseSensitive.value = false
  searchWholeWord.value = false
  searchUseRegex.value = false
  searchError.value = ''
  resetSearchResults()
  clearSearchDebounce()
  clearSearchHighlights()
}

const applyTerminalAppearance = () => {
  if (!terminal) return
  terminal.options.theme = getTerminalTheme()
  terminal.options.fontSize = resolvedFontSize.value
  terminal.options.fontWeight = resolvedFontWeight.value
  terminal.options.fontWeightBold = resolvedFontWeight.value === '700' ? '800' : '700'
  fitAddon?.fit()
  refreshSearchResults()
}

const loadHistoryLogs = () => {
  if (!terminal || !portLogs.value) return

  const logs = portLogs.value
  logEntries = []
  terminal.clear()

  const startIdx = Math.max(0, logs.length - MAX_LOG_COUNT)
  const lines = []
  for (let i = startIdx; i < logs.length; i++) {
    const log = logs[i]
    const line = formatLogLine(log)
    lines.push(line)
    logEntries.push({
      id: log.id,
      line: i - startIdx
    })
  }

  if (lines.length > 0) {
    terminal.write(`${lines.join('\r\n')}\r\n`)
  }

  const renderedLogs = logs.slice(startIdx)
  renderedLogCount = logs.length
  renderedFirstLogId = renderedLogs[0]?.id ?? null
  renderedLastLogId = renderedLogs[renderedLogs.length - 1]?.id ?? null
  terminal.scrollToBottom()
}

const addLogEntry = (log) => {
  if (!terminal) return

  const line = formatLogLine(log)
  terminal.writeln(line)
  logEntries.push({
    id: log.id,
    line: terminal.rows - 1
  })

  if (logEntries.length > MAX_LOG_COUNT) {
    logEntries.shift()
  }

  if (portControlSettings.value.isAutoScroll) {
    terminal.scrollToBottom()
  }
}

const resetRenderedLogState = () => {
  renderedLogCount = 0
  renderedFirstLogId = null
  renderedLastLogId = null
}

const syncTerminalLogs = () => {
  if (!terminal) return

  const logs = portLogs.value || []
  if (logs.length === 0) {
    terminal.clear()
    logEntries = []
    clearFormattedLogCache()
    resetRenderedLogState()
    performSearch()
    return
  }

  const currentFirstLogId = logs[0]?.id ?? null
  const currentLastLogId = logs[logs.length - 1]?.id ?? null
  const canAppendIncrementally =
    renderedLogCount > 0 &&
    currentFirstLogId === renderedFirstLogId &&
    logs.length >= renderedLogCount

  if (!canAppendIncrementally) {
    loadHistoryLogs()
    refreshSearchResults()
    return
  }

  for (let i = renderedLogCount; i < logs.length; i++) {
    addLogEntry(logs[i])
  }

  renderedLogCount = logs.length
  renderedLastLogId = currentLastLogId
  refreshSearchResults()
}

const refreshDisplay = () => {
  if (!terminal) return
  loadHistoryLogs()
  refreshSearchResults()
}

const handleResize = () => {
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
  }

  resizeDebounceTimer = setTimeout(() => {
    if (fitAddon) {
      fitAddon.fit()
      nextTick(() => {
        refreshDisplay()
      })
    }
  }, 100)
}

const initResizeObserver = () => {
  if (!terminalContainer.value || resizeObserver) return

  resizeObserver = new ResizeObserver(() => {
    handleResize()
  })
  resizeObserver.observe(terminalContainer.value)
}

const normalizeCopiedSelection = (text) => {
  if (!text) return text
  if (!portDisplaySettings.value.hexReceive || !portDisplaySettings.value.alignHexContinuation) {
    return text
  }

  return text.replace(/\r?\n[ ]{2,}(?=[0-9A-Fa-f]{2}(?:\s|$))/g, ' ')
}

const copySelection = async () => {
  const text = normalizeCopiedSelection(terminal?.getSelection())
  if (text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
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

const copyVisibleScreen = async () => {
  if (!terminal?.buffer?.active) return

  const buffer = terminal.buffer.active
  const start = Math.max(buffer.viewportY || 0, 0)
  const end = Math.min(start + Math.max(terminal.rows || 0, 1) - 1, buffer.length - 1)
  const lines = []

  for (let lineIndex = start; lineIndex <= end; lineIndex++) {
    const line = buffer.getLine(lineIndex)
    if (!line) continue
    lines.push(line.translateToString(true))
  }

  const text = lines.join('\n').replace(/\n+$/g, '')
  if (!text) {
    showContextMenu.value = false
    return
  }

  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }

  showContextMenu.value = false
}

const copyAllLogs = async () => {
  const text = serialStore.buildPortPlainTextExport(props.portPath)
  if (!text) {
    serialStore.setPortNotice(props.portPath, 'warning', '当前没有可复制的日志内容')
    closeContextMenu()
    return
  }

  await copyTextToClipboard(text)
  serialStore.setPortNotice(props.portPath, 'success', '已复制全部日志')
  closeContextMenu()
}

const openSearchFromContextMenu = () => {
  openSearch()
}

const selectAllTerminal = (closeMenu = false) => {
  if (!terminal) return
  terminal.focus()
  terminal.selectAll()
  selectedText.value = terminal.getSelection()?.trim() || ''
  if (closeMenu) {
    showContextMenu.value = false
  }
}

const selectAll = () => {
  selectAllTerminal(true)
}

const clearTerminalLogs = () => {
  serialStore.clearPortLogs(props.portPath)
  closeContextMenu()
}

const exportTerminalLogs = async (format = 'json') => {
  const isText = format === 'text'
  const payload = isText
    ? serialStore.buildPortPlainTextExport(props.portPath)
    : serialStore.buildPortLogExport(props.portPath)
  const suggestedName = `${props.portPath.replace(/[\\/:*?"<>|]/g, '_')}-logs-${new Date().toISOString().slice(0, 10)}.${isText ? 'txt' : 'json'}`
  const result = await window.electronAPI?.exportLogs(payload, suggestedName)

  if (!result || result.canceled) {
    closeContextMenu()
    return
  }

  if (!result.success) {
    serialStore.setPortNotice(props.portPath, 'error', result.error || '导出日志失败')
    closeContextMenu()
    return
  }

  serialStore.setPortNotice(props.portPath, 'success', `${isText ? '纯文本' : '日志'}已导出到 ${result.filePath}`)
  closeContextMenu()
}

const closeContextMenu = (event) => {
  if (event?.target?.closest('.context-menu')) return
  showContextMenu.value = false
  selectedText.value = ''
}

const clampContextMenuPosition = () => {
  const menu = contextMenuRef.value
  if (!menu || !showContextMenu.value) return

  const margin = 12
  const rect = menu.getBoundingClientRect()
  const maxX = Math.max(margin, window.innerWidth - rect.width - margin)
  const maxY = Math.max(margin, window.innerHeight - rect.height - margin)

  contextMenuPosition.value = {
    x: Math.min(Math.max(margin, contextMenuPosition.value.x), maxX),
    y: Math.min(Math.max(margin, contextMenuPosition.value.y), maxY)
  }
}

const handleContextMenu = async (event) => {
  event.preventDefault()
  selectedText.value = terminal?.getSelection()?.trim() || ''
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  showContextMenu.value = true
  await nextTick()
  clampContextMenuPosition()
}

const handleGlobalKeyDown = (event) => {
  if (showSearch.value && event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    clearSearch()
    return
  }

  if (searchQuery.value && event.key === 'F3') {
    event.preventDefault()
    event.stopPropagation()
    if (event.shiftKey) {
      goToPreviousMatch()
    } else {
      goToNextMatch()
    }
  }
}

const handleOpenSearch = (event) => {
  const targetPortPath = event?.detail?.portPath
  if (targetPortPath && targetPortPath !== props.portPath) return
  serialStore.selectedPort = props.portPath
  openSearch()
}

const handleSelectAllRequest = (event) => {
  const targetPortPath = event?.detail?.portPath
  if (targetPortPath && targetPortPath !== props.portPath) return
  serialStore.selectedPort = props.portPath
  selectAllTerminal()
}

const isEditableTarget = (target) => {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

const handleKeyDown = (event) => {
  if (isEditableTarget(event.target)) {
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && serialStore.selectedPort === props.portPath) {
    const selection = terminal?.getSelection()
    if (selection) {
      event.preventDefault()
      event.stopPropagation()
      copySelection()
    }
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && serialStore.selectedPort === props.portPath) {
    event.preventDefault()
    event.stopPropagation()
    openSearch()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && serialStore.selectedPort === props.portPath) {
    event.preventDefault()
    event.stopPropagation()
    selectAllTerminal()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c' && serialStore.selectedPort === props.portPath) {
    event.preventDefault()
    event.stopPropagation()
    copyVisibleScreen()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a' && serialStore.selectedPort === props.portPath) {
    event.preventDefault()
    event.stopPropagation()
    copyAllLogs()
  }
}

const initTerminal = () => {
  if (!terminalContainer.value) return

  terminal = new Terminal({
    allowProposedApi: true,
    fontSize: resolvedFontSize.value,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontWeight: resolvedFontWeight.value,
    fontWeightBold: resolvedFontWeight.value === '700' ? '800' : '700',
    theme: getTerminalTheme(),
    scrollback: 1000,
    convertEol: true,
    cursorBlink: false,
    disableStdin: true
  })

  fitAddon = new FitAddon()
  searchAddon = new SearchAddon({
    highlightLimit: 1000
  })

  terminal.loadAddon(fitAddon)
  terminal.loadAddon(searchAddon)
  terminal.open(terminalContainer.value)
  fitAddon.fit()

  terminal.attachCustomKeyEventHandler((event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && terminal?.hasSelection()) {
      copySelection()
      return false
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      serialStore.selectedPort = props.portPath
      openSearch()
      return false
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      selectAllTerminal()
      return false
    }
    return true
  })

  loadHistoryLogs()

  searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
    searchMatchCount.value = resultCount
    currentMatchIndex.value = resultIndex >= 0 ? resultIndex + 1 : 0
    isSearchPending.value = false
  })

  window.addEventListener('resize', handleResize)
}

watch(searchQuery, () => {
  debouncedSearch()
})

watch([searchCaseSensitive, searchWholeWord, searchUseRegex], () => {
  performSearch()
})

watch(showSearch, (visible) => {
  syncTerminalViewport()
  if (visible) {
    focusSearchInput()
    return
  }

  nextTick(() => {
    terminal?.focus()
  })
})

watch(() => {
  const logs = portLogs.value || []
  return `${logs.length}:${logs[0]?.id ?? ''}:${logs[logs.length - 1]?.id ?? ''}`
}, () => {
  syncTerminalLogs()
})

watch(portDisplaySettings, () => {
  clearFormattedLogCache()
  refreshDisplay()
}, { deep: true })

watch(terminalAppearance, () => {
  applyTerminalAppearance()
}, { deep: true })

watch(() => portDisplaySettings.value.hexReceive, () => {
  clearFormattedLogCache()
  refreshDisplay()
})

onMounted(() => {
  nextTick(() => {
    initTerminal()
    initResizeObserver()
  })

  document.addEventListener('keydown', handleGlobalKeyDown, true)
  document.addEventListener('keydown', handleKeyDown, true)
  document.addEventListener('click', closeContextMenu)
  window.addEventListener('serialx-open-search', handleOpenSearch)
  window.addEventListener('serialx-select-all', handleSelectAllRequest)
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('scroll', closeContextMenu, true)

  if (terminalContainer.value) {
    terminalContainer.value.addEventListener('contextmenu', handleContextMenu)
  }
})

onUnmounted(() => {
  clearSearchDebounce()
  resetRenderedLogState()

  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
    resizeDebounceTimer = null
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  document.removeEventListener('keydown', handleGlobalKeyDown, true)
  document.removeEventListener('keydown', handleKeyDown, true)
  document.removeEventListener('click', closeContextMenu)
  window.removeEventListener('serialx-open-search', handleOpenSearch)
  window.removeEventListener('serialx-select-all', handleSelectAllRequest)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('resize', closeContextMenu)
  window.removeEventListener('scroll', closeContextMenu, true)

  if (terminalContainer.value) {
    terminalContainer.value.removeEventListener('contextmenu', handleContextMenu)
  }

  if (terminal) {
    terminal.dispose()
    terminal = null
  }
})

defineExpose({
  refreshDisplay
})
</script>

<template>
  <div :class="['terminal-wrapper', `theme-${themeMode}`]" :style="terminalCssVars">
    <div v-if="showSearch" class="search-bar">
      <div class="search-widget">
        <div class="search-input-wrapper">
          <label class="search-chip" :for="searchInputId">查找</label>
          <input
            :id="searchInputId"
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索终端内容..."
            :aria-describedby="`${searchStatusId} ${searchCountId}`"
            @keydown.enter.prevent="handleSearchKeyDown"
          />
          <span
            :id="searchStatusId"
            :class="['search-status', { empty: isSearchEmpty }]"
            role="status"
            aria-live="polite"
          >
            {{ searchStatusText }}
          </span>
          <button
            :class="['search-toggle', { active: searchCaseSensitive }]"
            type="button"
            :aria-pressed="searchCaseSensitive"
            title="区分大小写"
            aria-label="切换区分大小写搜索"
            @click="searchCaseSensitive = !searchCaseSensitive"
          >
            Aa
          </button>
          <button
            :class="['search-toggle', { active: searchWholeWord }]"
            type="button"
            :aria-pressed="searchWholeWord"
            title="全字匹配"
            aria-label="切换全字匹配搜索"
            @click="searchWholeWord = !searchWholeWord"
          >
            W
          </button>
          <button
            :class="['search-toggle', { active: searchUseRegex }]"
            type="button"
            :aria-pressed="searchUseRegex"
            title="正则表达式"
            aria-label="切换正则表达式搜索"
            @click="searchUseRegex = !searchUseRegex"
          >
            .*
          </button>
          <div class="search-controls">
            <span
              :id="searchCountId"
              class="search-count"
              role="status"
              aria-live="polite"
            >
              {{ !searchQuery ? '' : (searchMatchCount > 0 ? `${currentMatchIndex} / ${searchMatchCount}` : '0 / 0') }}
            </span>
            <button
              class="search-btn"
              :disabled="!canNavigateSearchMatches"
              title="上一个匹配 (Shift+Enter / Shift+F3)"
              aria-label="上一个搜索匹配"
              @click="goToPreviousMatch"
            >
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                <path d="M6 3 2 7h8Z" fill="currentColor" />
              </svg>
            </button>
            <button
              class="search-btn"
              :disabled="!canNavigateSearchMatches"
              title="下一个匹配 (Enter / F3)"
              aria-label="下一个搜索匹配"
              @click="goToNextMatch"
            >
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                <path d="M6 9 10 5H2Z" fill="currentColor" />
              </svg>
            </button>
            <button class="search-btn close" title="关闭 (Esc)" aria-label="关闭终端搜索" @click="clearSearch">
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                <path d="M2 2 10 10M10 2 2 10" stroke="currentColor" stroke-width="1.2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showContextMenu"
        ref="contextMenuRef"
        class="context-menu"
        :style="{ left: `${contextMenuPosition.x}px`, top: `${contextMenuPosition.y}px` }"
        @click.stop
      >
        <div class="context-menu-item" @click="openSearchFromContextMenu">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.3" />
              <path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            </svg>
          </span>
          <span>查找</span>
        </div>
        <div class="context-menu-item" :class="{ disabled: !selectedText }" @click="selectedText && copySelection()">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M6 3h7v10H6z" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path d="M3 6h7v7H3z" fill="none" stroke="currentColor" stroke-width="1.2" />
            </svg>
          </span>
          <span>复制</span>
        </div>
        <div class="context-menu-item" @click="copyVisibleScreen">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M3 4h10v8H3z" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path d="M5 6h6M5 8h6M5 10h4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
          </span>
          <span>复制当前屏幕</span>
        </div>
        <div class="context-menu-item" @click="copyAllLogs">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M4 3h8v10H4z" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path d="M6 6h4M6 8h4M6 10h4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
          </span>
          <span>复制全部日志</span>
        </div>
        <div class="context-menu-item" @click="selectAll">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M3 3h10v10H3z" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path d="M5 5h6v6H5z" fill="none" stroke="currentColor" stroke-width="1.2" />
            </svg>
          </span>
          <span>全选</span>
        </div>
        <div class="context-menu-item" @click="exportTerminalLogs('json')">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M8 2v7.2l2.1-2.1.9.9L8 11 5 8l.9-.9L8 9.2V2Z" fill="currentColor" />
              <path d="M3 12h10v2H3z" fill="currentColor" />
            </svg>
          </span>
          <span>导出日志 (JSON)</span>
        </div>
        <div class="context-menu-item" @click="exportTerminalLogs('text')">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M4 3h8v10H4z" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path d="M6 6h4M6 8h4M6 10h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
          </span>
          <span>导出纯文本 (TXT)</span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" @click="clearTerminalLogs">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M5 4h6l-.5 9h-5z" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path d="M4 4h8M6 4V2h4v2" fill="none" stroke="currentColor" stroke-width="1.2" />
            </svg>
          </span>
          <span>清空日志</span>
        </div>
      </div>
    </Teleport>

    <div ref="terminalContainer" class="terminal-container"></div>
  </div>
</template>

<style scoped>
.terminal-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
  background-color: var(--terminal-surface-bg);
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid var(--terminal-frame-border);
  background-image: linear-gradient(180deg, var(--terminal-frame-bg), var(--terminal-frame-bg));
  box-shadow: var(--terminal-inner-shadow);
}

.search-bar {
  flex-shrink: 0;
  padding: 10px 12px 0;
}

.terminal-container {
  flex: 1;
  width: 100%;
  position: relative;
  padding: 8px 10px;
  box-sizing: border-box;
  overflow: hidden;
  min-height: 0;
}

.terminal-container {
  --terminal-scrollbar-width: 14px;
}

.terminal-container ::v-deep(.xterm-viewport) {
  width: 100% !important;
  background-color: var(--terminal-background) !important;
  border-left: none !important;
  pointer-events: auto !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar) {
  width: var(--terminal-scrollbar-width) !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: var(--terminal-background) !important;
  border: none !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: #424242 !important;
  border-radius: 7px !important;
  border: 2px solid var(--terminal-background) !important;
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

.terminal-container ::v-deep(.xterm) {
  background: transparent !important;
  width: 100% !important;
  height: 100% !important;
}

.terminal-container ::v-deep(.xterm .xterm-screen),
.terminal-container ::v-deep(.xterm .xterm-screen canvas),
.terminal-container ::v-deep(.xterm .xterm-rows),
.terminal-container ::v-deep(.xterm .xterm-scroll-area) {
  width: calc(100% - var(--terminal-scrollbar-width)) !important;
  max-width: calc(100% - var(--terminal-scrollbar-width)) !important;
}

.terminal-container ::v-deep(.xterm-rows > div) {
  width: auto !important;
  max-width: 100% !important;
}

.terminal-container ::v-deep(.xterm-find-match) {
  background-color: transparent !important;
  color: var(--search-match-text-color) !important;
  font-weight: 700;
  box-shadow: var(--search-match-shadow);
  border-radius: 0.08em;
}

.terminal-container ::v-deep(.xterm-find-match-current) {
  background-color: transparent !important;
  color: var(--search-current-match-text-color) !important;
  font-weight: 700;
  box-shadow: var(--search-current-match-shadow);
  border-radius: 0.1em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.42);
}

.terminal-container ::v-deep(span.xterm-highlight) {
  background-color: transparent !important;
  color: var(--search-match-text-color) !important;
  box-shadow: var(--search-match-shadow);
  border-radius: 0.08em;
  font-weight: 700;
}

.terminal-container ::v-deep(.xterm .xterm-selection-match) {
  background-color: transparent !important;
  color: var(--search-match-text-color) !important;
  box-shadow: var(--search-match-shadow);
  font-weight: 700;
}

.terminal-container ::v-deep(.xterm .xterm-selection div) {
  background-color: var(--terminal-selection-bg) !important;
  box-shadow: var(--terminal-selection-shadow);
}

.terminal-container ::v-deep(.xterm-decoration-top) {
  background-color: transparent !important;
}

.search-widget {
  display: inline-flex;
  margin-left: auto;
  padding: 5px 6px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-modal-bg);
  box-shadow: var(--app-shadow-lg);
  backdrop-filter: blur(12px);
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-chip {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  height: 24px;
  border-radius: 999px;
  background: var(--app-accent-soft);
  color: var(--app-chip-text);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.search-input {
  width: 180px;
  height: 24px;
  padding: 0 10px;
  background: var(--app-workspace-shell);
  border: 1px solid var(--app-border);
  border-radius: 999px;
  color: var(--app-text);
  font-size: 12px;
  font-family: Consolas, "Monaco", monospace;
  outline: none;
}

.search-input:focus {
  border-color: var(--app-accent);
}

.search-input::placeholder {
  color: var(--app-text-soft);
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-status {
  display: inline-flex;
  align-items: center;
  min-width: 96px;
  padding: 0 6px;
  height: 22px;
  border-radius: 999px;
  background: var(--app-workspace-shell);
  color: var(--app-text-soft);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.search-status.empty {
  background: var(--app-danger-soft);
  color: var(--app-danger-text);
}

.search-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-chip-bg);
  color: var(--app-text-soft);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.16s ease;
}

.search-toggle:hover {
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
  color: var(--app-text);
}

.search-toggle.active {
  background: var(--app-accent);
  border-color: var(--app-accent);
  color: var(--app-accent-contrast);
}

.search-count {
  min-width: 52px;
  padding: 0 2px;
  text-align: right;
  color: var(--app-text-soft);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.search-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--app-chip-bg);
  border: 1px solid var(--app-border);
  border-radius: 999px;
  color: var(--app-text);
  cursor: pointer;
  font-size: 11px;
  padding: 0;
  transition: all 0.16s ease;
}

.search-btn:hover:not(:disabled) {
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
}

.search-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.search-btn.close:hover {
  background: var(--app-danger-soft);
  border-color: var(--app-danger-border);
}

.context-menu {
  position: fixed;
  min-width: 148px;
  padding: 6px;
  border-radius: 10px;
  background: var(--app-modal-bg);
  border: 1px solid var(--app-modal-border);
  box-shadow: var(--app-shadow-lg);
  backdrop-filter: blur(14px);
  z-index: 10000;
  animation: fadeIn 0.14s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  color: var(--app-text);
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.context-menu-item:hover {
  background: var(--app-accent-soft);
  color: var(--app-text);
}

.context-menu-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.context-menu-item.disabled:hover {
  background: transparent;
  color: var(--app-text);
}

.context-menu-item.danger:hover {
  background: var(--app-danger);
}

.context-menu-divider {
  height: 1px;
  margin: 6px 2px;
  background: var(--app-border);
}

.menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.theme-light.terminal-wrapper {
  border-color: rgba(0, 102, 153, 0.12);
  box-shadow: none;
}

.theme-light .terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: #c5d8e8 !important;
}

.theme-light .terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background: #b3cddd !important;
}

.theme-light .terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb:active) {
  background: #a4c1d6 !important;
}

.theme-light .terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-corner) {
  background: var(--app-modal-bg) !important;
}

.theme-light .search-widget,
.theme-light .context-menu {
  background: var(--app-modal-bg);
  border-color: rgba(0, 102, 153, 0.14);
  box-shadow: 0 12px 28px rgba(31, 35, 40, 0.08);
}

.theme-light .search-chip {
  background: rgba(0, 120, 212, 0.08);
  color: #005fb8;
}

.theme-light .search-input,
.theme-light .search-btn,
.theme-light .context-menu-item {
  background: var(--app-modal-bg);
  border-color: rgba(0, 102, 153, 0.12);
  color: #1f2328;
}

.theme-light .search-input::placeholder,
.theme-light .search-count {
  color: #6b7785;
}

.theme-light .search-btn:hover,
.theme-light .context-menu-item:hover {
  background: rgba(0, 120, 212, 0.08);
  border-color: rgba(0, 120, 212, 0.16);
  color: #1f2328;
}

.theme-light .context-menu-item.disabled:hover {
  background: transparent;
  color: #1f2328;
}

.theme-light .context-menu-divider {
  background: rgba(0, 102, 153, 0.12);
}
</style>
