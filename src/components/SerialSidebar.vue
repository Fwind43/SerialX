<script setup>
import { computed, ref } from 'vue'
import { useSerialStore } from '../stores/serial'
import DataConverter from './DataConverter.vue'

const serialStore = useSerialStore()
const showConverter = ref(false)
const showCommands = ref(false)

// 编辑命令表单
const editingCommand = ref({ name: '', command: '', id: null })
const isEditing = ref(false)
const showCommandModal = ref(false)

// 打开命令管理（添加新模式）
const openCommandManager = (cmd = null) => {
  if (cmd) {
    editingCommand.value = { ...cmd }
    isEditing.value = true
  } else {
    editingCommand.value = { name: '', command: '', id: null }
    isEditing.value = false
  }
  showCommandModal.value = true
}

// 保存命令
const saveCommand = () => {
  if (!editingCommand.value.name || !editingCommand.value.command) return

  if (isEditing.value) {
    serialStore.updateCommonCommand(editingCommand.value.id, {
      name: editingCommand.value.name,
      command: editingCommand.value.command
    })
  } else {
    serialStore.addCommonCommand(editingCommand.value.name, editingCommand.value.command)
  }
  showCommandModal.value = false
}

// 删除命令
const deleteCommand = (id) => {
  serialStore.removeCommonCommand(id)
}

// 切换命令启用状态
const toggleCommand = (id) => {
  serialStore.toggleCommandEnabled(id)
}

// 打开弹出窗口
const openConverterPopup = () => {
  if (window.electronAPI?.openConverterWindow) {
    window.electronAPI.openConverterWindow()
  }
}

// 获取已打开的串口列表
const openedPorts = computed(() => {
  return Array.from(serialStore.openPorts.entries())
    .filter(([_, data]) => data.isConnected)
    .map(([path, data]) => ({ path, ...data }))
})

const handleConnect = async (portPath = null) => {
  const targetPort = portPath || serialStore.selectedPort

  if (!targetPort) {
    serialStore.addLog('请选择串口', 'error')
    return
  }

  // 检查是否已连接
  const isConnected = serialStore.getPortStatus(targetPort)
  if (isConnected) {
    await serialStore.disconnect(targetPort)
    return
  }

  const settings = {
    ...serialStore.defaultSettings,
    path: targetPort
  }
  await serialStore.connect(targetPort, settings)
}

const handleRefresh = async () => {
  await serialStore.refreshPorts()
}
</script>

