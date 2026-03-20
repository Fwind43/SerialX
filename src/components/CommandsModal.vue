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

.modal {
  background: linear-gradient(145deg, #2d2d30 0%, #1e1e1e 100%);
  border: 1px solid rgba(62, 62, 66, 0.8);
  border-radius: 16px;
  padding: 24px;
  min-width: 480px;
  max-width: 600px;
  max-height: 80vh;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
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
  background: rgba(30, 30, 30, 0.6);
  border: 1px solid rgba(62, 62, 66, 0.6);
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
  color: #ffffff;
}

.command-code {
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #4ec9b0;
  background: rgba(78, 201, 176, 0.1);
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
  background: linear-gradient(135deg, #4ec9b0 0%, #45b8a0 100%);
  color: #1e1e1e;
  box-shadow: 0 2px 8px rgba(78, 201, 176, 0.3);
}

.action-btn.toggle.disabled {
  background: #3e3e42;
  color: #858585;
}

.action-btn.edit {
  background: linear-gradient(135deg, #569cd6 0%, #4a8dc7 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(86, 156, 214, 0.3);
}

.action-btn.delete {
  background: linear-gradient(135deg, #c42b1c 0%, #a82518 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(196, 43, 28, 0.3);
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
  background: linear-gradient(135deg, #4ec9b0 0%, #45b8a0 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #1e1e1e;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-command-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(78, 201, 176, 0.4);
}

.modal-footer {
  display: flex;
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

.modal-btn.close {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.modal-btn.close:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

/* 编辑弹窗 */
.edit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
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
</style>
