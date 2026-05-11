import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { SerialPort } from 'serialport'
import { execSync } from 'child_process'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 安全日志函数，避免 EPIPE 错误
const safeLog = (...args) => {
  try {
    console.log(...args)
  } catch (e) {
    // Ignore EPIPE errors
  }
}

const safeErrorLog = (...args) => {
  try {
    console.error(...args)
  } catch (e) {
    // Ignore EPIPE errors
  }
}

// 配置文件路径（用户数据目录）
const getConfigPath = () => {
  const configDir = path.join(app.getPath('userData'), 'config')
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
  return path.join(configDir, 'settings.json')
}

// 加载配置
function loadConfig() {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    safeErrorLog('[Config] Error loading config:', error)
  }
  return {}
}

// 保存配置
function saveConfig(config) {
  try {
    const configPath = getConfigPath()
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
    return { success: true }
  } catch (error) {
    safeErrorLog('[Config] Error saving config:', error)
    return { success: false, error: error.message }
  }
}

const MAIN_WINDOW_DEFAULT_BOUNDS = {
  width: 1400,
  height: 900
}

const MAIN_WINDOW_MIN_BOUNDS = {
  width: 800,
  height: 600
}

function getMainWindowState() {
  const config = loadConfig()
  const savedState = config?.windowState?.main || {}
  const width = Math.max(MAIN_WINDOW_MIN_BOUNDS.width, Number(savedState.width) || MAIN_WINDOW_DEFAULT_BOUNDS.width)
  const height = Math.max(MAIN_WINDOW_MIN_BOUNDS.height, Number(savedState.height) || MAIN_WINDOW_DEFAULT_BOUNDS.height)

  return {
    width,
    height,
    x: Number.isFinite(savedState.x) ? savedState.x : undefined,
    y: Number.isFinite(savedState.y) ? savedState.y : undefined,
    isMaximized: savedState.isMaximized === true
  }
}

function saveMainWindowState(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return

  const config = loadConfig()
  const bounds = targetWindow.isMaximized()
    ? targetWindow.getNormalBounds()
    : targetWindow.getBounds()

  config.windowState = {
    ...(config.windowState || {}),
    main: {
      x: bounds.x,
      y: bounds.y,
      width: Math.max(MAIN_WINDOW_MIN_BOUNDS.width, bounds.width),
      height: Math.max(MAIN_WINDOW_MIN_BOUNDS.height, bounds.height),
      isMaximized: targetWindow.isMaximized()
    }
  }

  saveConfig(config)
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function getDefaultAutoLogDirectory() {
  const logDir = path.join(app.getPath('documents'), 'SerialX', 'Logs')
  ensureDirectory(logDir)
  return logDir
}

function sanitizeLogFileSegment(value = '') {
  return String(value || 'unknown')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function resolveAutoLogDirectory(dirPath = '') {
  const resolvedPath = typeof dirPath === 'string' && dirPath.trim()
    ? path.resolve(dirPath.trim())
    : getDefaultAutoLogDirectory()

  ensureDirectory(resolvedPath)
  return resolvedPath
}

function buildAutoLogFilePath({ directory = '', portPath = '', format = 'txt', recordedAt = '' }) {
  const targetDir = resolveAutoLogDirectory(directory)
  const stamp = recordedAt ? new Date(recordedAt) : new Date()
  const safeDate = Number.isNaN(stamp.getTime())
    ? new Date().toISOString().slice(0, 10)
    : stamp.toISOString().slice(0, 10)
  const extension = format === 'jsonl' ? 'jsonl' : 'txt'
  const safePort = sanitizeLogFileSegment(portPath)
  return path.join(targetDir, `${safePort}-${safeDate}.${extension}`)
}

function formatAutoLogTextLine(entry = {}) {
  const level = String(entry.type || 'info').toUpperCase()
  const timestamp = typeof entry.recordedAt === 'string' && entry.recordedAt
    ? entry.recordedAt.replace('T', ' ').replace('Z', '')
    : new Date().toISOString().replace('T', ' ').replace('Z', '')
  const content = typeof entry.pureData === 'string' && entry.pureData.length
    ? entry.pureData
    : (entry.message ?? '')
  const hexSuffix = typeof entry.hexData === 'string' && entry.hexData
    ? ` | HEX ${entry.hexData}`
    : ''
  return `[${timestamp}] [${level}] ${content}${hexSuffix}`
}

async function appendAutoSavedLogs(payload = {}) {
  try {
    const {
      directory = '',
      format = 'txt',
      portLogs = []
    } = payload || {}

    if (!Array.isArray(portLogs) || portLogs.length === 0) {
      return { success: true, writtenFiles: [] }
    }

    const fileChunks = new Map()

    for (const item of portLogs) {
      if (!item || typeof item.portPath !== 'string' || !Array.isArray(item.logs) || item.logs.length === 0) {
        continue
      }

      for (const logEntry of item.logs) {
        const filePath = buildAutoLogFilePath({
          directory,
          portPath: item.portPath,
          format,
          recordedAt: logEntry?.recordedAt
        })
        const line = format === 'jsonl'
          ? JSON.stringify({
              portPath: item.portPath,
              ...logEntry
            })
          : formatAutoLogTextLine(logEntry)
        const current = fileChunks.get(filePath) || []
        current.push(line)
        fileChunks.set(filePath, current)
      }
    }

    const writtenFiles = []
    for (const [filePath, lines] of fileChunks.entries()) {
      if (!lines.length) continue
      fs.appendFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
      writtenFiles.push(filePath)
    }

    return { success: true, writtenFiles }
  } catch (error) {
    safeErrorLog('[Logs] Error auto-saving logs:', error)
    return { success: false, error: error.message }
  }
}

async function selectLogDirectory(defaultPath = '') {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择自动日志保存目录',
      defaultPath: resolveAutoLogDirectory(defaultPath),
      properties: ['openDirectory', 'createDirectory']
    })

    if (canceled || !filePaths?.length) {
      return { success: false, canceled: true }
    }

    return {
      success: true,
      directoryPath: filePaths[0]
    }
  } catch (error) {
    safeErrorLog('[Logs] Error selecting log directory:', error)
    return { success: false, error: error.message }
  }
}