<template>
  <div class="sidebar-container">
    <!-- 侧边栏标题 -->
    <div class="sidebar-title">
      <span class="title-icon">🔌</span>
      <span class="title-text">串口设备</span>
      <div class="title-actions">
        <button @click="openConverterPopup" class="tool-btn" title="进制转换工具 (弹出窗口)">
          <span>🔢</span>
        </button>
        <button @click="showCommands = !showCommands" class="tool-btn" :class="{ active: showCommands }" title="常用命令配置">
          <span>⚡</span>
        </button>
        <button @click="showConverter = !showConverter" class="tool-btn" :class="{ active: showConverter }" title="进制转换 (侧边栏)">
          <span>📋</span>
        </button>
      </div>
    </div>

    <!-- 进制转换工具 -->
    <div v-if="showConverter" class="converter-panel">
      <DataConverter />
    </div>

    <!-- 常用命令配置面板 -->
    <div v-if="showCommands" class="commands-config-panel">
      <div class="commands-config-header">
        <span class="config-title">⚡ 常用命令配置</span>
      </div>
      <div class="commands-config-list">
        <div
          v-for="cmd in serialStore.commonCommands"
          :key="cmd.id"
          :class="['config-command-item', { disabled: !cmd.enabled }]"
        >
          <div class="config-command-info">
            <span class="config-command-name">{{ cmd.name }}</span>
            <code class="config-command-code">{{ cmd.command }}</code>
          </div>
          <div class="config-command-actions">
            <button
              @click="toggleCommand(cmd.id)"
              :class="['config-action-btn', 'toggle', cmd.enabled ? 'enabled' : 'disabled']"
              :title="cmd.enabled ? '禁用' : '启用'"
            >
              {{ cmd.enabled ? '✓' : '○' }}
            </button>
            <button
              @click="openCommandManager(cmd)"
              class="config-action-btn edit"
              title="编辑"
            >
              ✎
            </button>
            <button
              @click="deleteCommand(cmd.id)"
              class="config-action-btn delete"
              title="删除"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
      <div class="commands-config-footer">
        <button @click="openCommandManager()" class="add-command-config-btn">
          <span>+ 添加新命令</span>
        </button>
      </div>
    </div>

    <!-- 命令编辑弹窗 -->
    <div v-if="showCommandModal" class="command-modal-overlay" @click.self="showCommandModal = false">
      <div class="command-modal">
        <div class="modal-header">
          <span class="modal-title">{{ isEditing ? '编辑命令' : '添加新命令' }}</span>
          <button @click="showCommandModal = false" class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>命令名称</label>
            <input
              v-model="editingCommand.name"
              type="text"
              class="form-input"
              placeholder="例：复位、状态查询"
            />
          </div>
          <div class="form-group">
            <label>命令内容</label>
            <input
              v-model="editingCommand.command"
              type="text"
              class="form-input"
              placeholder="例：RESET、STATUS?"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showCommandModal = false" class="modal-btn cancel">取消</button>
          <button @click="saveCommand" class="modal-btn save">保存</button>
        </div>
      </div>
    </div>

    <!-- 已连接的串口列表 -->
    <div v-if="openedPorts.length > 0" class="connected-section">
      <div class="section-header">已打开的串口</div>
      <div class="connected-list">
        <div v-for="port in openedPorts" :key="port.path" class="connected-item">
          <div class="item-info">
            <span class="item-path">{{ port.path }}</span>
            <span class="item-baud">{{ port.baudRate }} baud</span>
          </div>
          <button @click="handleConnect(port.path)" class="item-close" title="断开">
            ✕
          </button>
        </div>
      </div>
    </div>

    <!-- 可用串口列表 -->
    <div class="ports-section">
      <div class="section-header">
        <span>可用串口</span>
        <button @click="handleRefresh" class="refresh-btn" title="刷新">
          ↻
        </button>
      </div>
      <div class="ports-list">
        <div v-if="serialStore.ports.length === 0" class="no-ports">
          未找到串口设备
        </div>
        <div
          v-for="port in serialStore.ports"
          :key="port.path"
          :class="['port-item', { selected: serialStore.selectedPort === port.path }]"
          @click="serialStore.selectedPort = port.path"
          @dblclick="handleConnect(port.path)"
        >
          <span class="port-icon">🔌</span>
          <span class="port-path">{{ port.path }}</span>
          <span v-if="serialStore.getPortStatus(port.path)" class="port-status-connected">●</span>
        </div>
      </div>
    </div>

    <!-- 连接按钮 -->
    <div class="connect-section">
      <button
        @click="handleConnect()"
        :class="['connect-btn', serialStore.getPortStatus(serialStore.selectedPort) ? 'connected' : 'disconnected']"
        :disabled="!serialStore.selectedPort && !isSimulationMode"
      >
        {{ serialStore.getPortStatus(serialStore.selectedPort) ? '断开连接' : '连接串口' }}
      </button>
    </div>

    <!-- 串口设置 -->
    <div class="settings-section">
      <div class="section-header">串口设置</div>
      <div class="settings-grid">
        <div class="setting-item">
          <label>波特率</label>
          <select v-model="serialStore.defaultSettings.baudRate" class="setting-select">
            <option v-for="rate in serialStore.availableBaudRates" :key="rate" :value="rate">
              {{ rate }}
            </option>
          </select>
        </div>
        <div class="setting-item">
          <label>数据位</label>
          <select v-model="serialStore.defaultSettings.dataBits" class="setting-select">
            <option :value="8">8</option>
            <option :value="7">7</option>
            <option :value="6">6</option>
            <option :value="5">5</option>
          </select>
        </div>
        <div class="setting-item">
          <label>停止位</label>
          <select v-model="serialStore.defaultSettings.stopBits" class="setting-select">
            <option :value="1">1</option>
            <option :value="2">2</option>
          </select>
        </div>
        <div class="setting-item">
          <label>校验</label>
          <select v-model="serialStore.defaultSettings.parity" class="setting-select">
            <option value="none">无</option>
            <option value="even">偶</option>
            <option value="odd">奇</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 进制转换面板 */
.converter-panel {
  flex: 1;
  overflow: hidden;
  border-bottom: 1px solid #3e3e42;
  min-height: 0;
}

/* 常用命令配置面板 */
.commands-config-panel {
  padding: 12px;
  background: linear-gradient(135deg, rgba(45, 45, 48, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%);
  border-bottom: 1px solid #3e3e42;
  max-height: 300px;
  overflow-y: auto;
}

.commands-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.config-title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.commands-config-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-command-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(30, 30, 30, 0.6);
  border: 1px solid rgba(62, 62, 66, 0.6);
  border-radius: 8px;
  transition: all 0.2s;
}

.config-command-item.disabled {
  opacity: 0.5;
  filter: grayscale(0.5);
}

