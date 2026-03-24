<script setup>
import { ref, computed } from 'vue'
import { useSerialStore } from '../stores/serial'

const serialStore = useSerialStore()

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show'])

// 编辑命令表单
const editingCommand = ref({ name: '', command: '', id: null })
const isEditing = ref(false)
const showEditModalInner = ref(false)

// 编辑弹窗显示状态
const showEditModal = computed(() => {
  return showEditModalInner.value
})

const closeEditModal = () => {
  isEditing.value = false
  editingCommand.value = { name: '', command: '', id: null }
  showEditModalInner.value = false
}

// 打开命令管理（添加新模式）
const openCommandManager = (cmd = null) => {
  if (cmd) {
    editingCommand.value = { ...cmd }
    isEditing.value = true
  } else {
    editingCommand.value = { name: '', command: '', id: null }
    isEditing.value = false
  }
  showEditModalInner.value = true
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

// 关闭弹窗
const closeModal = () => {
  emit('update:show', false)
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="closeModal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">⚡ 常用命令配置</span>
        <button @click="closeModal" class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="commands-list">
          <div
            v-for="cmd in serialStore.commonCommands"
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
                @click="deleteCommand(cmd.id)"
                class="action-btn delete"
                title="删除"
              >
                ✕
              </button>
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
    </div>

    <!-- 命令编辑弹窗 -->
    <div v-if="showEditModal" class="edit-modal-overlay" @click.self="closeEditModal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">{{ isEditing ? '编辑命令' : '添加新命令' }}</span>
          <button @click="closeEditModal" class="modal-close">✕</button>
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
          <button @click="closeEditModal" class="modal-btn cancel">取消</button>
          <button @click="saveCommand" class="modal-btn save">保存</button>
        </div>
      </div>
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
  gap: 8px;
  margin-bottom: 16px;
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

/* 编辑弹窗 */
.edit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--app-overlay-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  backdrop-filter: blur(4px);
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

.modal-btn.save:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--app-accent) 46%, transparent);
}
</style>
