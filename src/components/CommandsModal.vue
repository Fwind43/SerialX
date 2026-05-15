<script setup>
import { ref, computed } from 'vue'
import { useSerialStore } from '../stores/serial'

const serialStore = useSerialStore()

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  standalone: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show'])

// 编辑命令表单
const editingCommand = ref({ name: '', command: '', group: '默认', id: null })
const isEditing = ref(false)
const showEditModalInner = ref(false)
const searchQuery = ref('')
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase())
const groupedCommands = computed(() => {
  const groups = new Map()
  serialStore.commonCommands
    .filter((cmd) => {
      if (!normalizedSearchQuery.value) return true
      const haystack = [
        cmd.name,
        cmd.command,
        cmd.group || '默认'
      ].join(' ').toLowerCase()
      return haystack.includes(normalizedSearchQuery.value)
    })
    .forEach((cmd) => {
    const key = cmd.group || '默认'
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(cmd)
    })
  return Array.from(groups.entries()).map(([group, commands]) => ({ group, commands }))
})
const visibleCommandCount = computed(() => groupedCommands.value.reduce((sum, group) => sum + group.commands.length, 0))
const emptyStateTitle = computed(() => (normalizedSearchQuery.value ? '没有匹配的命令' : '还没有常用命令'))
const emptyStateDetail = computed(() => (
  normalizedSearchQuery.value
    ? '请尝试搜索命令名称、内容或分组中的其他关键词。'
    : '点击下方“添加新命令”创建常用命令，之后可在命令面板快速发送。'
))

// 编辑弹窗显示状态
const showEditModal = computed(() => {
  return showEditModalInner.value
})

const closeEditModal = () => {
  isEditing.value = false
  editingCommand.value = { name: '', command: '', group: '默认', id: null }
  showEditModalInner.value = false
}

// 打开命令管理（添加新模式）
const openCommandManager = (cmd = null) => {
  if (cmd) {
    editingCommand.value = { ...cmd }
    isEditing.value = true
  } else {
    editingCommand.value = { name: '', command: '', group: '默认', id: null }
    isEditing.value = false
  }
  showEditModalInner.value = true
}

const normalizeCommandText = (value) => String(value || '').trim()
const normalizeCommandGroup = (value) => normalizeCommandText(value) || '默认'
const knownCommandGroups = computed(() => {
  const groups = new Set(['默认'])
  serialStore.commonCommands.forEach((cmd) => {
    groups.add(normalizeCommandGroup(cmd.group))
  })
  return Array.from(groups).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
})

const editorValidationMessage = computed(() => {
  if (!showEditModalInner.value) return ''
  const normalizedName = normalizeCommandText(editingCommand.value.name)
  const normalizedCommand = normalizeCommandText(editingCommand.value.command)
  if (!normalizedName && !normalizedCommand) return '请输入命令名称和命令内容。'
  if (!normalizedName) return '请输入命令名称。'
  if (!normalizedCommand) return '请输入命令内容。'
  return ''
})
const canSaveCommand = computed(() => !editorValidationMessage.value)

// 保存命令
const saveCommand = () => {
  const normalizedName = normalizeCommandText(editingCommand.value.name)
  const normalizedCommand = normalizeCommandText(editingCommand.value.command)
  const normalizedGroup = normalizeCommandGroup(editingCommand.value.group)

  if (!canSaveCommand.value) return

  if (isEditing.value) {
    serialStore.updateCommonCommand(editingCommand.value.id, {
      name: normalizedName,
      command: normalizedCommand,
      group: normalizedGroup
    })
  } else {
    serialStore.addCommonCommand(normalizedName, normalizedCommand, normalizedGroup)
  }
  closeEditModal()
}

// 删除命令
const deleteCommand = (id) => {
  serialStore.removeCommonCommand(id)
}

// 切换命令启用状态
const toggleCommand = (id) => {
  serialStore.toggleCommandEnabled(id)
}