async function openLogDirectory(dirPath = '') {
  try {
    const targetDir = resolveAutoLogDirectory(dirPath)
    const errorMessage = await shell.openPath(targetDir)
    if (errorMessage) {
      return { success: false, error: errorMessage }
    }
    return { success: true, directoryPath: targetDir }
  } catch (error) {
    safeErrorLog('[Logs] Error opening log directory:', error)
    return { success: false, error: error.message }
  }
}

async function exportSettingsFile(payload) {
  try {
    const defaultFileName = `serialx-settings-${new Date().toISOString().slice(0, 10)}.json`
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 SerialX 设置',
      defaultPath: path.join(app.getPath('documents'), defaultFileName),
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
    return { success: true, filePath }
  } catch (error) {
    safeErrorLog('[Settings] Error exporting settings:', error)
    return { success: false, error: error.message }
  }
}

async function importSettingsFile() {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '导入 SerialX 设置',
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })

    if (canceled || !filePaths?.length) {
      return { success: false, canceled: true }
    }

    const filePath = filePaths[0]
    const content = fs.readFileSync(filePath, 'utf8')
    return {
      success: true,
      filePath,
      data: JSON.parse(content)
    }
  } catch (error) {
    safeErrorLog('[Settings] Error importing settings:', error)
    return { success: false, error: error.message }
  }
}

async function exportLogsFile(payload, suggestedName = '') {
  try {
    const defaultFileName = suggestedName || `serialx-logs-${new Date().toISOString().slice(0, 10)}.json`
    const isTextPayload = typeof payload === 'string'
    const isTextFile = path.extname(defaultFileName).toLowerCase() === '.txt'
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 SerialX 日志',
      defaultPath: path.join(app.getPath('documents'), defaultFileName),
      filters: [
        isTextPayload || isTextFile
          ? { name: 'Text Files', extensions: ['txt'] }
          : { name: 'JSON Files', extensions: ['json'] }
      ]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    if (isTextPayload) {
      fs.writeFileSync(filePath, payload, 'utf8')
    } else {
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
    }
    return { success: true, filePath }
  } catch (error) {
    safeErrorLog('[Logs] Error exporting logs:', error)
    return { success: false, error: error.message }
  }
}

async function exportWorkspaceSnapshotFile(payload) {
  try {
    const defaultFileName = `serialx-workspace-${new Date().toISOString().slice(0, 10)}.json`
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 SerialX 工作区快照',
      defaultPath: path.join(app.getPath('documents'), defaultFileName),
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
    return { success: true, filePath }
  } catch (error) {
    safeErrorLog('[Workspace] Error exporting snapshot:', error)
    return { success: false, error: error.message }
  }
}

