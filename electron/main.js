import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { SerialPort } from 'serialport'
import { execSync } from 'child_process'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    console.error('[Config] Error loading config:', error)
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
    console.error('[Config] Error saving config:', error)
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

    console.log('[Registry] Found ports:', ports)
    return ports
  } catch (error) {
    console.error('[Registry] Error reading ports:', error.message)
    return []
  }
}

// SerialManager 类 - 支持多串口
class SerialManager {
  constructor() {
    this.ports = new Map() // 存储多个串口实例：path -> { port, parser, isOpen }
  }

  async listPorts() {
    try {
      console.log('[SerialManager] Listing ports...')

      // 方法 1: 尝试使用 serialport 库
      const nativePorts = await SerialPort.list()
      console.log('[SerialManager] Native ports:', nativePorts)

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
      console.log('[SerialManager] Native list empty, trying registry...')
      const registryPorts = getPortsFromRegistry()

      if (registryPorts.length > 0) {
        return registryPorts.map(port => ({
          ...port,
          isOpen: this.ports.has(port.path) && this.ports.get(port.path).isOpen
        }))
      }

      console.log('[SerialManager] No ports found')
      return []
    } catch (error) {
      console.error('[SerialManager] Error listing ports:', error)
      return getPortsFromRegistry()
    }
  }

  async openPort(options) {
    const { path: portPath, baudRate = 9600, dataBits = 8, stopBits = 1, parity = 'none' } = options || {}

    if (!portPath) {
      return { success: false, error: '端口路径不能为空' }
    }

    // 检查是否已经打开
    if (this.ports.has(portPath) && this.ports.get(portPath).isOpen) {
      return { success: false, error: `串口 ${portPath} 已经打开` }
    }

    try {
      console.log('[SerialManager] Opening port:', portPath, options)

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

      console.log('[SerialManager] Port opened successfully:', portPath)

      // 监听原始数据（每个字节都触发）
      serialPort.on('data', (data) => {
        const text = data.toString('utf8')
        console.log('[SerialManager] Raw data from', portPath, ':', JSON.stringify(text))
        if (mainWindow) {
          mainWindow.webContents.send('serial:data', { port: portPath, data: text })
        }
      })

      serialPort.on('error', (error) => {
        console.error('[SerialManager] Port error:', portPath, error)
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
      console.error('[SerialManager] Error opening port:', error)
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
      await portData.port.close()
      portData.isOpen = false
      this.ports.delete(portPath)
      console.log('[SerialManager] Port closed:', portPath)
      return { success: true, message: `串口 ${portPath} 已关闭` }
    } catch (error) {
      console.error('[SerialManager] Error closing port:', portPath, error)
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
let serialManager = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
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
    resizable: true,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    converterWindow.loadURL('http://localhost:5173/#/converter')
  } else {
    converterWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/converter'
    })
  }

  converterWindow.on('closed', () => {
    converterWindow = null
  })

  return converterWindow
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

  // 配置管理 - 常用命令持久化
  ipcMain.handle('config:load', async () => {
    return loadConfig()
  })

  ipcMain.handle('config:save', async (event, config) => {
    return saveConfig(config)
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