const duplicateCommand = (cmd) => {
  const normalizedName = normalizeCommandText(cmd?.name)
  const normalizedCommand = normalizeCommandText(cmd?.command)
  const normalizedGroup = normalizeCommandGroup(cmd?.group)
  if (!normalizedName || !normalizedCommand) return
  serialStore.addCommonCommand(`${normalizedName} 副本`, normalizedCommand, normalizedGroup)
}

const setCommandGroupEnabled = (commands, enabled) => {
  commands.forEach((cmd) => {
    if (cmd.enabled !== enabled) {
      serialStore.updateCommonCommand(cmd.id, { enabled })
    }
  })
}

// 关闭弹窗
const closeModal = () => {
  closeEditModal()
  emit('update:show', false)
}

const handleOverlayClick = () => {
  if (!props.standalone) {
    closeModal()
  }
}
</script>

<template>
  <div v-if="show" :class="['modal-overlay', { standalone: props.standalone }]" @click.self="handleOverlayClick">
    <div class="modal commands-modal">
      <div class="modal-header">
        <div class="modal-title-group">
          <span class="modal-title">⚡ 常用命令配置</span>
          <span class="modal-subtitle">
            {{ visibleCommandCount }} / {{ serialStore.commonCommands.length }} 条命令
          </span>
        </div>
        <button @click="closeModal" class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="toolbar-row">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索名称、命令内容或分组"
          />
        </div>
        <div class="commands-list">
          <div v-if="visibleCommandCount === 0" class="empty-state">
            <span class="empty-state-icon">{{ normalizedSearchQuery ? '🔍' : '⚡' }}</span>
            <span class="empty-state-title">{{ emptyStateTitle }}</span>
            <span class="empty-state-detail">{{ emptyStateDetail }}</span>
          </div>
          <div v-for="groupBlock in groupedCommands" :key="groupBlock.group" class="command-group">
            <div class="command-group-header">
              <div class="command-group-title-row">
                <div class="command-group-title">{{ groupBlock.group }}</div>
                <span class="command-group-count">{{ groupBlock.commands.length }} 条</span>
              </div>
              <div class="command-group-actions">
                <button
                  class="group-action-btn"
                  @click="setCommandGroupEnabled(groupBlock.commands, true)"
                >
                  全部启用
                </button>
                <button
                  class="group-action-btn"
                  @click="setCommandGroupEnabled(groupBlock.commands, false)"
                >
                  全部禁用
                </button>
              </div>
            </div>
            <div
              v-for="cmd in groupBlock.commands"
              :key="cmd.id"
              :class="['command-item', { disabled: !cmd.enabled }]"
            >
              <div class="command-info">
                <span class="command-name">{{ cmd.name }}</span>
                <code class="command-code">{{ cmd.command }}</code>
              </div>
              <div class="command-actions">
                <button
                  @click="toggleCommand(cmd.id)"
                  :class="['action-btn', 'toggle', cmd.enabled ? 'enabled' : 'disabled']"
                  :title="cmd.enabled ? '禁用' : '启用'"
                >
                  {{ cmd.enabled ? '✓' : '○' }}
                </button>
                <button
                  @click="openCommandManager(cmd)"
                  class="action-btn edit"
                  title="编辑"
                >
                  ✎
                </button>
                <button
                  @click="duplicateCommand(cmd)"
                  class="action-btn duplicate"
                  title="复制"
                >
                  ⧉
                </button>
                <button
                  @click="deleteCommand(cmd.id)"
                  class="action-btn delete"
                  title="删除"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
        <button @click="openCommandManager()" class="add-command-btn">
          <span>+ 添加新命令</span>
        </button>
      </div>
      <div class="modal-footer">
        <button @click="closeModal" class="modal-btn close">关闭</button>
      </div>

      <transition name="command-editor-pop">
        <div v-if="showEditModal" class="command-editor-popup" @click.stop>
          <div class="modal-header">
            <span class="modal-title">{{ isEditing ? '编辑命令' : '添加新命令' }}</span>
            <button @click="closeEditModal" class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="editorValidationMessage" class="form-alert" role="status">
              {{ editorValidationMessage }}
            </div>
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
            <div class="form-group">
              <label>命令分组</label>
              <input
                v-model="editingCommand.group"
                type="text"
                class="form-input"
                list="command-group-suggestions"
                placeholder="例：查询、设备控制、自定义"
              />
              <datalist id="command-group-suggestions">
                <option v-for="group in knownCommandGroups" :key="group" :value="group" />
              </datalist>
              <span class="form-hint">输入新名称可创建分组，或从已有分组中快速选择。</span>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="closeEditModal" class="modal-btn cancel">取消</button>
            <button
              @click="saveCommand"
              class="modal-btn save"
              :disabled="!canSaveCommand"
              :title="editorValidationMessage || '保存命令'"
            >保存</button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--app-overlay-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