async function importWorkspaceSnapshotFile() {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '导入 SerialX 工作区快照',
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })

    if (canceled || !filePaths?.length) {
      return { success: false, canceled: true }
    }

    const filePath = filePaths[0]
    const content = fs.readFileSync(filePath, 'utf8')
    return {
      success: true,
      filePath,
      data: JSON.parse(content)
    }
  } catch (error) {
    safeErrorLog('[Workspace] Error importing snapshot:', error)
    return { success: false, error: error.message }
  }
}

async function selectWallpaperFile() {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择壁纸图片',
      properties: ['openFile'],
      filters: [
        { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }
      ]
    })

    if (canceled || !filePaths?.length) {
      return { success: false, canceled: true }
    }

    return {
      success: true,
      filePath: filePaths[0]
    }
  } catch (error) {
    safeErrorLog('[Wallpaper] Error selecting wallpaper:', error)
    return { success: false, error: error.message }
  }
}

function getMimeTypeFromFilePath(filePath) {
  const ext = path.extname(filePath || '').toLowerCase()
  const mimeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
  }

  return mimeMap[ext] || 'application/octet-stream'
}

async function readWallpaperDataUrl(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'Wallpaper file not found' }
    }

    const data = fs.readFileSync(filePath)
    return {
      success: true,
      dataUrl: `data:${getMimeTypeFromFilePath(filePath)};base64,${data.toString('base64')}`
    }
  } catch (error) {
    safeErrorLog('[Wallpaper] Error reading wallpaper:', error)
    return { success: false, error: error.message }
  }
}

// 通过注册表获取串口列表（兼容 com0com 等虚拟串口）
function getPortsFromRegistry() {
  try {
    const output = execSync(
      'reg query "HKEY_LOCAL_MACHINE\\HARDWARE\\DEVICEMAP\\SERIALCOMM" /s 2>nul',
      { encoding: 'utf8', windowsHide: true }
    )

    const ports = []
    const lines = output.split('\n')

    for (const line of lines) {
      if (line.includes('REG_SZ')) {
        const parts = line.trim().split(/\s+/)
        // 格式：\Device\com0com10    REG_SZ    CNCA0
        if (parts.length >= 3) {
          const deviceName = parts[parts.length - 1] // 如 CNCA0, COM1, COM2
          if (deviceName && (deviceName.startsWith('COM') || deviceName.startsWith('CNC'))) {
            ports.push({
              path: deviceName,
              manufacturer: 'Virtual Serial Port',
              serialNumber: 'N/A',
              vendorId: 'N/A',
              productId: 'N/A'
            })
          }
        }
      }
    }

    safeLog('[Registry] Found ports:', ports)
    return ports
  } catch (error) {
    safeErrorLog('[Registry] Error reading ports:', error.message)
    return []
  }
}

// SerialManager 类 - 支持多串口
class SerialManager {
  constructor() {
    this.ports = new Map() // 存储多个串口实例：path -> { port, parser, isOpen }
    this.dataBuffers = new Map() // 每个串口的数据缓冲区
    this.flushTimers = new Map() // 每个串口的刷新定时器
    this.packetTimeouts = new Map() // 每个串口的分包超时时间（毫秒）
  }

  normalizePacketTimeout(value) {
    const timeout = Number(value)
    if (!Number.isFinite(timeout)) return 500
    return Math.max(1, Math.min(60000, Math.round(timeout)))
  }

  setPacketTimeout(portPath, packetTimeout) {
    if (!portPath) {
      return { success: false, error: '端口路径不能为空' }
    }

    const normalizedTimeout = this.normalizePacketTimeout(packetTimeout)
    this.packetTimeouts.set(portPath, normalizedTimeout)
    safeLog('[SerialManager] Packet timeout updated:', portPath, normalizedTimeout)
    return { success: true, packetTimeout: normalizedTimeout }
  }

