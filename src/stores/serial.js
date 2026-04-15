import { defineStore } from 'pinia'
import { ref, computed, watch, reactive } from 'vue'

export const useSerialStore = defineStore('serial', () => {
  const SETTINGS_SNAPSHOT_VERSION = 1

  const createTerminalAppearancePreset = (mode = 'dark') => {
    if (mode === 'light') {
      return {
        terminalBackground: '#fbfcfe',
        terminalForeground: '#1f2937',
        fontSize: 13,
        fontWeight: '400',
        cursorColor: '#2563eb',
        selectionColor: 'rgba(37, 99, 235, 0.16)',
        searchMatchColor: 'rgba(96, 165, 250, 0.18)',
        searchMatchTextColor: '#1e3a8a',
        searchCurrentMatchColor: 'rgba(37, 99, 235, 0.22)',
        searchCurrentMatchTextColor: '#1d4ed8',
        searchLineHighlightColor: 'rgba(37, 99, 235, 0.05)'
      }
    }

    return {
      terminalBackground: '#0b1020',
      terminalForeground: '#eef2ff',
      fontSize: 13,
      fontWeight: '400',
      cursorColor: '#5ea0ff',
      selectionColor: 'rgba(94, 160, 255, 0.16)',
      searchMatchColor: 'rgba(30, 41, 59, 0.88)',
      searchMatchTextColor: '#dbe7ff',
      searchCurrentMatchColor: 'rgba(94, 160, 255, 0.24)',
      searchCurrentMatchTextColor: '#f8fbff',
      searchLineHighlightColor: 'rgba(94, 160, 255, 0.08)'
    }
  }

  const createDefaultTerminalAppearance = () => createTerminalAppearancePreset('dark')
  const createAppThemePreset = (mode = 'dark') => {
    if (mode === 'light') {
      return {
        background: '#f5f7fb',
        headerBg: '#fbfcfe',
        menuBg: '#ffffff',
        sidebarShell: '#f7f8fc',
        sidebarSurface: '#fcfdff',
        workspaceShell: '#f4f6fb',
        workspaceSurface: '#ffffff',
        statusBarBg: '#f8f9fd',
        text: '#111827',
        textSoft: '#6b7280',
        border: '#d8deea',
        accent: '#2563eb',
        accentText: '#1d4ed8'
      }
    }

    return {
      background: '#080b14',
      headerBg: '#0d1220',
      menuBg: '#111827',
      sidebarShell: '#0d1220',
      sidebarSurface: '#121a2b',
      workspaceShell: '#090f1d',
      workspaceSurface: '#121a2b',
      statusBarBg: '#0d1220',
      text: '#f9fafb',
      textSoft: '#94a3b8',
      border: '#273248',
      accent: '#5ea0ff',
      accentText: '#dbeafe'
    }
  }
  const createDefaultAppTheme = () => createAppThemePreset('dark')
  const createDefaultCustomAppearancePresets = () => []
  const normalizeThemeSchemeId = (mode = '', fallbackMode = 'dark') => {
    if (typeof mode === 'string' && (mode === 'preset-light' || mode === 'preset-dark' || mode.startsWith('custom:'))) {
      return mode
    }

    return `preset-${fallbackMode === 'light' ? 'light' : 'dark'}`
  }
  const resolveThemeModeFromSchemeId = (schemeId = '', fallbackMode = 'dark') => {
    if (schemeId === 'preset-light') return 'light'
    if (schemeId === 'preset-dark') return 'dark'
    return fallbackMode === 'light' ? 'light' : 'dark'
  }
  const buildAppUiStateWithThemeScheme = (state = {}) => {
    const activeThemeSchemeId = normalizeThemeSchemeId(
      state.activeThemeSchemeId || state.terminalAppearanceMode || state.appThemeMode,
      state.themeMode === 'light' ? 'light' : 'dark'
    )
    const themeMode = resolveThemeModeFromSchemeId(
      activeThemeSchemeId,
      state.themeMode === 'light' ? 'light' : 'dark'
    )

    return {
      ...state,
      themeMode,
      activeThemeSchemeId,
      terminalAppearanceMode: activeThemeSchemeId,
      appThemeMode: activeThemeSchemeId
    }
  }
  const normalizeCustomAppearancePresets = (presets = []) => (
    Array.isArray(presets)
      ? presets
          .filter((preset) => preset && typeof preset === 'object' && typeof preset.id === 'string')
          .map((preset) => ({
            id: preset.id,
            name: typeof preset.name === 'string' && preset.name.trim() ? preset.name.trim() : '自定义方案',
            sourceMode: normalizeThemeSchemeId(preset.sourceMode || 'preset-dark'),
            appTheme: {
              ...createDefaultAppTheme(),
              ...(preset.appTheme && typeof preset.appTheme === 'object' ? preset.appTheme : {})
            },
            baseAppTheme: {
              ...createDefaultAppTheme(),
              ...(preset.baseAppTheme && typeof preset.baseAppTheme === 'object'
                ? preset.baseAppTheme
                : preset.appTheme && typeof preset.appTheme === 'object'
                  ? preset.appTheme
                  : {})
            },
            appearance: {
              ...createDefaultTerminalAppearance(),
              ...(preset.appearance && typeof preset.appearance === 'object' ? preset.appearance : {})
            },
            baseAppearance: {
              ...createDefaultTerminalAppearance(),
              ...(preset.baseAppearance && typeof preset.baseAppearance === 'object'
                ? preset.baseAppearance
                : preset.appearance && typeof preset.appearance === 'object'
                  ? preset.appearance
                  : {})
            }
          }))
      : []
  )
  const parseCustomAppearanceMode = (mode = '') => (
    typeof mode === 'string' && mode.startsWith('custom:')
      ? mode.slice('custom:'.length)
      : null
  )
  const resolveTerminalAppearanceForMode = (mode, appearance = {}) => {
    const presetMode = mode === 'preset-light' ? 'light' : mode === 'preset-dark' ? 'dark' : null
    if (presetMode) {
      return createTerminalAppearancePreset(presetMode)
    }

    return {
      ...createDefaultTerminalAppearance(),
      ...appearance
    }
  }
  const resolveAppThemeForMode = (mode, theme = {}) => {
    const presetMode = mode === 'preset-light' ? 'light' : mode === 'preset-dark' ? 'dark' : null
    if (presetMode) {
      return createAppThemePreset(presetMode)
    }

    return {
      ...createDefaultAppTheme(),
      ...theme
    }
  }
  const syncBuiltInThemeSchemeState = () => {
    const schemeId = normalizeThemeSchemeId(
      appUiState.value.activeThemeSchemeId || appUiState.value.terminalAppearanceMode || appUiState.value.appThemeMode,
      appUiState.value.themeMode || 'dark'
    )

    if (schemeId !== 'preset-light' && schemeId !== 'preset-dark') {
      return false
    }

    const nextAppTheme = createAppThemePreset(schemeId === 'preset-light' ? 'light' : 'dark')
    const nextTerminalAppearance = createTerminalAppearancePreset(schemeId === 'preset-light' ? 'light' : 'dark')

    const appThemeChanged = JSON.stringify(appTheme.value) !== JSON.stringify(nextAppTheme)
    const terminalAppearanceChanged = JSON.stringify(terminalAppearance.value) !== JSON.stringify(nextTerminalAppearance)
    const appUiStateChanged = appUiState.value.activeThemeSchemeId !== schemeId ||
      appUiState.value.terminalAppearanceMode !== schemeId ||
      appUiState.value.appThemeMode !== schemeId

    appTheme.value = nextAppTheme
    terminalAppearance.value = nextTerminalAppearance
    appUiState.value = buildAppUiStateWithThemeScheme({
      ...appUiState.value,
      activeThemeSchemeId: schemeId
    })

    return appThemeChanged || terminalAppearanceChanged || appUiStateChanged
  }

  const createDefaultSettings = () => ({
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none'
  })

  const createDefaultWorkspaceLayout = () => ({
    splitPanes: [{ tabs: [], activeTab: '' }],
    paneWidths: []
  })
  const createDefaultSavedWorkspaceSnapshots = () => []
  const createDefaultAutoLogSettings = () => ({
    enabled: true,
    directory: '',
    format: 'txt'
  })
  const normalizeAutoLogSettings = (settings = {}) => ({
    enabled: settings?.enabled !== false,
    directory: typeof settings?.directory === 'string' ? settings.directory : '',
    format: settings?.format === 'jsonl' ? 'jsonl' : 'txt'
  })

  const createDefaultAppUiState = () => ({
    sidebarCollapsed: false,
    themeMode: 'dark',
    activeThemeSchemeId: 'preset-dark',
    terminalAppearanceMode: 'preset-dark',
    appThemeMode: 'preset-dark',
    activeWorkspaceSnapshotId: '',
    wallpaperEnabled: false,
    wallpaperPath: '',
    wallpaperOpacity: 0.22,
    containerOpacity: 0.42,
    sidebarOpacity: 0.42,
    workspaceOpacity: 0.42,
    terminalOpacity: 0.34
  })

  const normalizeCommonCommands = (commands = []) => (
    Array.isArray(commands)
      ? commands
          .filter((cmd) => cmd && typeof cmd === 'object')
          .map((cmd, index) => ({
            id: cmd.id ?? Date.now() + index,
            name: typeof cmd.name === 'string' && cmd.name.trim() ? cmd.name.trim() : `命令 ${index + 1}`,
            command: typeof cmd.command === 'string' ? cmd.command : '',
            group: typeof cmd.group === 'string' && cmd.group.trim() ? cmd.group.trim() : '默认',
            enabled: cmd.enabled !== false
          }))
      : []
  )

  const createDefaultCommonCommands = () => normalizeCommonCommands([
    { id: 1, name: '复位', command: 'RESET', group: '设备控制', enabled: true },
    { id: 2, name: '状态查询', command: 'STATUS?', group: '查询', enabled: true },
    { id: 3, name: '版本信息', command: 'VERSION', group: '查询', enabled: true },
    { id: 4, name: '帮助', command: 'HELP', group: '查询', enabled: true }
  ])

  // State
  const ports = ref([])
  const selectedPort = ref(null)

  // 多串口支持：每个串口独立的状态
  const openPorts = ref(new Map()) // path -> { baudRate, dataBits, stopBits, parity, isConnected }
  const portLogs = ref(new Map())  // path -> log array
  const portSettings = ref(new Map()) // path -> settings object
  const portSendingData = ref(new Map()) // path -> sending data string
  const portSendHistory = ref(new Map()) // path -> string[]
  const portFilters = ref(new Map()) // path -> { enabled, mode, matchMode, pattern } mode: 'discard', matchMode: 'keyword' | 'regex'

  // 当前选中的串口设置（用于新建连接）
  const defaultSettings = ref(createDefaultSettings())

  // 全局配置
  const logs = ref([])
  const portLoopSendTimers = reactive(new Map()) // path -> timeout id
  const portLoopSendInFlight = reactive(new Map()) // path -> whether send is in progress
  const portLoopSendCounts = reactive(new Map()) // path -> 已发送次数
  const portLoopSendPaused = reactive(new Map()) // path -> 是否暂停
  const portLoopSendFailures = reactive(new Map()) // path -> consecutive failure count
  const portManualDisconnects = reactive(new Set())

  // 每个串口的显示设置（独立配置）
  const portDisplaySettings = ref(new Map()) // path -> { hexReceive: boolean, showAscii: boolean, alignHexContinuation: boolean }

  // 每个串口的控制设置（独立配置）
  const portControlSettings = ref(new Map()) // path -> { isAutoScroll: boolean, isLoopSend: boolean, loopInterval: number, loopMaxCount: number, hexSend: boolean, packetTimeout: number }
  const appTheme = ref(createDefaultAppTheme())
  const terminalAppearance = ref(createDefaultTerminalAppearance())
  const customAppearancePresets = ref(createDefaultCustomAppearancePresets())
  const workspaceLayout = ref(createDefaultWorkspaceLayout())
  const savedWorkspaceSnapshots = ref(createDefaultSavedWorkspaceSnapshots())
  const autoLogSettings = ref(createDefaultAutoLogSettings())
  const defaultLogDirectory = ref('')
  const appUiState = ref(createDefaultAppUiState())
  let isApplyingExternalUiSnapshot = false

  const syncWorkspaceSnapshotSelection = (preferredSnapshotId = null) => {
    const snapshotIds = new Set(savedWorkspaceSnapshots.value.map((item) => item.id))
    const currentSnapshotId = typeof appUiState.value.activeWorkspaceSnapshotId === 'string'
      ? appUiState.value.activeWorkspaceSnapshotId
      : ''
    const nextSnapshotId = typeof preferredSnapshotId === 'string'
      ? (snapshotIds.has(preferredSnapshotId) ? preferredSnapshotId : '')
      : (snapshotIds.has(currentSnapshotId) ? currentSnapshotId : '')

    if (currentSnapshotId === nextSnapshotId) {
      return false
    }

    appUiState.value = buildAppUiStateWithThemeScheme({
      ...appUiState.value,
      activeWorkspaceSnapshotId: nextSnapshotId
    })
    return true
  }

  const persistUiPreferencesToConfig = async () => {
    try {
      if (!window?.electronAPI?.loadConfig || !window?.electronAPI?.saveConfig) return
      const config = await window.electronAPI.loadConfig()
      config.appUiState = JSON.parse(JSON.stringify(appUiState.value))
      config.appTheme = JSON.parse(JSON.stringify(appTheme.value))
      config.terminalAppearance = JSON.parse(JSON.stringify(terminalAppearance.value))
      config.customAppearancePresets = JSON.parse(JSON.stringify(customAppearancePresets.value))
      config.savedWorkspaceSnapshots = JSON.parse(JSON.stringify(savedWorkspaceSnapshots.value))
      await window.electronAPI.saveConfig(config)
    } catch (error) {
      console.error('[Store] Error saving UI preferences:', error)
    }
  }

  let isRestoringSessionState = false
  let shouldSkipNextCommonCommandsSync = false

  const saveDefaultSettingsToConfig = async () => {
    try {
      if (!window?.electronAPI?.loadConfig || !window?.electronAPI?.saveConfig) return
      const config = await window.electronAPI.loadConfig()
      config.defaultSettings = JSON.parse(JSON.stringify(defaultSettings.value))
      await window.electronAPI.saveConfig(config)
    } catch (error) {
      console.error('[Store] Error saving default settings:', error)
    }
  }

  const loadDefaultLogDirectory = async () => {
    try {
      const result = await window?.electronAPI?.getDefaultLogDirectory?.()
      if (result?.success && typeof result.directoryPath === 'string') {
        defaultLogDirectory.value = result.directoryPath
      }
    } catch (error) {
      console.error('[Store] Error loading default log directory:', error)
    }
  }

  const saveAutoLogSettings = async () => {
    try {
      if (!window?.electronAPI?.loadConfig || !window?.electronAPI?.saveConfig) return
      const config = await window.electronAPI.loadConfig()
      config.autoLogSettings = JSON.parse(JSON.stringify(autoLogSettings.value))
      await window.electronAPI.saveConfig(config)
    } catch (error) {
      console.error('[Store] Error saving auto log settings:', error)
    }
  }

  const updateAutoLogSettings = (updates = {}) => {
    autoLogSettings.value = normalizeAutoLogSettings({
      ...autoLogSettings.value,
      ...updates
    })
  }

  const selectAutoLogDirectory = async () => {
    try {
      const currentPath = autoLogSettings.value.directory || defaultLogDirectory.value
      const result = await window?.electronAPI?.selectLogDirectory?.(currentPath)
      if (!result || result.canceled) return null
      if (!result.success) {
        throw new Error(result.error || '选择日志目录失败')
      }
      updateAutoLogSettings({ directory: result.directoryPath || '' })
      return result.directoryPath || ''
    } catch (error) {
      console.error('[Store] Error selecting auto log directory:', error)
      throw error
    }
  }

  const openAutoLogDirectory = async () => {
    try {
      const result = await window?.electronAPI?.openLogDirectory?.(autoLogSettings.value.directory || defaultLogDirectory.value)
      if (!result?.success) {
        throw new Error(result?.error || '打开日志目录失败')
      }
      return result.directoryPath || autoLogSettings.value.directory || defaultLogDirectory.value
    } catch (error) {
      console.error('[Store] Error opening auto log directory:', error)
      throw error
    }
  }

  const getResolvedAutoLogDirectory = () => autoLogSettings.value.directory || defaultLogDirectory.value || ''

  const buildUiSyncSnapshot = () => ({
    appUiState: JSON.parse(JSON.stringify(appUiState.value)),
    appTheme: JSON.parse(JSON.stringify(appTheme.value)),
    terminalAppearance: JSON.parse(JSON.stringify(terminalAppearance.value)),
    customAppearancePresets: JSON.parse(JSON.stringify(customAppearancePresets.value)),
    savedWorkspaceSnapshots: JSON.parse(JSON.stringify(savedWorkspaceSnapshots.value))
  })

  const pushUiSyncSnapshot = () => {
    if (isApplyingExternalUiSnapshot) return
    window?.electronAPI?.pushUiStateSnapshot?.(buildUiSyncSnapshot())
  }

  const applyExternalUiSyncSnapshot = (snapshot = {}) => {
    if (!snapshot || typeof snapshot !== 'object') return

    const nextAppUiState = snapshot.appUiState && typeof snapshot.appUiState === 'object'
      ? buildAppUiStateWithThemeScheme({
          ...createDefaultAppUiState(),
          ...snapshot.appUiState
        })
      : null
    const nextAppTheme = (snapshot.appTheme && typeof snapshot.appTheme === 'object') || nextAppUiState
      ? resolveAppThemeForMode(
          nextAppUiState?.activeThemeSchemeId || appUiState.value.activeThemeSchemeId,
          {
            ...appTheme.value,
            ...(snapshot.appTheme || {})
          }
        )
      : null

    const nextAppearance = (snapshot.terminalAppearance && typeof snapshot.terminalAppearance === 'object') || nextAppUiState
      ? resolveTerminalAppearanceForMode(
          nextAppUiState?.activeThemeSchemeId || appUiState.value.activeThemeSchemeId,
          {
            ...terminalAppearance.value,
            ...(snapshot.terminalAppearance || {})
          }
        )
      : null
    const nextCustomAppearancePresets = normalizeCustomAppearancePresets(snapshot.customAppearancePresets)

    isApplyingExternalUiSnapshot = true

    if (nextAppUiState) {
      appUiState.value = nextAppUiState
    }

    if (nextAppTheme) {
      appTheme.value = nextAppTheme
    }

    if (snapshot.customAppearancePresets) {
      customAppearancePresets.value = nextCustomAppearancePresets
    }

      if (nextAppearance) {
        terminalAppearance.value = nextAppearance
      }

    syncBuiltInThemeSchemeState()

    isApplyingExternalUiSnapshot = false
  }

  const setupUiSyncListeners = () => {
    window?.electronAPI?.onUiStateSnapshot?.((snapshot) => {
      applyExternalUiSyncSnapshot(snapshot)
    })

    window?.electronAPI?.getLatestUiStateSnapshot?.().then((snapshot) => {
      if (snapshot) {
        applyExternalUiSyncSnapshot(snapshot)
      }
    }).catch(() => {})
  }

  // 获取串口控制设置
  const getPortControlSettings = (portPath) => {
    if (!portControlSettings.value.has(portPath)) {
      portControlSettings.value.set(portPath, {
        isAutoScroll: true,
        isLoopSend: false,
        loopInterval: 1000,
        loopStartDelay: 0,
        loopMaxCount: 0,
        loopFailureLimit: 0,
        hexSend: false,
        packetTimeout: 500 // 分包超时时间（毫秒）
      })
    }
    return portControlSettings.value.get(portPath)
  }

  // 更新串口控制设置
  const updatePortControlSettings = (portPath, updates) => {
    const current = getPortControlSettings(portPath)
    const normalizedUpdates = { ...updates }

    if ('loopInterval' in normalizedUpdates) {
      normalizedUpdates.loopInterval = Math.max(1, Number(normalizedUpdates.loopInterval) || 1000)
    }

    portControlSettings.value.set(portPath, { ...current, ...normalizedUpdates })
    // 配置变更时自动保存
    saveSessionState()

    if (portLoopSendTimers.has(portPath) && ('loopInterval' in normalizedUpdates || 'loopStartDelay' in normalizedUpdates || 'loopMaxCount' in normalizedUpdates || 'loopFailureLimit' in normalizedUpdates || 'hexSend' in normalizedUpdates)) {
      restartLoopSendForPort(portPath, { preserveCount: true, silent: true })
    }
  }

  // 每个串口的统计数据
  const portStats = ref(new Map()) // path -> { txBytes: number, txCount: number, rxBytes: number, rxCount: number, startTime: string, lastCommTime: string }
  const portNotices = ref(new Map()) // path -> { type: 'info' | 'warning' | 'error' | 'success', message: string, updatedAt: number }

  // 获取串口统计数据
  const getPortStats = (portPath) => {
    if (!portStats.value.has(portPath)) {
      portStats.value.set(portPath, {
        txBytes: 0,
        txCount: 0,
        rxBytes: 0,
        rxCount: 0,
        startTime: new Date().toLocaleString(),
        lastCommTime: null
      })
    }
    return portStats.value.get(portPath)
  }

  // 更新串口统计数据
  const updatePortStats = (portPath, type, byteCount) => {
    const stats = getPortStats(portPath)
    stats.lastCommTime = new Date().toLocaleString()
    if (type === 'tx') {
      stats.txBytes += byteCount
      stats.txCount += 1
    } else if (type === 'rx') {
      stats.rxBytes += byteCount
      stats.rxCount += 1
    }
  }

  // 重置串口统计数据
  const resetPortStats = (portPath) => {
    portStats.value.set(portPath, {
      txBytes: 0,
      txCount: 0,
      rxBytes: 0,
      rxCount: 0,
      startTime: new Date().toLocaleString(),
      lastCommTime: null
    })
  }

  const getPortNotice = (portPath) => {
    return portNotices.value.get(portPath) || null
  }

  const setPortNotice = (portPath, type, message) => {
    if (!portPath || !message) return
    portNotices.value.set(portPath, {
      type,
      message,
      updatedAt: Date.now()
    })
  }

  const clearPortNotice = (portPath) => {
    if (!portPath) return
    portNotices.value.delete(portPath)
  }

  const normalizePortErrorMessage = (message, fallback = '操作失败') => {
    if (!message) return fallback

    const loweredMessage = String(message).toLowerCase()
    if (loweredMessage.includes('access denied') || loweredMessage.includes('permission denied')) {
      return '端口被占用或权限不足'
    }
    if (loweredMessage.includes('cannot lock port')) {
      return '端口被其他程序占用'
    }
    if (loweredMessage.includes('file not found') || loweredMessage.includes('cannot open')) {
      return '端口不存在或暂时不可用'
    }
    if (loweredMessage.includes('device disconnected') || loweredMessage.includes('disconnected')) {
      return '设备已断开连接'
    }

    return message
  }

  // 获取串口显示设置
  const getPortDisplaySettings = (portPath) => {
    if (!portDisplaySettings.value.has(portPath)) {
      portDisplaySettings.value.set(portPath, {
        hexReceive: false,
        showAscii: true,
        alignHexContinuation: false
      })
    }
    return portDisplaySettings.value.get(portPath)
  }

  // 更新串口显示设置
  const updatePortDisplaySettings = (portPath, updates) => {
    const current = getPortDisplaySettings(portPath)
    portDisplaySettings.value.set(portPath, { ...current, ...updates })
    // 配置变更时自动保存
    saveSessionState()
  }

  const getActiveThemeSchemeId = () => normalizeThemeSchemeId(
    appUiState.value.activeThemeSchemeId || appUiState.value.terminalAppearanceMode || appUiState.value.appThemeMode,
    appUiState.value.themeMode || 'dark'
  )

  const getThemeSchemeById = (schemeId = getActiveThemeSchemeId()) => {
    const normalizedSchemeId = normalizeThemeSchemeId(schemeId, appUiState.value.themeMode || 'dark')
    const presetMode = normalizedSchemeId === 'preset-light'
      ? 'light'
      : normalizedSchemeId === 'preset-dark'
        ? 'dark'
        : null

    if (presetMode) {
      return {
        id: normalizedSchemeId,
        kind: 'built-in',
        name: presetMode === 'light' ? '浅色默认' : '深色默认',
        sourceMode: normalizedSchemeId,
        appTheme: createAppThemePreset(presetMode),
        baseAppTheme: createAppThemePreset(presetMode),
        appearance: createTerminalAppearancePreset(presetMode),
        baseAppearance: createTerminalAppearancePreset(presetMode)
      }
    }

    const presetId = parseCustomAppearanceMode(normalizedSchemeId)
    const preset = presetId
      ? customAppearancePresets.value.find((item) => item.id === presetId)
      : null

    return preset
      ? {
          ...preset,
          kind: 'custom'
        }
      : null
  }

  const applyThemeSchemeState = (schemeId) => {
    const normalizedSchemeId = normalizeThemeSchemeId(schemeId, appUiState.value.themeMode || 'dark')
    const scheme = getThemeSchemeById(normalizedSchemeId)
    if (!scheme) return false
    const sourceSchemeId = scheme.kind === 'custom'
      ? normalizeThemeSchemeId(scheme.sourceMode || normalizedSchemeId, appUiState.value.themeMode || 'dark')
      : normalizedSchemeId
    const nextThemeMode = resolveThemeModeFromSchemeId(sourceSchemeId, appUiState.value.themeMode || 'dark')

    terminalAppearance.value = resolveTerminalAppearanceForMode(normalizedSchemeId, scheme.appearance)
    appTheme.value = resolveAppThemeForMode(normalizedSchemeId, scheme.appTheme)
    appUiState.value = buildAppUiStateWithThemeScheme({
      ...appUiState.value,
      themeMode: nextThemeMode,
      activeThemeSchemeId: normalizedSchemeId
    })
    return true
  }

  const isBuiltInThemeScheme = (schemeId = getActiveThemeSchemeId()) => (
    schemeId === 'preset-light' || schemeId === 'preset-dark'
  )

  const updateTerminalAppearance = (updates) => {
    const schemeId = getActiveThemeSchemeId()
    const customPresetId = parseCustomAppearanceMode(schemeId)
    if (isBuiltInThemeScheme(schemeId)) {
      return false
    }
    terminalAppearance.value = {
      ...terminalAppearance.value,
      ...updates
    }

    if (customPresetId) {
      customAppearancePresets.value = customAppearancePresets.value.map((preset) => (
        preset.id === customPresetId
          ? {
              ...preset,
              appearance: {
                ...preset.appearance,
                ...updates
              }
            }
          : preset
      ))
    }
    saveSessionState()
    persistUiPreferencesToConfig()
    pushUiSyncSnapshot()
    return true
  }

  const updateAppTheme = (updates) => {
    const schemeId = getActiveThemeSchemeId()
    const customPresetId = parseCustomAppearanceMode(schemeId)
    if (isBuiltInThemeScheme(schemeId)) {
      return false
    }
    appTheme.value = {
      ...appTheme.value,
      ...updates
    }

    if (customPresetId) {
      customAppearancePresets.value = customAppearancePresets.value.map((preset) => (
        preset.id === customPresetId
          ? {
              ...preset,
              appTheme: {
                ...preset.appTheme,
                ...updates
              }
            }
          : preset
      ))
    }
    saveSessionState()
    persistUiPreferencesToConfig()
    pushUiSyncSnapshot()
    return true
  }

  const resetAppTheme = (mode = null) => {
    const schemeId = mode
      ? normalizeThemeSchemeId(
          mode === 'light' || mode === 'dark' ? `preset-${mode}` : mode,
          appUiState.value.themeMode || 'dark'
        )
      : getActiveThemeSchemeId()
    const scheme = getThemeSchemeById(schemeId)
    if (!scheme) return false

    if (scheme.kind === 'custom') {
      appTheme.value = { ...scheme.baseAppTheme }
      customAppearancePresets.value = customAppearancePresets.value.map((preset) => (
        preset.id === scheme.id
          ? {
              ...preset,
              appTheme: { ...preset.baseAppTheme }
            }
          : preset
      ))
    } else {
      appTheme.value = createAppThemePreset(schemeId === 'preset-light' ? 'light' : 'dark')
      appUiState.value = buildAppUiStateWithThemeScheme({
        ...appUiState.value,
        activeThemeSchemeId: schemeId
      })
    }
    saveSessionState()
    persistUiPreferencesToConfig()
    pushUiSyncSnapshot()
    return true
  }

  const applyThemeScheme = (schemeId) => {
    const applied = applyThemeSchemeState(schemeId)
    if (!applied) {
      return false
    }
    saveSessionState()
    persistUiPreferencesToConfig()
    pushUiSyncSnapshot()
    return true
  }

  const createThemeScheme = (name, sourceSchemeId = getActiveThemeSchemeId()) => {
    const normalizedName = typeof name === 'string' && name.trim() ? name.trim() : `自定义方案 ${customAppearancePresets.value.length + 1}`
    const sourceScheme = getThemeSchemeById(sourceSchemeId)
    if (!sourceScheme) return null

    const nextPreset = {
      id: `appearance-${Date.now()}`,
      name: normalizedName,
      sourceMode: sourceScheme.kind === 'built-in'
        ? sourceScheme.id
        : sourceScheme.sourceMode || sourceScheme.id,
      appTheme: { ...sourceScheme.appTheme },
      baseAppTheme: { ...sourceScheme.appTheme },
      appearance: { ...sourceScheme.appearance },
      baseAppearance: { ...sourceScheme.appearance }
    }

    customAppearancePresets.value = [...customAppearancePresets.value, nextPreset]
    applyThemeSchemeState(`custom:${nextPreset.id}`)
    saveSessionState()
    persistUiPreferencesToConfig()
    pushUiSyncSnapshot()
    return nextPreset
  }

  const removeThemeScheme = (presetId) => {
    if (!presetId) return
    customAppearancePresets.value = customAppearancePresets.value.filter((preset) => preset.id !== presetId)
    if (getActiveThemeSchemeId() === `custom:${presetId}`) {
      applyThemeSchemeState(`preset-${appUiState.value.themeMode === 'light' ? 'light' : 'dark'}`)
    }
    saveSessionState()
    persistUiPreferencesToConfig()
    pushUiSyncSnapshot()
  }

  const applyThemeMode = (mode) => {
    return applyThemeScheme(`preset-${mode === 'light' ? 'light' : 'dark'}`)
  }

  const resetTerminalAppearance = (mode = null) => {
    const schemeId = mode
      ? normalizeThemeSchemeId(
          mode === 'light' || mode === 'dark' ? `preset-${mode}` : mode,
          appUiState.value.themeMode || 'dark'
        )
      : getActiveThemeSchemeId()
    const scheme = getThemeSchemeById(schemeId)
    if (!scheme) return false

    if (scheme.kind === 'custom') {
      terminalAppearance.value = { ...scheme.baseAppearance }
      customAppearancePresets.value = customAppearancePresets.value.map((preset) => (
        preset.id === scheme.id
          ? {
              ...preset,
              appearance: { ...preset.baseAppearance }
            }
          : preset
      ))
    } else {
      terminalAppearance.value = createTerminalAppearancePreset(schemeId === 'preset-light' ? 'light' : 'dark')
      appUiState.value = buildAppUiStateWithThemeScheme({
        ...appUiState.value,
        activeThemeSchemeId: schemeId
      })
    }
    saveSessionState()
    persistUiPreferencesToConfig()
    pushUiSyncSnapshot()
    return true
  }

  const resetThemeScheme = () => {
    const schemeId = getActiveThemeSchemeId()
    const scheme = getThemeSchemeById(schemeId)
    if (!scheme) return false

    if (scheme.kind === 'custom') {
      terminalAppearance.value = { ...scheme.baseAppearance }
      appTheme.value = { ...scheme.baseAppTheme }
      customAppearancePresets.value = customAppearancePresets.value.map((preset) => (
        preset.id === scheme.id
          ? {
              ...preset,
              appearance: { ...preset.baseAppearance },
              appTheme: { ...preset.baseAppTheme }
            }
          : preset
      ))
    } else {
      terminalAppearance.value = createTerminalAppearancePreset(schemeId === 'preset-light' ? 'light' : 'dark')
      appTheme.value = createAppThemePreset(schemeId === 'preset-light' ? 'light' : 'dark')
      appUiState.value = buildAppUiStateWithThemeScheme({
        ...appUiState.value,
        activeThemeSchemeId: schemeId
      })
    }

    saveSessionState()
    persistUiPreferencesToConfig()
    pushUiSyncSnapshot()
    return true
  }

  const updateWorkspaceLayout = (layout = {}) => {
    const nextPanes = Array.isArray(layout.splitPanes) && layout.splitPanes.length
      ? layout.splitPanes.map((pane) => ({
          tabs: Array.isArray(pane?.tabs) ? [...pane.tabs] : [],
          activeTab: typeof pane?.activeTab === 'string' ? pane.activeTab : ''
        }))
      : createDefaultWorkspaceLayout().splitPanes

    const nextWidths = Array.isArray(layout.paneWidths)
      ? layout.paneWidths.map((width) => Number(width) || 0).filter((width) => width > 0)
      : []

    workspaceLayout.value = {
      splitPanes: nextPanes,
      paneWidths: nextWidths
    }
    saveSessionState()
  }

  const updateAppUiState = (updates = {}) => {
    appUiState.value = buildAppUiStateWithThemeScheme({
      ...appUiState.value,
      ...updates
    })
    saveSessionState()
    persistUiPreferencesToConfig()
    pushUiSyncSnapshot()
  }

  const buildSettingsSnapshot = () => ({
    version: SETTINGS_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    defaultSettings: { ...defaultSettings.value },
    autoLogSettings: { ...autoLogSettings.value },
    portDisplaySettings: Object.fromEntries(portDisplaySettings.value),
    portControlSettings: Object.fromEntries(portControlSettings.value),
    commonCommands: JSON.parse(JSON.stringify(commonCommands.value)),
    appTheme: { ...appTheme.value },
    terminalAppearance: { ...terminalAppearance.value },
    customAppearancePresets: JSON.parse(JSON.stringify(customAppearancePresets.value)),
    savedWorkspaceSnapshots: JSON.parse(JSON.stringify(savedWorkspaceSnapshots.value)),
    workspaceLayout: JSON.parse(JSON.stringify(workspaceLayout.value)),
    selectedPort: selectedPort.value,
    appUiState: { ...appUiState.value }
  })

  const buildPortLogExport = (portPath) => {
    const logsForPort = getPortLogs(portPath)
    const portSettingsSnapshot = getPortSettings(portPath)
    const statsSnapshot = getPortStats(portPath)
    const displaySnapshot = getPortDisplaySettings(portPath)
    const controlSnapshot = getPortControlSettings(portPath)

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      portPath,
      connected: getPortStatus(portPath),
      settings: { ...portSettingsSnapshot },
      displaySettings: { ...displaySnapshot },
      controlSettings: { ...controlSnapshot },
      stats: { ...statsSnapshot },
      logs: logsForPort.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        recordedAt: log.recordedAt ?? null,
        type: log.type,
        message: log.message,
        pureData: log.pureData ?? log.message,
        hexData: log.hexData ?? null
      }))
    }
  }

  const buildPortPlainTextExport = (portPath) => {
    const logsForPort = getPortLogs(portPath)
    const displaySettings = getPortDisplaySettings(portPath)
    const lines = logsForPort.map((log) => {
      const prefix = `[${log.timestamp}] [${String(log.type || 'info').toUpperCase()}]`
      let content = typeof log.pureData === 'string' && log.pureData.length
        ? log.pureData
        : log.message

      if (displaySettings.hexReceive && typeof log.hexData === 'string' && log.hexData.length) {
        const asciiSuffix = displaySettings.showAscii
          ? ` [${log.hexData.split(' ').map((value) => {
              const code = Number.parseInt(value, 16)
              return code >= 32 && code <= 126 ? String.fromCharCode(code) : '.'
            }).join('')}]`
          : ''

        content = `${log.hexData}${asciiSuffix}`
      }

      return `${prefix} ${content ?? ''}`
    })

    return lines.join('\n')
  }

  const getAllExportablePortPaths = () => {
    const portPaths = new Set([
      ...portLogs.value.keys(),
      ...openPorts.value.keys()
    ])

    return Array.from(portPaths)
      .filter((portPath) => typeof portPath === 'string' && portPath)
      .sort((left, right) => left.localeCompare(right, 'zh-CN'))
  }

  const buildAllPortLogExport = () => {
    const portPaths = getAllExportablePortPaths()
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      portCount: portPaths.length,
      ports: portPaths.map((portPath) => buildPortLogExport(portPath))
    }
  }

  const buildAllPortPlainTextExport = () => {
    const portPaths = getAllExportablePortPaths()
    const blocks = portPaths.map((portPath) => {
      const content = buildPortPlainTextExport(portPath)
      return [
        `===== ${portPath} =====`,
        content || '[无日志]'
      ].join('\n')
    })

    return blocks.join('\n\n')
  }

  const buildWorkspaceSnapshot = () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    selectedPort: selectedPort.value,
    workspaceLayout: JSON.parse(JSON.stringify(workspaceLayout.value)),
    appUiState: { ...appUiState.value },
    defaultSettings: { ...defaultSettings.value },
    portDisplaySettings: Object.fromEntries(portDisplaySettings.value),
    portControlSettings: Object.fromEntries(portControlSettings.value),
    portFilters: Object.fromEntries(portFilters.value),
    portSendingData: Object.fromEntries(portSendingData.value),
    portSendHistory: Object.fromEntries(portSendHistory.value)
  })

  const sortObjectKeys = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => sortObjectKeys(item))
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort((left, right) => left.localeCompare(right, 'zh-CN'))
        .reduce((result, key) => {
          result[key] = sortObjectKeys(value[key])
          return result
        }, {})
    }

    return value
  }

  const normalizeWorkspaceSnapshotForComparison = (snapshot = {}) => ({
    selectedPort: typeof snapshot.selectedPort === 'string' || snapshot.selectedPort === null
      ? snapshot.selectedPort
      : null,
    workspaceLayout: sortObjectKeys(snapshot.workspaceLayout || createDefaultWorkspaceLayout()),
    appUiState: sortObjectKeys({
      ...(snapshot.appUiState || {}),
      activeWorkspaceSnapshotId: ''
    }),
    defaultSettings: sortObjectKeys(snapshot.defaultSettings || createDefaultSettings()),
    portDisplaySettings: sortObjectKeys(snapshot.portDisplaySettings || {}),
    portControlSettings: sortObjectKeys(snapshot.portControlSettings || {}),
    portFilters: sortObjectKeys(snapshot.portFilters || {}),
    portSendingData: sortObjectKeys(snapshot.portSendingData || {}),
    portSendHistory: sortObjectKeys(snapshot.portSendHistory || {})
  })

  const areWorkspaceSnapshotsEquivalent = (leftSnapshot = {}, rightSnapshot = {}) => (
    JSON.stringify(normalizeWorkspaceSnapshotForComparison(leftSnapshot)) ===
    JSON.stringify(normalizeWorkspaceSnapshotForComparison(rightSnapshot))
  )

  const syncActiveWorkspaceSnapshotState = () => {
    const activeSnapshotId = typeof appUiState.value.activeWorkspaceSnapshotId === 'string'
      ? appUiState.value.activeWorkspaceSnapshotId
      : ''
    if (!activeSnapshotId) return false

    const activeSnapshot = savedWorkspaceSnapshots.value.find((item) => item.id === activeSnapshotId)
    if (!activeSnapshot?.snapshot) {
      return syncWorkspaceSnapshotSelection('')
    }

    const matchesCurrentState = areWorkspaceSnapshotsEquivalent(activeSnapshot.snapshot, buildWorkspaceSnapshot())
    if (matchesCurrentState) return false

    return syncWorkspaceSnapshotSelection('')
  }

  const normalizeSavedWorkspaceSnapshots = (snapshots = []) => (
    Array.isArray(snapshots)
      ? snapshots
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: typeof item.id === 'string' && item.id ? item.id : `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '未命名工作区',
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
            snapshot: item.snapshot && typeof item.snapshot === 'object' ? item.snapshot : buildWorkspaceSnapshot()
          }))
      : []
  )

  const saveNamedWorkspaceSnapshot = async (name = '') => {
    const snapshotName = typeof name === 'string' && name.trim()
      ? name.trim()
      : `工作区快照 ${new Date().toLocaleString('zh-CN', { hour12: false })}`

    const nextSnapshot = {
      id: `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: snapshotName,
      createdAt: new Date().toISOString(),
      snapshot: buildWorkspaceSnapshot()
    }

    savedWorkspaceSnapshots.value = [nextSnapshot, ...savedWorkspaceSnapshots.value].slice(0, 8)
    syncWorkspaceSnapshotSelection(nextSnapshot.id)
    await saveSessionState()
    await persistUiPreferencesToConfig()
    return nextSnapshot
  }

  const applySavedWorkspaceSnapshot = async (snapshotId = '') => {
    const targetSnapshot = savedWorkspaceSnapshots.value.find((item) => item.id === snapshotId)
    if (!targetSnapshot?.snapshot) {
      throw new Error('未找到对应的工作区快照')
    }

    await applyWorkspaceSnapshot(targetSnapshot.snapshot)
    syncWorkspaceSnapshotSelection(snapshotId)
    return targetSnapshot
  }

  const overwriteSavedWorkspaceSnapshot = async (snapshotId = '') => {
    let updatedSnapshot = null

    savedWorkspaceSnapshots.value = savedWorkspaceSnapshots.value.map((item) => {
      if (item.id !== snapshotId) {
        return item
      }

      updatedSnapshot = {
        ...item,
        createdAt: new Date().toISOString(),
        snapshot: buildWorkspaceSnapshot()
      }
      return updatedSnapshot
    })

    if (!updatedSnapshot) {
      throw new Error('未找到对应的工作区快照')
    }

    syncWorkspaceSnapshotSelection(snapshotId)
    await saveSessionState()
    await persistUiPreferencesToConfig()
    return updatedSnapshot
  }

  const renameSavedWorkspaceSnapshot = async (snapshotId = '', name = '') => {
    const nextName = typeof name === 'string' && name.trim() ? name.trim() : ''
    if (!nextName) {
      throw new Error('请输入有效的快照名称')
    }

    let renamedSnapshot = null
    savedWorkspaceSnapshots.value = savedWorkspaceSnapshots.value.map((item) => {
      if (item.id !== snapshotId) {
        return item
      }

      renamedSnapshot = {
        ...item,
        name: nextName
      }
      return renamedSnapshot
    })

    if (!renamedSnapshot) {
      throw new Error('未找到对应的工作区快照')
    }

    await saveSessionState()
    await persistUiPreferencesToConfig()
    return renamedSnapshot
  }

  const removeSavedWorkspaceSnapshot = async (snapshotId = '') => {
    const wasActiveSnapshot = appUiState.value.activeWorkspaceSnapshotId === snapshotId
    savedWorkspaceSnapshots.value = savedWorkspaceSnapshots.value.filter((item) => item.id !== snapshotId)
    syncWorkspaceSnapshotSelection(wasActiveSnapshot ? (savedWorkspaceSnapshots.value[0]?.id ?? '') : null)
    await saveSessionState()
    await persistUiPreferencesToConfig()
  }

  const validateWorkspaceSnapshot = (snapshot = {}) => {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new Error('工作区快照内容无效')
    }

    if (typeof snapshot.version !== 'number') {
      throw new Error('工作区快照缺少版本信息')
    }

    if (snapshot.workspaceLayout && typeof snapshot.workspaceLayout !== 'object') {
      throw new Error('工作区布局格式无效')
    }

    if ('selectedPort' in snapshot && snapshot.selectedPort !== null && typeof snapshot.selectedPort !== 'string') {
      throw new Error('当前串口字段格式无效')
    }

    if (snapshot.appUiState && typeof snapshot.appUiState !== 'object') {
      throw new Error('界面状态格式无效')
    }

    if (snapshot.defaultSettings && typeof snapshot.defaultSettings !== 'object') {
      throw new Error('默认串口参数格式无效')
    }

    if (snapshot.portDisplaySettings && typeof snapshot.portDisplaySettings !== 'object') {
      throw new Error('显示设置格式无效')
    }

    if (snapshot.portControlSettings && typeof snapshot.portControlSettings !== 'object') {
      throw new Error('控制设置格式无效')
    }

    if (snapshot.portFilters && typeof snapshot.portFilters !== 'object') {
      throw new Error('过滤设置格式无效')
    }

    if (snapshot.portSendingData && typeof snapshot.portSendingData !== 'object') {
      throw new Error('发送草稿格式无效')
    }

    if (snapshot.portSendHistory && typeof snapshot.portSendHistory !== 'object') {
      throw new Error('发送历史格式无效')
    }
  }

  const applyWorkspaceSnapshot = async (snapshot = {}) => {
    validateWorkspaceSnapshot(snapshot)

    workspaceLayout.value = {
      ...createDefaultWorkspaceLayout(),
      ...(snapshot.workspaceLayout || {})
    }
    selectedPort.value = typeof snapshot.selectedPort === 'string' ? snapshot.selectedPort : null
    appUiState.value = buildAppUiStateWithThemeScheme({
      ...createDefaultAppUiState(),
      ...(snapshot.appUiState || {})
    })
    defaultSettings.value = {
      ...createDefaultSettings(),
      ...(snapshot.defaultSettings || {})
    }
    portDisplaySettings.value = new Map(Object.entries(snapshot.portDisplaySettings || {}))
    portControlSettings.value = new Map(Object.entries(snapshot.portControlSettings || {}))
    portFilters.value = new Map(Object.entries(snapshot.portFilters || {}))
    portSendingData.value = new Map(Object.entries(snapshot.portSendingData || {}))
    portSendHistory.value = new Map(Object.entries(snapshot.portSendHistory || {}))
    syncWorkspaceSnapshotSelection()

    await saveSessionState()
  }

  const validateSettingsSnapshot = (snapshot = {}) => {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new Error('设置文件内容无效')
    }

    if (typeof snapshot.version !== 'number') {
      throw new Error('设置文件缺少版本信息')
    }

    if (snapshot.version > SETTINGS_SNAPSHOT_VERSION) {
      throw new Error(`设置文件版本过高，当前仅支持 v${SETTINGS_SNAPSHOT_VERSION}`)
    }

    if (snapshot.defaultSettings && typeof snapshot.defaultSettings !== 'object') {
      throw new Error('默认串口参数格式无效')
    }

    if (snapshot.portDisplaySettings && typeof snapshot.portDisplaySettings !== 'object') {
      throw new Error('显示设置格式无效')
    }

    if (snapshot.portControlSettings && typeof snapshot.portControlSettings !== 'object') {
      throw new Error('控制设置格式无效')
    }

    if (snapshot.terminalAppearance && typeof snapshot.terminalAppearance !== 'object') {
      throw new Error('终端外观设置格式无效')
    }

    if (snapshot.appTheme && typeof snapshot.appTheme !== 'object') {
      throw new Error('应用主题设置格式无效')
    }

    if (snapshot.customAppearancePresets && !Array.isArray(snapshot.customAppearancePresets)) {
      throw new Error('终端外观方案格式无效')
    }

    if (snapshot.savedWorkspaceSnapshots && !Array.isArray(snapshot.savedWorkspaceSnapshots)) {
      throw new Error('工作区快照列表格式无效')
    }

    if (snapshot.workspaceLayout && typeof snapshot.workspaceLayout !== 'object') {
      throw new Error('工作区布局格式无效')
    }

    if ('selectedPort' in snapshot && snapshot.selectedPort !== null && typeof snapshot.selectedPort !== 'string') {
      throw new Error('当前串口字段格式无效')
    }

    if (snapshot.appUiState && typeof snapshot.appUiState !== 'object') {
      throw new Error('界面状态格式无效')
    }

    if (snapshot.commonCommands && !Array.isArray(snapshot.commonCommands)) {
      throw new Error('常用命令配置格式无效')
    }

    if (snapshot.autoLogSettings && typeof snapshot.autoLogSettings !== 'object') {
      throw new Error('自动日志配置格式无效')
    }
  }

  const applySettingsSnapshot = async (snapshot = {}) => {
    validateSettingsSnapshot(snapshot)

    defaultSettings.value = {
      ...createDefaultSettings(),
      ...(snapshot.defaultSettings || {})
    }
    autoLogSettings.value = normalizeAutoLogSettings(snapshot.autoLogSettings)
    portDisplaySettings.value = new Map(Object.entries(snapshot.portDisplaySettings || {}))
    portControlSettings.value = new Map(Object.entries(snapshot.portControlSettings || {}))
    const nextAppUiState = buildAppUiStateWithThemeScheme({
      ...createDefaultAppUiState(),
      ...(snapshot.appUiState || {})
    })
    appTheme.value = resolveAppThemeForMode(nextAppUiState.activeThemeSchemeId, snapshot.appTheme || {})
    terminalAppearance.value = resolveTerminalAppearanceForMode(nextAppUiState.activeThemeSchemeId, snapshot.terminalAppearance || {})
    customAppearancePresets.value = normalizeCustomAppearancePresets(snapshot.customAppearancePresets)
    savedWorkspaceSnapshots.value = normalizeSavedWorkspaceSnapshots(snapshot.savedWorkspaceSnapshots)
    workspaceLayout.value = {
      ...createDefaultWorkspaceLayout(),
      ...(snapshot.workspaceLayout || {})
    }
    selectedPort.value = typeof snapshot.selectedPort === 'string' ? snapshot.selectedPort : null
    appUiState.value = nextAppUiState
    syncWorkspaceSnapshotSelection()
    commonCommands.value = Array.isArray(snapshot.commonCommands)
      ? normalizeCommonCommands(JSON.parse(JSON.stringify(snapshot.commonCommands)))
      : createDefaultCommonCommands()

    await saveSessionState()
    await saveCommonCommands()
    await saveAutoLogSettings()
  }

  const resetAppSettings = async () => {
    await applySettingsSnapshot({
      defaultSettings: createDefaultSettings(),
      autoLogSettings: createDefaultAutoLogSettings(),
      portDisplaySettings: {},
      portControlSettings: {},
      commonCommands: createDefaultCommonCommands(),
      appTheme: createDefaultAppTheme(),
      terminalAppearance: createDefaultTerminalAppearance(),
      customAppearancePresets: createDefaultCustomAppearancePresets(),
      savedWorkspaceSnapshots: createDefaultSavedWorkspaceSnapshots(),
      workspaceLayout: createDefaultWorkspaceLayout(),
      selectedPort: null,
      appUiState: createDefaultAppUiState()
    })
  }

  // 保存会话状态到本地存储
  const saveSessionState = async () => {
    try {
      syncActiveWorkspaceSnapshotState()
      const state = {
        defaultSettings: defaultSettings.value,
        portDisplaySettings: Object.fromEntries(portDisplaySettings.value),
        portControlSettings: Object.fromEntries(portControlSettings.value),
        commonCommands: commonCommands.value,
        appTheme: appTheme.value,
        terminalAppearance: terminalAppearance.value,
        customAppearancePresets: customAppearancePresets.value,
        savedWorkspaceSnapshots: savedWorkspaceSnapshots.value,
        workspaceLayout: workspaceLayout.value,
        selectedPort: selectedPort.value,
        appUiState: appUiState.value,
        portSendHistory: Object.fromEntries(portSendHistory.value)
      }
      localStorage.setItem('serialx-session-state', JSON.stringify(state))
    } catch (error) {
      console.error('[Store] Error saving session state:', error)
    }
  }

  // 恢复会话状态
  const restoreSessionState = async () => {
    try {
      isRestoringSessionState = true
      await loadDefaultLogDirectory()
      const saved = localStorage.getItem('serialx-session-state')
      if (saved) {
        const state = JSON.parse(saved)
        if (state.defaultSettings) {
          Object.assign(defaultSettings.value, state.defaultSettings)
        }
        if (state.portDisplaySettings) {
          portDisplaySettings.value = new Map(Object.entries(state.portDisplaySettings))
        }
        if (state.portControlSettings) {
          portControlSettings.value = new Map(Object.entries(state.portControlSettings))
        }
        if (state.commonCommands) {
          commonCommands.value = normalizeCommonCommands(state.commonCommands)
        }
        if (state.portSendHistory) {
          portSendHistory.value = new Map(Object.entries(state.portSendHistory))
        }
        const nextAppUiState = state.appUiState && typeof state.appUiState === 'object'
          ? buildAppUiStateWithThemeScheme({
              ...createDefaultAppUiState(),
              ...state.appUiState
            })
          : null
        if (state.appTheme || nextAppUiState) {
          appTheme.value = resolveAppThemeForMode(
            nextAppUiState?.activeThemeSchemeId || appUiState.value.activeThemeSchemeId,
            state.appTheme || {}
          )
        }
        if (state.customAppearancePresets) {
          customAppearancePresets.value = normalizeCustomAppearancePresets(state.customAppearancePresets)
        }
        if (state.savedWorkspaceSnapshots) {
          savedWorkspaceSnapshots.value = normalizeSavedWorkspaceSnapshots(state.savedWorkspaceSnapshots)
        }

        if (state.terminalAppearance || nextAppUiState) {
          terminalAppearance.value = resolveTerminalAppearanceForMode(
            nextAppUiState?.activeThemeSchemeId,
            state.terminalAppearance
          )
        }
        if (state.workspaceLayout) {
          workspaceLayout.value = {
            ...createDefaultWorkspaceLayout(),
            ...state.workspaceLayout
          }
        }
        if (typeof state.selectedPort === 'string' || state.selectedPort === null) {
          selectedPort.value = state.selectedPort
        }
        if (nextAppUiState) {
          appUiState.value = nextAppUiState
        }
      }

      if (window?.electronAPI?.loadConfig) {
        const config = await window.electronAPI.loadConfig()
        const nextConfigUiState = config?.appUiState && typeof config.appUiState === 'object'
          ? buildAppUiStateWithThemeScheme({
              ...createDefaultAppUiState(),
              ...appUiState.value,
              ...config.appUiState
            })
          : null

        if (nextConfigUiState) {
          appUiState.value = nextConfigUiState
        }
        if (config?.appTheme || nextConfigUiState) {
          appTheme.value = resolveAppThemeForMode(
            nextConfigUiState?.activeThemeSchemeId || appUiState.value.activeThemeSchemeId,
            config?.appTheme || {}
          )
        }
        if (config?.terminalAppearance || nextConfigUiState) {
          terminalAppearance.value = resolveTerminalAppearanceForMode(
            nextConfigUiState?.activeThemeSchemeId || appUiState.value.activeThemeSchemeId,
            {
              ...terminalAppearance.value,
              ...(config?.terminalAppearance || {})
            }
          )
        }
        if (config?.customAppearancePresets) {
          customAppearancePresets.value = normalizeCustomAppearancePresets(config.customAppearancePresets)
        }
        if (config?.savedWorkspaceSnapshots) {
          savedWorkspaceSnapshots.value = normalizeSavedWorkspaceSnapshots(config.savedWorkspaceSnapshots)
        }
        if (config?.autoLogSettings) {
          autoLogSettings.value = normalizeAutoLogSettings(config.autoLogSettings)
        }
        if (config?.defaultSettings && typeof config.defaultSettings === 'object') {
          defaultSettings.value = {
            ...createDefaultSettings(),
            ...config.defaultSettings
          }
        }
      }

      syncWorkspaceSnapshotSelection()
      const didSyncBuiltInPreset = syncBuiltInThemeSchemeState()
      if (didSyncBuiltInPreset) {
        await saveSessionState()
        await persistUiPreferencesToConfig()
      }

      pushUiSyncSnapshot()
    } catch (error) {
      console.error('[Store] Error restoring session state:', error)
    } finally {
      isRestoringSessionState = false
    }
  }

  // 常用命令配置（全局统一配置）- 初始为空，从配置文件加载
  const commonCommands = ref([])

  // 从配置文件加载常用命令
  const loadCommonCommands = async () => {
    try {
      const config = await window.electronAPI.loadConfig()
      if (config.commonCommands && config.commonCommands.length > 0) {
        commonCommands.value = normalizeCommonCommands(config.commonCommands)
      } else {
        // 使用默认配置
        commonCommands.value = createDefaultCommonCommands()
      }
    } catch (error) {
      console.error('[Store] Error loading config:', error)
      // 使用默认配置
      commonCommands.value = createDefaultCommonCommands()
    }
  }

  // 保存常用命令到配置文件
  const saveCommonCommands = async () => {
    try {
      const config = await window.electronAPI.loadConfig()
      // 使用 JSON 序列化处理响应式对象，避免无法克隆的错误
      config.commonCommands = JSON.parse(JSON.stringify(commonCommands.value))
      await window.electronAPI.saveConfig(config)
    } catch (error) {
      console.error('[Store] Error saving config:', error)
    }
  }

  const pushCommonCommandsSyncSnapshot = () => {
    if (!window?.electronAPI?.pushCommonCommandsSnapshot) return
    window.electronAPI.pushCommonCommandsSnapshot(JSON.parse(JSON.stringify(commonCommands.value)))
  }

  const applyExternalCommonCommandsSnapshot = (snapshot = []) => {
    if (!Array.isArray(snapshot)) return
    const normalizedSnapshot = normalizeCommonCommands(JSON.parse(JSON.stringify(snapshot)))
    if (JSON.stringify(commonCommands.value) === JSON.stringify(normalizedSnapshot)) {
      return
    }

    shouldSkipNextCommonCommandsSync = true
    commonCommands.value = normalizedSnapshot
  }

  const setupCommonCommandsSyncListeners = () => {
    window?.electronAPI?.onCommonCommandsSnapshot?.((snapshot) => {
      applyExternalCommonCommandsSnapshot(snapshot)
    })

    window?.electronAPI?.getLatestCommonCommandsSnapshot?.().then((snapshot) => {
      if (Array.isArray(snapshot)) {
        applyExternalCommonCommandsSnapshot(snapshot)
      }
    })
  }

  // 监听常用命令变化，自动保存
  watch(() => commonCommands.value, () => {
    saveCommonCommands()
    if (shouldSkipNextCommonCommandsSync) {
      shouldSkipNextCommonCommandsSync = false
      return
    }
    pushCommonCommandsSyncSnapshot()
  }, { deep: true })

  watch(() => autoLogSettings.value, () => {
    saveAutoLogSettings()
  }, { deep: true })

  watch(() => defaultSettings.value, () => {
    if (isRestoringSessionState) return
    saveSessionState()
    saveDefaultSettingsToConfig()
  }, { deep: true })

  watch(selectedPort, () => {
    saveSessionState()
  })

  // Getters
  const availableBaudRates = computed(() => [
    300, 1200, 2400, 4800, 9600, 14400, 19200, 28800,
    38400, 57600, 74880, 115200, 230400, 460800, 921600
  ])

  const getPortStatus = (portPath) => {
    const port = openPorts.value.get(portPath)
    return port ? port.isConnected : false
  }

  const syncSelectedPort = () => {
    const availablePortPaths = ports.value.map((port) => port.path)
    const connectedPortPaths = Array.from(openPorts.value.entries())
      .filter(([, port]) => port?.isConnected)
      .map(([path]) => path)

    if (selectedPort.value && (availablePortPaths.includes(selectedPort.value) || connectedPortPaths.includes(selectedPort.value))) {
      return selectedPort.value
    }

    selectedPort.value = connectedPortPaths[0] || availablePortPaths[0] || null
    return selectedPort.value
  }

  const getPortSettings = (portPath) => {
    return portSettings.value.get(portPath) || defaultSettings.value
  }

  const getPortSendingData = (portPath) => {
    return portSendingData.value.get(portPath) || ''
  }

  const getPortSendHistory = (portPath) => {
    return portSendHistory.value.get(portPath) || []
  }

  const setPortSendingData = (portPath, data) => {
    portSendingData.value.set(portPath, data)
  }

  const recordPortSendHistory = (portPath, data) => {
    if (!portPath || typeof data !== 'string') return
    const trimmed = data.trim()
    if (!trimmed) return

    const currentHistory = portSendHistory.value.get(portPath) || []
    const nextHistory = [trimmed, ...currentHistory.filter((item) => item !== trimmed)].slice(0, 12)
    portSendHistory.value.set(portPath, nextHistory)
    saveSessionState()
  }

  const removePortSendHistoryItem = (portPath, item) => {
    if (!portPath || typeof item !== 'string') return false

    const currentHistory = portSendHistory.value.get(portPath) || []
    const trimmed = item.trim()
    if (!trimmed || !currentHistory.length) return false

    const nextHistory = currentHistory.filter((historyItem) => historyItem !== trimmed)
    if (nextHistory.length === currentHistory.length) return false

    if (nextHistory.length > 0) {
      portSendHistory.value.set(portPath, nextHistory)
    } else {
      portSendHistory.value.delete(portPath)
    }

    saveSessionState()
    return true
  }

  const clearPortSendHistory = (portPath) => {
    if (!portPath) return false
    if (!portSendHistory.value.has(portPath)) return false

    portSendHistory.value.delete(portPath)
    saveSessionState()
    return true
  }

  // 获取/设置过滤器
  const getPortFilters = (portPath) => {
    return portFilters.value.get(portPath) || {
      enabled: false,
      mode: 'discard',
      matchMode: 'regex', // 'keyword' | 'regex'
      pattern: '',
      filterTarget: 'both' // 'hexData' | 'asciiData' | 'both'
    }
  }

  const setPortFilters = (portPath, filters) => {
    const current = getPortFilters(portPath)
    portFilters.value.set(portPath, { ...current, ...filters })
    // 配置变更时自动保存
    saveSessionState()
  }

  // 检查日志是否应该被过滤（返回 true 表示过滤掉）
  const shouldFilterLog = (portPath, logType, message, rawHexData = null, asciiData = null) => {
    const filters = getPortFilters(portPath)
    if (!filters.enabled) return false

    // 只过滤 RX 数据
    if (logType !== 'rx') return false

    // 没有 pattern 不过滤
    if (!filters.pattern) return false

    // 确定要检查的数据内容
    const hexReceive = portDisplaySettings.value.get(portPath)?.hexReceive ?? false
    const filterTarget = filters.filterTarget || 'both'

    let dataToCheck = []

    if (hexReceive) {
      // HEX 模式下根据 filterTarget 决定检查哪些数据
      if (filterTarget === 'hexData' && rawHexData) {
        dataToCheck.push(rawHexData)
      } else if (filterTarget === 'asciiData' && rawHexData) {
        // 从 hexData 反向计算 ASCII
        const ascii = rawHexData.split(' ').map(h => {
          const code = parseInt(h, 16)
          return (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.'
        }).join('')
        dataToCheck.push(ascii)
      } else if (filterTarget === 'both') {
        if (rawHexData) dataToCheck.push(rawHexData)
        if (rawHexData) {
          const ascii = rawHexData.split(' ').map(h => {
            const code = parseInt(h, 16)
            return (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.'
          }).join('')
          dataToCheck.push(ascii)
        }
      }
    } else {
      // 文本模式只检查 message
      dataToCheck.push(message)
    }

    // 如果没有数据可检查，不过滤
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

  // 获取被过滤的日志数量
  const getFilteredCount = (portPath) => {
    const filters = getPortFilters(portPath)
    if (!filters.enabled || !filters.pattern) return 0

    const logs = portLogs.value.get(portPath) || []
    return logs.filter(log => shouldFilterLog(portPath, log.type, log.message, log.hexData, null)).length
  }

  // Actions
  async function refreshPorts() {
    try {
      const currentSelectedPort = selectedPort.value
      const portList = await window.electronAPI.listPorts()
      ports.value = portList
      const portPaths = portList.map((port) => port.path)

      if (currentSelectedPort && portPaths.includes(currentSelectedPort)) {
        selectedPort.value = currentSelectedPort
      } else {
        syncSelectedPort()
      }

      return portList
    } catch (error) {
      console.error('Error refreshing ports:', error)
      addLog(`刷新端口失败：${error.message}`, 'error')
      return []
    }
  }

  async function connect(portPath = null, settings = null) {
    const targetPort = portPath || selectedPort.value
    if (!targetPort) {
      addLog('请选择串口', 'error')
      return false
    }

    const connectionSettings = {
      path: targetPort,
      ...(settings || defaultSettings.value)
    }

    try {
      const result = await window.electronAPI.openPort(connectionSettings)

      if (result.success) {
        selectedPort.value = targetPort
        clearPortNotice(targetPort)
        openPorts.value.set(targetPort, {
          isConnected: true,
          baudRate: connectionSettings.baudRate,
          dataBits: connectionSettings.dataBits,
          stopBits: connectionSettings.stopBits,
          parity: connectionSettings.parity
        })
        portSettings.value.set(targetPort, connectionSettings)
        // 如果是首次连接，初始化日志数组；否则保留之前的日志
        if (!portLogs.value.has(targetPort)) {
          portLogs.value.set(targetPort, [])
        }
        // 如果是首次连接，初始化过滤器
        if (!portFilters.value.has(targetPort)) {
          portFilters.value.set(targetPort, {
            enabled: false,
            mode: 'discard',
            matchMode: 'regex',
            pattern: ''
          })
        }
        addPortLog(targetPort, `已连接，波特率：${connectionSettings.baudRate}`, 'success')
        return true
      } else {
        const errorMessage = normalizePortErrorMessage(result.error, '连接失败')
        setPortNotice(targetPort, 'error', errorMessage)
        addPortLog(targetPort, `连接失败：${errorMessage}`, 'error')
        return false
      }
    } catch (error) {
      console.error('Connection error:', error)
      const errorMessage = normalizePortErrorMessage(error.message, '连接错误')
      setPortNotice(targetPort, 'error', errorMessage)
      addPortLog(targetPort, `连接错误：${errorMessage}`, 'error')
      return false
    }
  }

  async function disconnect(portPath = null) {
    const targetPort = portPath || selectedPort.value
    if (!targetPort) {
      addPortLog(targetPort, '请选择串口', 'error')
      return false
    }

    try {
      portManualDisconnects.add(targetPort)
      const result = await window.electronAPI.closePort(targetPort)
      if (result.success) {
        openPorts.value.delete(targetPort)
        // 保留日志数据、过滤设置、统计数据，只删除连接状态
        stopLoopSendForPort(targetPort)
        clearPortNotice(targetPort)
        addPortLog(targetPort, `已断开`, 'info')
        syncSelectedPort()
        return true
      }
      portManualDisconnects.delete(targetPort)
    } catch (error) {
      portManualDisconnects.delete(targetPort)
      setPortNotice(targetPort, 'error', error.message || '断开连接失败')
      addPortLog(targetPort, `断开连接错误：${error.message}`, 'error')
    }
    return false
  }

  async function disconnectAll() {
    try {
      Array.from(openPorts.value.keys()).forEach((portPath) => portManualDisconnects.add(portPath))
      const result = await window.electronAPI.closePort()
      openPorts.value.clear()
      // 保留日志数据、过滤设置、统计数据，只删除连接状态
      stopLoopSend()
      syncSelectedPort()
      return result.success
    } catch (error) {
      portManualDisconnects.clear()
      return false
    }
  }

  // Hex 工具函数：将 Hex 字符串转换为 Uint8Array
  const hexToBytes = (hexString) => {
    if (!hexString) return new Uint8Array(0)
    const cleanHex = hexString.replace(/[\s,-]/g, '').toUpperCase()
    if (!/^[0-9A-F]+$/.test(cleanHex)) {
      throw new Error('无效的 Hex 格式')
    }
    const paddedHex = cleanHex.length % 2 === 1 ? '0' + cleanHex : cleanHex
    const bytes = new Uint8Array(paddedHex.length / 2)
    for (let i = 0; i < paddedHex.length; i += 2) {
      bytes[i / 2] = parseInt(paddedHex.substr(i, 2), 16)
    }
    return bytes
  }

  // Hex 工具函数：将 Uint8Array 转换为 Hex 字符串（带空格分隔）
  const bytesToHex = (bytes) => {
    if (!bytes || bytes.length === 0) return ''
    return Array.from(bytes)
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join(' ')
  }

  // Hex 工具函数：验证 Hex 字符串是否有效
  const isValidHex = (hexString) => {
    if (!hexString) return false
    const cleanHex = hexString.replace(/[\s,-]/g, '').toUpperCase()
    return cleanHex.length > 0 && /^[0-9A-F]+$/.test(cleanHex)
  }

  // 字节转字符串（支持 ASCII 和 UTF-8 中文）
  const bytesToString = (bytes) => {
    if (!bytes || !Array.isArray(bytes) || bytes.length === 0) return ''
    try {
      const uint8Array = new Uint8Array(bytes)
      const decoder = new TextDecoder('utf-8', { fatal: false })
      return decoder.decode(uint8Array)
    } catch {
      return bytes.map(b => {
        const char = String.fromCharCode(b)
        return (b >= 32 && b <= 126) ? char : '.'
      }).join('')
    }
  }

  async function sendData(portPath = null, data = null, isHex = false) {
    const targetPort = portPath || selectedPort.value
    let dataToSend = data !== null ? data : getPortSendingData(targetPort)

    if (!targetPort) {
      return { success: false, error: '请选择串口' }
    }

    if (!dataToSend) {
      return { success: false, error: '没有数据' }
    }

    const isConnected = openPorts.value.get(targetPort)?.isConnected
    if (!isConnected) {
      return { success: false, error: `串口 ${targetPort} 未打开` }
    }

    // Hex 模式：将十六进制字符串转换为字节数组
    let actualData = dataToSend
    let logData = dataToSend
    let rawBytes = null

    if (isHex) {
      try {
        const hexString = dataToSend.replace(/[\s,-]/g, '').toUpperCase()
        if (hexString.length === 0) {
          addPortLog(targetPort, '发送失败：Hex 模式下请输入有效的十六进制数据', 'error')
          return { success: false, error: 'Hex 数据为空' }
        }
        if (!/^[0-9A-F]+$/.test(hexString)) {
          addPortLog(targetPort, `发送失败：无效的 Hex 格式，请输入 0-9 和 A-F 字符`, 'error')
          return { success: false, error: '无效的 Hex 格式' }
        }
        actualData = hexToBytes(hexString)
        rawBytes = Array.from(actualData)
        logData = dataToSend
      } catch (error) {
        addPortLog(targetPort, `Hex 转换失败：${error.message}`, 'error')
        return { success: false, error: `Hex 转换失败：${error.message}` }
      }
    } else {
      // 非 Hex 模式也保存原始字节，方便切换查看
      rawBytes = Array.from(new TextEncoder().encode(dataToSend))
    }

    try {
      const result = await window.electronAPI.writeData(targetPort, actualData)
      if (result.success) {
        clearPortNotice(targetPort)
        // 更新统计数据
        const byteCount = actualData instanceof Uint8Array ? actualData.length : new TextEncoder().encode(actualData).length
        updatePortStats(targetPort, 'tx', byteCount)

        // 传递原始字节用于 Hex/ASCII 显示，message 只保留纯数据不含 TX/RX 前缀
        const logData_raw = rawBytes ? {
          hexData: bytesToHex(rawBytes),
          rawBytes,
          message: logData
        } : null
        recordPortSendHistory(targetPort, logData)
        addPortLog(targetPort, logData, 'tx', logData_raw)
        return { success: true }
      } else {
        const errorMessage = normalizePortErrorMessage(result.error, '发送失败')
        setPortNotice(targetPort, 'error', errorMessage)
        addPortLog(targetPort, `发送失败：${errorMessage}`, 'error')
        return { success: false, error: errorMessage }
      }
    } catch (error) {
      const errorMessage = normalizePortErrorMessage(error.message, '发送失败')
      setPortNotice(targetPort, 'error', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  function clearLoopSendTimer(portPath) {
    const timer = portLoopSendTimers.get(portPath)
    if (timer) {
      clearTimeout(timer)
      portLoopSendTimers.delete(portPath)
    }
  }

  function scheduleLoopSend(portPath, delayOverride = null) {
    clearLoopSendTimer(portPath)

    const portControl = getPortControlSettings(portPath)
    const interval = delayOverride === null
      ? Math.max(1, Number(portControl.loopInterval) || 1000)
      : Math.max(0, Number(delayOverride) || 0)
    const timer = setTimeout(async () => {
      await runLoopSendIteration(portPath)
    }, interval)

    portLoopSendTimers.set(portPath, timer)
  }

  async function runLoopSendIteration(portPath) {
    if (!getPortControlSettings(portPath).isLoopSend) {
      clearLoopSendTimer(portPath)
      return
    }

    if (portLoopSendPaused.get(portPath)) {
      scheduleLoopSend(portPath)
      return
    }

    if (portLoopSendInFlight.get(portPath)) {
      scheduleLoopSend(portPath)
      return
    }

    const dataToSend = getPortSendingData(portPath)
    if (!dataToSend) {
      stopLoopSendForPort(portPath, { resetCount: false, silent: true })
      updatePortControlSettings(portPath, { isLoopSend: false })
      addPortLog(portPath, '循环发送已停止：发送内容为空', 'warning')
      return
    }

    if (!openPorts.value.get(portPath)?.isConnected) {
      stopLoopSendForPort(portPath, { resetCount: false, silent: true })
      updatePortControlSettings(portPath, { isLoopSend: false })
      addPortLog(portPath, '循环发送已停止：串口已断开', 'warning')
      return
    }

    const portControl = getPortControlSettings(portPath)
    const currentCount = portLoopSendCounts.get(portPath) || 0
    if (portControl.loopMaxCount > 0 && currentCount >= portControl.loopMaxCount) {
      stopLoopSendForPort(portPath, { resetCount: false, silent: true })
      updatePortControlSettings(portPath, { isLoopSend: false })
      addPortLog(portPath, `循环发送已完成（${currentCount}/${portControl.loopMaxCount}）`, 'info')
      return
    }

    portLoopSendInFlight.set(portPath, true)
    try {
      const result = await sendData(portPath, dataToSend, portControl.hexSend)
      if (result.success) {
        portLoopSendCounts.set(portPath, currentCount + 1)
        portLoopSendFailures.set(portPath, 0)
      } else {
        const failureCount = (portLoopSendFailures.get(portPath) || 0) + 1
        portLoopSendFailures.set(portPath, failureCount)
        addPortLog(portPath, `循环发送失败：${result.error}`, 'error')

        if (portControl.loopFailureLimit > 0 && failureCount >= portControl.loopFailureLimit) {
          stopLoopSendForPort(portPath, { resetCount: false, silent: true })
          updatePortControlSettings(portPath, { isLoopSend: false })
          addPortLog(portPath, `循环发送已停止：连续失败 ${failureCount} 次`, 'warning')
          return
        }
      }
    } finally {
      portLoopSendInFlight.set(portPath, false)
    }

    if (getPortControlSettings(portPath).isLoopSend) {
      scheduleLoopSend(portPath)
    }
  }

  function startLoopSend(portPath = null, options = {}) {
    const targetPort = portPath || selectedPort.value
    const { preserveCount = false, silent = false } = options

    if (!targetPort || !getPortSendingData(targetPort)) {
      addPortLog(targetPort, '循环发送启动失败：没有发送内容', 'error')
      return false
    }

    if (!openPorts.value.get(targetPort)?.isConnected) {
      addPortLog(targetPort, '循环发送启动失败：串口未连接', 'error')
      return false
    }

    clearLoopSendTimer(targetPort)
    portLoopSendPaused.set(targetPort, false)
    portLoopSendInFlight.set(targetPort, false)

    if (!preserveCount) {
      portLoopSendCounts.set(targetPort, 0)
    }
    if (!preserveCount) {
      portLoopSendFailures.set(targetPort, 0)
    }

    const currentControl = getPortControlSettings(targetPort)
    if (!currentControl.isLoopSend) {
      updatePortControlSettings(targetPort, { isLoopSend: true })
    }

    if (!silent) {
      const currentCount = portLoopSendCounts.get(targetPort) || 0
      addPortLog(
        targetPort,
        `循环发送已启动（间隔：${Math.max(1, Number(currentControl.loopInterval) || 1000)}ms${Math.max(0, Number(currentControl.loopStartDelay) || 0) > 0 ? `，启动延时：${Math.max(0, Number(currentControl.loopStartDelay) || 0)}ms` : ''}${currentControl.loopMaxCount > 0 ? `，上限：${currentControl.loopMaxCount} 次` : ''}${currentControl.loopFailureLimit > 0 ? `，失败阈值：${currentControl.loopFailureLimit} 次` : ''}${currentCount > 0 ? `，从第 ${currentCount + 1} 次继续` : ''}）`,
        'info'
      )
    }

    const initialDelay = preserveCount ? 0 : Math.max(0, Number(currentControl.loopStartDelay) || 0)
    if (initialDelay > 0) {
      scheduleLoopSend(targetPort, initialDelay)
    } else {
      runLoopSendIteration(targetPort)
    }
    return true
  }

  function restartLoopSendForPort(portPath, options = {}) {
    if (!getPortControlSettings(portPath).isLoopSend) return false
    stopLoopSendForPort(portPath, { resetCount: false, silent: true })
    return startLoopSend(portPath, { preserveCount: true, silent: true, ...options })
  }

  function pauseLoopSendForPort(portPath) {
    portLoopSendPaused.set(portPath, true)
    clearLoopSendTimer(portPath)
    addPortLog(portPath, '循环发送已暂停', 'info')
  }

  function resumeLoopSendForPort(portPath) {
    portLoopSendPaused.set(portPath, false)
    addPortLog(portPath, '循环发送已继续', 'info')
    if (getPortControlSettings(portPath).isLoopSend) {
      scheduleLoopSend(portPath)
    }
  }

  function togglePauseLoopSendForPort(portPath) {
    const isPaused = portLoopSendPaused.get(portPath) || false
    if (isPaused) {
      resumeLoopSendForPort(portPath)
    } else {
      pauseLoopSendForPort(portPath)
    }
    return !isPaused
  }

  function isLoopSendPaused(portPath) {
    return portLoopSendPaused.get(portPath) || false
  }

  function stopLoopSendForPort(portPath, options = {}) {
    const { resetCount = true, silent = false } = options

    clearLoopSendTimer(portPath)
    portLoopSendPaused.set(portPath, false)
    portLoopSendInFlight.set(portPath, false)

    if (resetCount) {
      portLoopSendCounts.set(portPath, 0)
    }
    if (resetCount) {
      portLoopSendFailures.set(portPath, 0)
    }

    if (!silent && getPortControlSettings(portPath).isLoopSend) {
      updatePortControlSettings(portPath, { isLoopSend: false })
      addPortLog(portPath, '循环发送已停止', 'info')
    }
  }

  function stopLoopSend() {
    const activePorts = new Set([
      ...portLoopSendTimers.keys(),
      ...Array.from(portControlSettings.value.entries())
        .filter(([, settings]) => settings?.isLoopSend)
        .map(([portPath]) => portPath)
    ])

    for (const portPath of activePorts) {
      stopLoopSendForPort(portPath, { silent: true })
      updatePortControlSettings(portPath, { isLoopSend: false })
    }
  }

  function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
    logs.value.push({
      id: Date.now() + Math.random(),
      timestamp,
      message,
      type
    })

    // Limit log history
    if (logs.value.length > 1000) {
      logs.value.shift()
    }
  }

  // 批量添加日志 - 减少响应式触发
  let logBatchBuffer = new Map() // portPath -> log batch array
  let logFlushTimer = null
  const LOG_BATCH_SIZE = 5 // 每批最多 5 条日志
  const LOG_BATCH_INTERVAL = 100 // 100ms 刷新一次

  function flushLogBatch() {
    const autoSavePayload = []

    for (const [portPath, batch] of logBatchBuffer.entries()) {
      const portLog = portLogs.value.get(portPath)
      if (!portLog) continue

      // 批量添加日志
      for (const logEntry of batch) {
        portLog.push(logEntry)
      }

      // 清理旧日志 - 使用更激进的清理策略
      if (portLog.length > 800) {
        portLog.splice(0, portLog.length - 800)
      }

      if (autoLogSettings.value.enabled && batch.length > 0) {
        autoSavePayload.push({
          portPath,
          logs: batch.map((entry) => ({
            id: entry.id,
            timestamp: entry.timestamp,
            recordedAt: entry.recordedAt,
            type: entry.type,
            message: entry.message,
            pureData: entry.pureData,
            hexData: entry.hexData ?? null
          }))
        })
      }
    }

    logBatchBuffer.clear()

    if (autoSavePayload.length > 0) {
      window?.electronAPI?.autoSaveLogs?.({
        directory: autoLogSettings.value.directory,
        format: autoLogSettings.value.format,
        portLogs: autoSavePayload
      }).catch((error) => {
        console.error('[Store] Error auto-saving logs:', error)
      })
    }
  }

  function addPortLog(portPath, message, type = 'info', rawData = null) {
    if (!portLogs.value.has(portPath)) {
      portLogs.value.set(portPath, [])
    }

    const timestamp = new Date().toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      recordedAt: new Date().toISOString(),
      message,
      type,
      hexData: rawData?.hexData || null,
      // 不存储 rawBytes，节省内存，需要时从 hexData 反向计算
      pureData: rawData?.message ?? message
    }

    // 加入批处理缓冲
    if (!logBatchBuffer.has(portPath)) {
      logBatchBuffer.set(portPath, [])
    }
    const batch = logBatchBuffer.get(portPath)
    batch.push(logEntry)

    // 达到批量大小立即刷新
    if (batch.length >= LOG_BATCH_SIZE) {
      flushLogBatch()
      if (logFlushTimer) {
        clearTimeout(logFlushTimer)
        logFlushTimer = null
      }
    } else if (!logFlushTimer) {
      // 启动定时器
      logFlushTimer = setTimeout(() => {
        logFlushTimer = null
        flushLogBatch()
      }, LOG_BATCH_INTERVAL)
    }
  }

  function getPortLogs(portPath) {
    return portLogs.value.get(portPath) || []
  }

  function clearLogs() {
    logs.value = []
    portLogs.value.clear()
  }

  function clearPortLogs(portPath) {
    // 创建新 Map 触发响应式更新
    const newMap = new Map(portLogs.value)
    newMap.set(portPath, [])
    portLogs.value = newMap
  }

  function formatDisplayData(data) {
    return data
  }

  function updateDefaultSetting(key, value) {
    defaultSettings.value[key] = value
  }

  // 常用命令操作
  const addCommonCommand = (name, command, group = '默认') => {
    commonCommands.value.push({
      id: Date.now(),
      name,
      command,
      group,
      enabled: true
    })
  }

  const removeCommonCommand = (id) => {
    commonCommands.value = commonCommands.value.filter(cmd => cmd.id !== id)
  }

  const updateCommonCommand = (id, updates) => {
    const cmd = commonCommands.value.find(c => c.id === id)
    if (cmd) {
      Object.assign(cmd, updates)
    }
  }

  const toggleCommandEnabled = (id) => {
    const cmd = commonCommands.value.find(c => c.id === id)
    if (cmd) {
      cmd.enabled = !cmd.enabled
    }
  }

  const getEnabledCommands = computed(() => {
    return commonCommands.value.filter(cmd => cmd.enabled)
  })

  // Set up event listeners
  function setupEventListeners() {
    window.electronAPI.onSerialData(({ port, data, hexData, rawBytes }) => {
      // 过滤检查：如果数据被过滤，直接丢弃不显示
      if (shouldFilterLog(port, 'rx', data, hexData, null)) {
        return
      }
      // 更新统计数据
      const byteCount = rawBytes ? rawBytes.length : new TextEncoder().encode(data).length
      updatePortStats(port, 'rx', byteCount)
      // 存储原始数据用于 Hex 显示，message 只保存纯数据
      addPortLog(port, data, 'rx', { hexData, message: data })
    })

    window.electronAPI.onSerialError(({ port, error }) => {
      const errorMessage = normalizePortErrorMessage(error, '串口错误')
      setPortNotice(port, 'error', errorMessage)
      addPortLog(port, `错误：${errorMessage}`, 'error')
    })

    window.electronAPI.onPortClosed(({ port }) => {
      openPorts.value.delete(port)
      stopLoopSendForPort(port, { resetCount: false, silent: true })

      if (portManualDisconnects.has(port)) {
        portManualDisconnects.delete(port)
      } else {
        setPortNotice(port, 'warning', '串口连接已意外关闭')
      }

      syncSelectedPort()
    })
  }

  // 必须在 setupEventListeners 调用前绑定 this
  setupEventListeners()
  setupUiSyncListeners()
  setupCommonCommandsSyncListeners()

  const applyTerminalAppearanceMode = applyThemeScheme
  const createCustomTerminalAppearancePreset = createThemeScheme
  const removeCustomTerminalAppearancePreset = removeThemeScheme

  return {
    // State
    ports,
    selectedPort,
    openPorts,
    portLogs,
    portSettings,
    portSendingData,
    portSendHistory,
    portFilters,
    defaultSettings,
    logs,
    commonCommands,
    appTheme,
    terminalAppearance,
    customAppearancePresets,
    savedWorkspaceSnapshots,
    autoLogSettings,
    defaultLogDirectory,
    createTerminalAppearancePreset,
    getActiveThemeSchemeId,
    getThemeSchemeById,
    applyThemeMode,
    workspaceLayout,
    appUiState,
    portLoopSendCounts,
    portLoopSendPaused,
    portNotices,
    // Getters
    availableBaudRates,
    getEnabledCommands,
    getPortStatus,
    syncSelectedPort,
    getPortNotice,
    getPortSettings,
    getPortSendingData,
    getPortSendHistory,
    removePortSendHistoryItem,
    clearPortSendHistory,
    setPortSendingData,
    getPortFilters,
    setPortFilters,
    shouldFilterLog,
    getFilteredCount,
    getPortDisplaySettings,
    updatePortDisplaySettings,
    getPortStats,
    resetPortStats,
    getPortControlSettings,
    updatePortControlSettings,
    updateAppTheme,
    updateTerminalAppearance,
    applyThemeScheme,
    createThemeScheme,
    removeThemeScheme,
    resetThemeScheme,
    applyTerminalAppearanceMode,
    createCustomTerminalAppearancePreset,
    removeCustomTerminalAppearancePreset,
    resetAppTheme,
    resetTerminalAppearance,
    updateWorkspaceLayout,
    updateAppUiState,
    buildSettingsSnapshot,
    buildPortLogExport,
    buildPortPlainTextExport,
    buildAllPortLogExport,
    buildAllPortPlainTextExport,
    buildWorkspaceSnapshot,
    getResolvedAutoLogDirectory,
    saveNamedWorkspaceSnapshot,
    renameSavedWorkspaceSnapshot,
    overwriteSavedWorkspaceSnapshot,
    applySettingsSnapshot,
    applyWorkspaceSnapshot,
    applySavedWorkspaceSnapshot,
    removeSavedWorkspaceSnapshot,
    resetAppSettings,
    // Hex 工具函数
    hexToBytes,
    bytesToHex,
    isValidHex,
    // Actions
    refreshPorts,
    connect,
    disconnect,
    disconnectAll,
    sendData,
    startLoopSend,
    stopLoopSendForPort,
    stopLoopSend,
    pauseLoopSendForPort,
    resumeLoopSendForPort,
    togglePauseLoopSendForPort,
    isLoopSendPaused,
    addLog,
    addPortLog,
    getPortLogs,
    clearLogs,
    clearPortLogs,
    formatDisplayData,
    updateDefaultSetting,
    updateAutoLogSettings,
    selectAutoLogDirectory,
    openAutoLogDirectory,
    setupEventListeners,
    addCommonCommand,
    removeCommonCommand,
    updateCommonCommand,
    toggleCommandEnabled,
    loadCommonCommands,
    saveCommonCommands,
    saveSessionState,
    restoreSessionState,
    setPortNotice,
    clearPortNotice
  }
})
