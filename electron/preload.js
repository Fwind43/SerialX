import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Serial Port Operations - 支持多串口
  listPorts: () => ipcRenderer.invoke('serial:list-ports'),
  openPort: (options) => ipcRenderer.invoke('serial:open', options),
  closePort: (portPath) => ipcRenderer.invoke('serial:close', portPath),
  writeData: (portPath, data) => ipcRenderer.invoke('serial:write', portPath, data),
  isOpen: (portPath) => ipcRenderer.invoke('serial:isOpen', portPath),
  getOpenPorts: () => ipcRenderer.invoke('serial:get-open-ports'),

  // Config Operations - 配置持久化
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  // Window Operations
  openConverterWindow: () => ipcRenderer.send('window:open-converter'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Serial Data Events (from main to renderer) - 数据包含串口路径
  onSerialData: (callback) => {
    ipcRenderer.removeAllListeners('serial:data')
    ipcRenderer.on('serial:data', (event, data) => callback(data))
  },
  onSerialError: (callback) => {
    ipcRenderer.removeAllListeners('serial:error')
    ipcRenderer.on('serial:error', (event, error) => callback(error))
  },
  onPortClosed: (callback) => {
    ipcRenderer.removeAllListeners('serial:closed')
    ipcRenderer.on('serial:closed', (event, data) => callback(data))
  },

  // App Info
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
})