  async listPorts() {
    try {
      safeLog('[SerialManager] Listing ports...')

      // 方法 1: 尝试使用 serialport 库
      const nativePorts = await SerialPort.list()
      safeLog('[SerialManager] Native ports:', nativePorts)

      if (nativePorts.length > 0) {
        return nativePorts.map(port => ({
          path: port.path,
          manufacturer: port.manufacturer || 'Unknown',
          serialNumber: port.serialNumber || 'N/A',
          vendorId: port.vendorId || 'N/A',
          productId: port.productId || 'N/A',
          isOpen: this.ports.has(port.path) && this.ports.get(port.path).isOpen
        }))
      }

      // 方法 2: 如果 serialport 找不到，尝试注册表（兼容 com0com）
      safeLog('[SerialManager] Native list empty, trying registry...')
      const registryPorts = getPortsFromRegistry()

      if (registryPorts.length > 0) {
        return registryPorts.map(port => ({
          ...port,
          isOpen: this.ports.has(port.path) && this.ports.get(port.path).isOpen
        }))
      }

      safeLog('[SerialManager] No ports found')
      return []
    } catch (error) {
      safeErrorLog('[SerialManager] Error listing ports:', error)
      return getPortsFromRegistry()
    }
  }

  async openPort(options) {
    const { path: portPath, baudRate = 9600, dataBits = 8, stopBits = 1, parity = 'none', packetTimeout = 500 } = options || {}

    if (!portPath) {
      return { success: false, error: '端口路径不能为空' }
    }

    // 检查是否已经打开
    if (this.ports.has(portPath) && this.ports.get(portPath).isOpen) {
      return { success: false, error: `串口 ${portPath} 已经打开` }
    }

    try {
      safeLog('[SerialManager] Opening port:', portPath, options)

      const serialPort = new SerialPort({
        path: portPath,
        baudRate,
        dataBits,
        stopBits,
        parity,
        autoOpen: false
      })

      await serialPort.open()

      const portData = {
        port: serialPort,
        isOpen: true
      }
      this.ports.set(portPath, portData)

      safeLog('[SerialManager] Port opened successfully:', portPath)

      // 初始化该串口的缓冲区
      this.dataBuffers.set(portPath, [])
      this.setPacketTimeout(portPath, packetTimeout)
      // 按“分包超时”聚合接收数据：超时窗口内持续收到数据则延后刷新。
      // 为避免异常大流量无限堆积，达到安全阈值时仍立即刷新。
      const MAX_BUFFER_SIZE = 1024 * 1024 // 1MB 直接触发立即刷新
      const MAX_CHUNK_COUNT = 1024 // 1024 个数据块直接触发立即刷新

      const flushBuffer = () => {
        const pendingTimer = this.flushTimers.get(portPath)
        if (pendingTimer) {
          clearTimeout(pendingTimer)
          this.flushTimers.delete(portPath)
        }

        const buffer = this.dataBuffers.get(portPath)
        if (!buffer || buffer.length === 0 || !mainWindow) return

        // 合并缓冲区数据
        const mergedData = Buffer.concat(buffer)
        buffer.length = 0 // 清空数组

        const text = mergedData.toString('utf8')
        const hexData = mergedData.toString('hex').toUpperCase()
        const hexFormatted = hexData.match(/.{1,2}/g)?.join(' ') || ''

        mainWindow.webContents.send('serial:data', {
          port: portPath,
          data: text,
          hexData: hexFormatted,
          rawBytes: Array.from(mergedData)
        })
      }

      const scheduleFlushByPacketTimeout = () => {
        const pendingTimer = this.flushTimers.get(portPath)
        if (pendingTimer) {
          clearTimeout(pendingTimer)
        }

        const timeout = this.packetTimeouts.get(portPath) ?? 500
        const timer = setTimeout(() => {
          this.flushTimers.delete(portPath)
          flushBuffer()
        }, timeout)
        this.flushTimers.set(portPath, timer)
      }

      serialPort.on('data', (data) => {
        const buffer = this.dataBuffers.get(portPath)
        if (!buffer) return

        // 直接保存数据块，不做额外处理
        buffer.push(data)

        // 更激进的批量刷新策略
        const totalSize = buffer.reduce((acc, buf) => acc + buf.length, 0)
        if (totalSize >= MAX_BUFFER_SIZE || buffer.length >= MAX_CHUNK_COUNT) {
          flushBuffer()
        } else {
          scheduleFlushByPacketTimeout()
        }
      })

      serialPort.on('error', (error) => {
        safeErrorLog('[SerialManager] Port error:', portPath, error)
        if (mainWindow) {
          mainWindow.webContents.send('serial:error', { port: portPath, error: error.message })
        }
      })

      serialPort.on('close', () => {
        const portData = this.ports.get(portPath)
        if (portData) {
          portData.isOpen = false
        }
        if (mainWindow) {
          mainWindow.webContents.send('serial:closed', { port: portPath })
        }
      })

      return { success: true, message: `串口 ${portPath} 打开成功` }
    } catch (error) {
      safeErrorLog('[SerialManager] Error opening port:', error)
      return { success: false, error: error.message }
    }
  }