.modal-overlay.standalone {
  position: relative;
  inset: auto;
  width: 100%;
  height: 100vh;
  background: var(--app-bg-gradient);
  backdrop-filter: none;
  padding: 0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: linear-gradient(145deg, var(--app-modal-bg) 0%, var(--app-modal-soft) 100%);
  border: 1px solid var(--app-modal-border);
  border-radius: 16px;
  padding: 24px;
  min-width: 480px;
  max-width: 600px;
  max-height: 80vh;
  box-shadow: var(--app-shadow-lg);
  animation: slideIn 0.3s ease;
  display: flex;
  flex-direction: column;
}

.commands-modal {
  position: relative;
  width: min(600px, calc(100vw - 32px));
}

.modal-overlay.standalone .commands-modal {
  width: 100%;
  height: 100vh;
  max-width: none;
  max-height: 100vh;
  border: none;
  border-radius: 0;
  box-shadow: none;
  animation: none;
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
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--app-border);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--app-text);
  letter-spacing: 0.5px;
}

.modal-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modal-subtitle {
  font-size: 12px;
  color: var(--app-text-soft);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--app-chip-bg);
  border: 1px solid var(--app-chip-border);
  color: var(--app-text-soft);
  cursor: pointer;
  font-size: 18px;
  border-radius: 8px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--app-danger-soft);
  border-color: var(--app-danger-border);
  color: var(--app-text);
  transform: rotate(90deg);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 20px;
}

.commands-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.search-input {
  width: 100%;
  padding: 11px 14px;
  background: var(--app-workspace-shell);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  color: var(--app-text);
  font-size: 13px;
  transition: all 0.18s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--app-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent) 18%, transparent);
}

.search-input::placeholder {
  color: var(--app-text-soft);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 26px 18px;
  border: 1px dashed var(--app-border);
  border-radius: 12px;
  background: var(--app-workspace-shell);
  color: var(--app-text-soft);
  font-size: 13px;
  text-align: center;
}

.empty-state-icon {
  font-size: 28px;
}

.empty-state-title {
  color: var(--app-text);
  font-weight: 600;
}

.empty-state-detail {
  max-width: 360px;
  line-height: 1.5;
}

.command-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px;
}

.command-group-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.command-group-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--app-text-soft);
  text-transform: uppercase;
}

.command-group-count {
  font-size: 11px;
  color: var(--app-text-soft);
}

.command-group-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-action-btn {
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-workspace-shell);
  color: var(--app-text-soft);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.group-action-btn:hover {
  border-color: var(--app-chip-border);
  color: var(--app-text);
  background: var(--app-accent-soft);
}

.command-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--app-workspace-shell);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  transition: all 0.2s;
}

.command-item.disabled {
  opacity: 0.5;
  filter: grayscale(0.5);
}

.command-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.command-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
}

.command-code {
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--app-success-text);
  background: var(--app-success-soft);
  padding: 2px 6px;
  border-radius: 4px;
  align-self: flex-start;
}