.config-command-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.config-command-name {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.config-command-code {
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #4ec9b0;
  background: rgba(78, 201, 176, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  align-self: flex-start;
}

.config-command-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.config-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.config-action-btn.toggle.enabled {
  background: linear-gradient(135deg, #4ec9b0 0%, #45b8a0 100%);
  color: #1e1e1e;
  box-shadow: 0 2px 8px rgba(78, 201, 176, 0.3);
}

.config-action-btn.toggle.disabled {
  background: #3e3e42;
  color: #858585;
}

.config-action-btn.edit {
  background: linear-gradient(135deg, #569cd6 0%, #4a8dc7 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(86, 156, 214, 0.3);
}

.config-action-btn.delete {
  background: linear-gradient(135deg, #c42b1c 0%, #a82518 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(196, 43, 28, 0.3);
}

.config-action-btn:hover {
  transform: scale(1.15) translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.commands-config-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(62, 62, 66, 0.5);
}

.add-command-config-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px 16px;
  background: linear-gradient(135deg, #4ec9b0 0%, #45b8a0 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #1e1e1e;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-command-config-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(78, 201, 176, 0.4);
}

/* 命令管理弹窗 */
.command-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.command-modal {
  background: linear-gradient(145deg, #2d2d30 0%, #1e1e1e 100%);
  border: 1px solid rgba(62, 62, 66, 0.8);
  border-radius: 16px;
  padding: 24px;
  min-width: 420px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(62, 62, 66, 0.5);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #858585;
  cursor: pointer;
  font-size: 18px;
  border-radius: 8px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: rgba(196, 43, 28, 0.3);
  border-color: rgba(196, 43, 28, 0.5);
  color: #ffffff;
  transform: rotate(90deg);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 12px;
  color: #858585;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-input {
  padding: 12px 14px;
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(62, 62, 66, 0.8);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  font-family: 'Consolas', 'Monaco', monospace;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  background: rgba(30, 30, 30, 1);
}

.form-input::placeholder {
  color: #555;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid rgba(62, 62, 66, 0.5);
}

.modal-btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.modal-btn.cancel {
  background: transparent;
  border-color: rgba(62, 62, 66, 0.8);
  color: #cccccc;
}

.modal-btn.cancel:hover {
  background: rgba(62, 62, 66, 0.5);
  border-color: rgba(85, 85, 85, 0.8);
}

.modal-btn.save {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.modal-btn.save:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

/* 侧边栏标题 */
.sidebar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
}

.title-icon {
  font-size: 16px;
}

.title-text {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 工具按钮 */
.tool-btn {
  background: none;
  border: 1px solid #555;
  color: #cccccc;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 3px;
  transition: all 0.15s;
}

.tool-btn:hover {
  background-color: #3e3e42;
  border-color: #007acc;
  color: #ffffff;
}

.tool-btn.active {
  background-color: #007acc;
  border-color: #007acc;
  color: #ffffff;
}

.title-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

/* 模拟模式开关 */
.simulation-toggle {
  padding: 10px 14px;
  border-bottom: 1px solid #3e3e42;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.toggle-label input[type="checkbox"] {
  accent-color: #4ec9b0;
  width: 16px;
  height: 16px;
}

.toggle-text {
  font-size: 13px;
  color: #4ec9b0;
}

/* 已连接的串口 */
.connected-section {
  border-bottom: 1px solid #3e3e42;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #858585;
  text-transform: uppercase;
}

.refresh-btn {
  background: none;
  border: none;
  color: #858585;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 3px;
}

.refresh-btn:hover {
  background-color: #3e3e42;
  color: #ffffff;
}

.connected-list {
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.connected-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background-color: #1e1e1e;
  border-radius: 3px;
  border-left: 3px solid #4ec9b0;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-path {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.item-baud {
  font-size: 11px;
  color: #858585;
}

.item-actions {
  display: flex;
  gap: 4px;
}

.item-send {
  background: none;
  border: none;
  color: #4ec9b0;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 3px;
  line-height: 1;
}

.item-send:hover:not(:disabled) {
  background-color: #0e639c;
  color: #ffffff;
}

.item-send:disabled {
  color: #555;
  cursor: not-allowed;
}

.item-close {
  background: none;
  border: none;
  color: #858585;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  border-radius: 3px;
  line-height: 1;
}

.item-close:hover {
  background-color: #c42b1c;
  color: #ffffff;
}

/* 可用串口列表 */
.ports-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #3e3e42;
}

.ports-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.no-ports {
  padding: 20px 10px;
  text-align: center;
  color: #858585;
  font-size: 13px;
}

.port-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.port-item:hover {
  background-color: #2a2d2e;
}

.port-item.selected {
  background-color: #37373d;
}

.port-icon {
  font-size: 14px;
}

.port-path {
  flex: 1;
  font-size: 13px;
  color: #cccccc;
}

.port-status {
  font-size: 11px;
  color: #4ec9b0;
  padding: 2px 6px;
  background-color: #4ec9b033;
  border-radius: 3px;
}

.port-status-connected {
  font-size: 12px;
  color: #4ec9b0;
}

/* 连接按钮 */
.connect-section {
  padding: 10px 14px;
  border-bottom: 1px solid #3e3e42;
}

.connect-btn {
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 3px;
  color: white;
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.connect-btn.connected {
  background-color: #c42b1c;
}

.connect-btn.connected:hover {
  background-color: #d43b2c;
}

.connect-btn.disconnected {
  background-color: #0e639c;
}

.connect-btn.disconnected:hover {
  background-color: #1177bb;
}

.connect-btn:disabled {
  background-color: #3e3e42;
  color: #555;
  cursor: not-allowed;
}

/* 串口设置 */
.settings-section {
  padding: 10px 14px;
  background-color: #252526;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-item label {
  font-size: 11px;
  color: #858585;
  text-transform: uppercase;
}

.setting-select {
  padding: 6px 8px;
  background-color: #3c3c3c;
  border: 1px solid #555;
  color: #cccccc;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
}

.setting-select:focus {
  outline: none;
  border-color: #007acc;
}
</style>