  async closePort(portPath) {
    if (!portPath) {
      // 关闭所有串口
      const closePromises = Array.from(this.ports.keys()).map(path => this.closePort(path))
      await Promise.all(closePromises)
      return { success: true, message: '已关闭所有串口' }
    }

    const portData = this.ports.get(portPath)
    if (!portData || !portData.isOpen) {
      return { success: true, message: `串口 ${portPath} 未打开` }
    }

    try {
      // 清理定时器和缓冲区
      const timer = this.flushTimers.get(portPath)
      if (timer) {
        clearTimeout(timer)
        this.flushTimers.delete(portPath)
      }
      this.dataBuffers.delete(portPath)
      this.packetTimeouts.delete(portPath)

      await portData.port.close()
      portData.isOpen = false
      this.ports.delete(portPath)
      safeLog('[SerialManager] Port closed:', portPath)
      return { success: true, message: `串口 ${portPath} 已关闭` }
    } catch (error) {
      safeErrorLog('[SerialManager] Error closing port:', portPath, error)
      return { success: false, error: error.message }
    }
  }

  async write(portPath, data) {
    const portData = this.ports.get(portPath)
    if (!portData || !portData.isOpen) {
      return { success: false, error: `串口 ${portPath} 未打开` }
    }

    try {
      await portData.port.write(data)
      return { success: true }
    } catch (error) {
      console.error('[SerialManager] Error writing to port:', portPath, error)
      return { success: false, error: error.message }
    }
  }

  isOpen(portPath) {
    const portData = this.ports.get(portPath)
    return portData ? portData.isOpen : false
  }

  getOpenPorts() {
    return Array.from(this.ports.entries())
      .filter(([_, data]) => data.isOpen)
      .map(([path, data]) => path)
  }
}

let mainWindow = null
let converterWindow = null
let appearanceWindow = null
let commandsWindow = null
let serialManager = null
let latestUiStateSnapshot = null
let latestCommonCommandsSnapshot = null
let saveMainWindowStateTimer = null

function createWindow() {
  const mainWindowState = getMainWindowState()
  mainWindow = new BrowserWindow({
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    minWidth: MAIN_WINDOW_MIN_BOUNDS.width,
    minHeight: MAIN_WINDOW_MIN_BOUNDS.height,
    frame: false,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 监听窗口状态变化并通知渲染进程
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized')
    saveMainWindowState(mainWindow)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:unmaximized')
    saveMainWindowState(mainWindow)
  })

  const scheduleMainWindowStateSave = () => {
    if (saveMainWindowStateTimer) {
      clearTimeout(saveMainWindowStateTimer)
    }

    saveMainWindowStateTimer = setTimeout(() => {
      saveMainWindowStateTimer = null
      saveMainWindowState(mainWindow)
    }, 180)
  }

  mainWindow.on('resize', scheduleMainWindowStateSave)
  mainWindow.on('move', scheduleMainWindowStateSave)

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // 生产环境：使用 file:// 协议加载打包后的文件
    const indexPath = path.join(__dirname, '../out/renderer/index.html')
    mainWindow.loadFile(indexPath)
  }

  mainWindow.on('closed', () => {
    if (saveMainWindowStateTimer) {
      clearTimeout(saveMainWindowStateTimer)
      saveMainWindowStateTimer = null
    }
    if (appearanceWindow && !appearanceWindow.isDestroyed()) {
      appearanceWindow.close()
    }
    if (commandsWindow && !commandsWindow.isDestroyed()) {
      commandsWindow.close()
    }
    mainWindow = null
  })

  mainWindow.on('close', () => {
    saveMainWindowState(mainWindow)
  })

  if (mainWindowState.isMaximized) {
    mainWindow.maximize()
  }
}