.command-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
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

.action-btn.toggle.enabled {
  background: linear-gradient(135deg, var(--app-success) 0%, color-mix(in srgb, var(--app-success) 82%, black) 100%);
  color: var(--app-modal-bg);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--app-success) 34%, transparent);
}

.action-btn.toggle.disabled {
  background: var(--app-workspace-soft);
  color: var(--app-text-soft);
}

.action-btn.edit {
  background: linear-gradient(135deg, var(--app-accent) 0%, color-mix(in srgb, var(--app-accent) 78%, black) 100%);
  color: var(--app-text);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--app-accent) 34%, transparent);
}

.action-btn.duplicate {
  background: linear-gradient(135deg, color-mix(in srgb, var(--app-accent) 22%, var(--app-workspace-soft)) 0%, var(--app-workspace-soft) 100%);
  color: var(--app-text);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--app-accent) 18%, transparent);
}

.action-btn.delete {
  background: linear-gradient(135deg, var(--app-danger) 0%, color-mix(in srgb, var(--app-danger) 82%, black) 100%);
  color: var(--app-text);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--app-danger) 32%, transparent);
}

.action-btn:hover {
  transform: scale(1.15) translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.add-command-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px 16px;
  background: linear-gradient(135deg, var(--app-success) 0%, color-mix(in srgb, var(--app-success) 82%, black) 100%);
  border: 1px solid var(--app-success-border);
  border-radius: 8px;
  color: var(--app-modal-bg);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-command-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--app-success) 40%, transparent);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--app-border);
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

.modal-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
  box-shadow: none;
}

.modal-btn.close {
  background: linear-gradient(135deg, var(--app-accent) 0%, color-mix(in srgb, var(--app-accent) 65%, #6a54a8) 100%);
  border: 1px solid var(--app-chip-border);
  color: var(--app-text);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--app-accent) 34%, transparent);
}

.modal-btn.close:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--app-accent) 46%, transparent);
}

.command-editor-popup {
  position: absolute;
  inset: 50% auto auto 50%;
  z-index: 1002;
  width: min(420px, calc(100% - 32px));
  max-width: calc(100% - 32px);
  padding: 22px;
  border-radius: 16px;
  border: 1px solid var(--app-modal-border);
  background: linear-gradient(145deg, var(--app-modal-bg) 0%, var(--app-modal-soft) 100%);
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.28);
  transform: translate(-50%, -50%);
}

.command-editor-pop-enter-active,
.command-editor-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.command-editor-pop-enter-from,
.command-editor-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% - 10px)) scale(0.96);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-group label {
  font-size: 12px;
  color: var(--app-text-soft);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-alert {
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, #ffb86c 46%, var(--app-border));
  border-radius: 8px;
  background: color-mix(in srgb, #ffb86c 12%, var(--app-workspace-shell));
  color: var(--app-text);
  font-size: 13px;
  line-height: 1.5;
}

.form-input {
  padding: 12px 14px;
  background: var(--app-workspace-shell);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  color: var(--app-text);
  font-size: 14px;
  font-family: 'Consolas', 'Monaco', monospace;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--app-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent) 18%, transparent);
  background: var(--app-modal-bg);
}

.form-input::placeholder {
  color: var(--app-text-soft);
}

.form-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-soft);
}

.modal-btn.cancel {
  background: transparent;
  border-color: var(--app-border);
  color: var(--app-text);
}

.modal-btn.cancel:hover {
  background: var(--app-workspace-soft);
  border-color: var(--app-border);
}

.modal-btn.save {
  background: linear-gradient(135deg, var(--app-accent) 0%, color-mix(in srgb, var(--app-accent) 65%, #6a54a8) 100%);
  border: 1px solid var(--app-chip-border);
  color: var(--app-text);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--app-accent) 34%, transparent);
}

.modal-btn.save:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--app-accent) 46%, transparent);
}
</style>