function createConverterWindow() {
  if (converterWindow) {
    converterWindow.focus()
    return converterWindow
  }

  converterWindow = new BrowserWindow({
    width: 500,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    frame: false,
    resizable: true,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    converterWindow.loadURL((process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173') + '/#/converter')
  } else {
    converterWindow.loadFile(path.join(__dirname, '../out/renderer/index.html'), {
      hash: '/converter'
    })
  }

  converterWindow.on('closed', () => {
    converterWindow = null
  })

  return converterWindow
}

function loadWindowRoute(targetWindow, hashRoute = '') {
  if (process.env.NODE_ENV === 'development') {
    const baseUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'
    const route = hashRoute ? `/#${hashRoute}` : ''
    targetWindow.loadURL(`${baseUrl}${route}`)
  } else {
    targetWindow.loadFile(path.join(__dirname, '../out/renderer/index.html'), {
      hash: hashRoute || undefined
    })
  }
}

function sendUiStateSnapshot(targetWindow, snapshot) {
  if (!targetWindow || targetWindow.isDestroyed() || !snapshot) return
  targetWindow.webContents.send('ui-state:update', snapshot)
}

function broadcastUiStateSnapshot(snapshot, sender = null) {
  latestUiStateSnapshot = snapshot
  const windows = [mainWindow, appearanceWindow, commandsWindow]

  windows.forEach((targetWindow) => {
    if (!targetWindow || targetWindow.isDestroyed()) return
    if (sender && targetWindow.webContents.id === sender.id) return
    targetWindow.webContents.send('ui-state:update', snapshot)
  })
}

function sendCommonCommandsSnapshot(targetWindow, snapshot) {
  if (!targetWindow || targetWindow.isDestroyed() || !Array.isArray(snapshot)) return
  targetWindow.webContents.send('common-commands:update', snapshot)
}

function broadcastCommonCommandsSnapshot(snapshot, sender = null) {
  if (!Array.isArray(snapshot)) return
  latestCommonCommandsSnapshot = snapshot
  const windows = [mainWindow, commandsWindow]

  windows.forEach((targetWindow) => {
    if (!targetWindow || targetWindow.isDestroyed()) return
    if (sender && targetWindow.webContents.id === sender.id) return
    targetWindow.webContents.send('common-commands:update', snapshot)
  })
}

function createAppearanceWindow() {
  if (appearanceWindow && !appearanceWindow.isDestroyed()) {
    if (appearanceWindow.isMinimized()) {
      appearanceWindow.restore()
    }
    appearanceWindow.show()
    appearanceWindow.focus()
    return appearanceWindow
  }

  appearanceWindow = new BrowserWindow({
    width: 1120,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    title: 'SerialX 外观设置',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  loadWindowRoute(appearanceWindow, '/appearance')

  appearanceWindow.webContents.on('did-finish-load', () => {
    if (latestUiStateSnapshot) {
      sendUiStateSnapshot(appearanceWindow, latestUiStateSnapshot)
    }
  })

  appearanceWindow.webContents.on('render-process-gone', () => {
    if (appearanceWindow && !appearanceWindow.isDestroyed()) {
      appearanceWindow.destroy()
    }
    appearanceWindow = null
  })

  appearanceWindow.on('closed', () => {
    appearanceWindow = null
  })

  return appearanceWindow
}

function createCommandsWindow() {
  if (commandsWindow && !commandsWindow.isDestroyed()) {
    if (commandsWindow.isMinimized()) {
      commandsWindow.restore()
    }
    commandsWindow.show()
    commandsWindow.focus()
    return commandsWindow
  }

  commandsWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 840,
    minHeight: 600,
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    title: 'SerialX 常用命令配置',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  loadWindowRoute(commandsWindow, '/commands')

  commandsWindow.webContents.on('did-finish-load', () => {
    if (latestUiStateSnapshot) {
      sendUiStateSnapshot(commandsWindow, latestUiStateSnapshot)
    }
    if (latestCommonCommandsSnapshot) {
      sendCommonCommandsSnapshot(commandsWindow, latestCommonCommandsSnapshot)
    }
  })

  commandsWindow.webContents.on('render-process-gone', () => {
    if (commandsWindow && !commandsWindow.isDestroyed()) {
      commandsWindow.destroy()
    }
    commandsWindow = null
  })

  commandsWindow.on('closed', () => {
    commandsWindow = null
  })

  return commandsWindow
}

app.whenReady().then(() => {
  serialManager = new SerialManager()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // IPC Handlers - 支持多串口
  ipcMain.handle('serial:list-ports', async () => {
    return await serialManager.listPorts()
  })

  ipcMain.handle('serial:open', async (event, options) => {
    return await serialManager.openPort(options)
  })

  ipcMain.handle('serial:close', async (event, portPath) => {
    return await serialManager.closePort(portPath)
  })

  ipcMain.handle('serial:write', async (event, portPath, data) => {
    return await serialManager.write(portPath, data)
  })

  ipcMain.handle('serial:set-packet-timeout', async (event, portPath, packetTimeout) => {
    return serialManager.setPacketTimeout(portPath, packetTimeout)
  })

  ipcMain.handle('serial:isOpen', async (event, portPath) => {
    return serialManager.isOpen(portPath)
  })

  ipcMain.handle('serial:get-open-ports', async () => {
    return serialManager.getOpenPorts()
  })

  // 打开进制转换工具窗口
  ipcMain.on('window:open-converter', () => {
    createConverterWindow()
  })

  ipcMain.on('window:open-appearance', () => {
    createAppearanceWindow()
  })

  ipcMain.on('window:open-commands', () => {
    createCommandsWindow()
  })

  // 窗口控制
  ipcMain.on('window:minimize', (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow
    if (targetWindow) {
      targetWindow.minimize()
    }
  })

  ipcMain.on('window:maximize', (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow
    if (targetWindow) {
      if (!targetWindow.isMaximized()) {
        targetWindow.maximize()
      }
    }
  })

  ipcMain.on('window:unmaximize', (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow
    if (targetWindow) {
      targetWindow.unmaximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow
    if (targetWindow) {
      targetWindow.close()
    }
  })

  ipcMain.handle('window:set-always-on-top', (event, value) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow
    if (!targetWindow) return false

    const nextValue = Boolean(value)
    targetWindow.setAlwaysOnTop(nextValue)
    return targetWindow.isAlwaysOnTop()
  })

  ipcMain.handle('window:get-always-on-top', (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow
    if (!targetWindow) return false
    return targetWindow.isAlwaysOnTop()
  })

  // 配置管理 - 常用命令持久化
  ipcMain.handle('config:load', async () => {
    return loadConfig()
  })

  ipcMain.handle('config:save', async (event, config) => {
    return saveConfig(config)
  })

  ipcMain.handle('settings:export', async (event, payload) => {
    return exportSettingsFile(payload)
  })

  ipcMain.handle('settings:import', async () => {
    return importSettingsFile()
  })

  ipcMain.handle('logs:export', async (event, payload, suggestedName) => {
    return exportLogsFile(payload, suggestedName)
  })

  ipcMain.handle('logs:auto-save', async (event, payload) => {
    return appendAutoSavedLogs(payload)
  })

  ipcMain.handle('logs:get-default-directory', async () => {
    return { success: true, directoryPath: getDefaultAutoLogDirectory() }
  })

  ipcMain.handle('logs:select-directory', async (event, defaultPath) => {
    return selectLogDirectory(defaultPath)
  })

  ipcMain.handle('logs:open-directory', async (event, dirPath) => {
    return openLogDirectory(dirPath)
  })

  ipcMain.handle('workspace:export', async (event, payload) => {
    return exportWorkspaceSnapshotFile(payload)
  })

  ipcMain.handle('workspace:import', async () => {
    return importWorkspaceSnapshotFile()
  })

  ipcMain.handle('wallpaper:select', async () => {
    return selectWallpaperFile()
  })

  ipcMain.handle('wallpaper:read-data-url', async (event, filePath) => {
    return readWallpaperDataUrl(filePath)
  })

  ipcMain.handle('ui-state:get-latest', async () => {
    return latestUiStateSnapshot
  })

  ipcMain.on('ui-state:push', (event, snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return
    broadcastUiStateSnapshot(snapshot, event.sender)
  })

  ipcMain.handle('common-commands:get-latest', async () => {
    return latestCommonCommandsSnapshot
  })

  ipcMain.on('common-commands:push', (event, snapshot) => {
    if (!Array.isArray(snapshot)) return
    broadcastCommonCommandsSnapshot(snapshot, event.sender)
  })
})

app.on('window-all-closed', () => {
  if (serialManager) {
    serialManager.closePort()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (serialManager) {
    serialManager.closePort()
  }
})
