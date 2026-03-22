<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSerialStore } from '../stores/serial'
import SerialPanel from './SerialPanel.vue'

const serialStore = useSerialStore()

// 分屏区域数组 - 每个区域包含多个标签
const splitPanes = ref([{ tabs: [], activeTab: '' }])

// 拖拽相关
const draggedData = ref(null)
const dropZoneIndex = ref(-1)
const dropPosition = ref('') // 'left', 'right'
const isDraggingSeparator = ref(false)
const draggingSeparatorIndex = ref(-1)
const separatorStartX = ref(0)
const initialLeftWidth = ref(0)
const initialRightWidth = ref(0)

// 获取所有已连接的串口
const connectedPorts = computed(() => {
  return Array.from(serialStore.openPorts.entries())
    .filter(([_, data]) => data.isConnected)
    .map(([path, _]) => path)
})

// 所有分屏中的所有标签
const allTabs = computed(() => {
  return splitPanes.value.flatMap(pane => pane.tabs)
})

// 监听串口连接
watch(() => connectedPorts.value, (newPorts) => {
  const currentTabs = allTabs.value

  newPorts.forEach(port => {
    if (!currentTabs.includes(port)) {
      // 新端口添加到第一个分屏区域
      if (splitPanes.value.length === 0) {
        splitPanes.value.push({ tabs: [], activeTab: '' })
      }
      splitPanes.value[0].tabs.push(port)
      if (!splitPanes.value[0].activeTab) {
        splitPanes.value[0].activeTab = port
      }
    }
  })

  // 移除已断开的端口
  splitPanes.value.forEach(pane => {
    pane.tabs = pane.tabs.filter(p => newPorts.includes(p))
    if (!newPorts.includes(pane.activeTab)) {
      pane.activeTab = pane.tabs[0] || ''
    }
  })

  // 移除空的分屏区域（至少保留一个）
  while (splitPanes.value.length > 1 && splitPanes.value.some(p => p.tabs.length === 0)) {
    const emptyIndex = splitPanes.value.findIndex(p => p.tabs.length === 0)
    if (emptyIndex !== -1) {
      splitPanes.value.splice(emptyIndex, 1)
    }
  }

  if (!newPorts.includes(serialStore.selectedPort)) {
    serialStore.selectedPort = splitPanes.value.find(pane => pane.activeTab)?.activeTab || newPorts[0] || null
  }
}, { deep: true })

// 选择标签
const selectTab = (paneIndex, port) => {
  splitPanes.value[paneIndex].activeTab = port
  serialStore.selectedPort = port
}

// 断开连接
const disconnectPort = (port) => {
  serialStore.disconnect(port)
}

// 在指定分屏后添加新分屏，将最后一个标签移动到新分屏
const splitPane = (paneIndex) => {
  const pane = splitPanes.value[paneIndex]
  if (!pane.tabs.length) return

  // 将最后一个标签移到新分屏
  const lastTab = pane.tabs.pop()
  if (pane.activeTab === lastTab) {
    pane.activeTab = pane.tabs[0] || ''
  }

  splitPanes.value.splice(paneIndex + 1, 0, {
    tabs: [lastTab],
    activeTab: lastTab
  })
}

// 删除空分区
const removeEmptyPane = (paneIndex) => {
  // 至少保留一个分区
  if (splitPanes.value.length <= 1) return
  const pane = splitPanes.value[paneIndex]
  if (pane.tabs.length > 0) return

  splitPanes.value.splice(paneIndex, 1)
}

// 内容区域拖拽
const handleContentDragOver = (e, paneIndex) => {
  e.preventDefault()
  if (draggedData.value) {
    dropZoneIndex.value = paneIndex
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const isLeft = x < rect.width / 2
    dropPosition.value = isLeft ? 'left' : 'right'
  }
}

const handleContentDrop = (e, targetPaneIndex) => {
  e.preventDefault()
  const data = draggedData.value
  if (!data) return

  const { paneIndex: sourcePaneIndex, port } = data

  if (sourcePaneIndex === targetPaneIndex) {
    dropZoneIndex.value = -1
    dropPosition.value = ''
    return
  }

  const sourcePane = splitPanes.value[sourcePaneIndex]
  const tabIndex = sourcePane.tabs.indexOf(port)
  if (tabIndex !== -1) {
    sourcePane.tabs.splice(tabIndex, 1)
    if (sourcePane.activeTab === port) {
      sourcePane.activeTab = sourcePane.tabs[0] || ''
    }
  }

  const targetPane = splitPanes.value[targetPaneIndex]
  if (dropPosition.value === 'right') {
    targetPane.tabs.push(port)
  } else {
    targetPane.tabs.unshift(port)
  }
  if (!targetPane.activeTab) {
    targetPane.activeTab = port
  }

  if (sourcePane.tabs.length === 0 && splitPanes.value.length > 1) {
    splitPanes.value.splice(sourcePaneIndex, 1)
  }

  dropZoneIndex.value = -1
  dropPosition.value = ''
  draggedData.value = null
}

const handleContentDragLeave = () => {
  dropZoneIndex.value = -1
  dropPosition.value = ''
}

// 拖拽开始
const handleDragStart = (e, paneIndex, port) => {
  draggedData.value = { paneIndex, port }
  e.dataTransfer.setData('text', JSON.stringify({ paneIndex, port }))
  e.dataTransfer.effectAllowed = 'move'
}

// 拖拽到标签列表
const handleTabListDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

const handleTabListDrop = (e, targetPaneIndex) => {
  e.preventDefault()
  const data = JSON.parse(e.dataTransfer.getData('text'))
  if (!data) return

  const { paneIndex: sourcePaneIndex, port } = data
  if (sourcePaneIndex === targetPaneIndex) return

  const sourcePane = splitPanes.value[sourcePaneIndex]
  const tabIndex = sourcePane.tabs.indexOf(port)
  if (tabIndex !== -1) {
    sourcePane.tabs.splice(tabIndex, 1)
    if (sourcePane.activeTab === port) {
      sourcePane.activeTab = sourcePane.tabs[0] || ''
    }
  }

  const targetPane = splitPanes.value[targetPaneIndex]
  targetPane.tabs.push(port)
  if (!targetPane.activeTab) {
    targetPane.activeTab = port
  }

  if (sourcePane.tabs.length === 0 && splitPanes.value.length > 1) {
    splitPanes.value.splice(sourcePaneIndex, 1)
  }

  draggedData.value = null
  dropZoneIndex.value = -1
}

// 拖拽结束
const handleDragEnd = () => {
  draggedData.value = null
  dropZoneIndex.value = -1
  dropPosition.value = ''
}

// 分隔线拖拽调整宽度
const handleSeparatorMouseDown = (e, index) => {
  isDraggingSeparator.value = true
  draggingSeparatorIndex.value = index
  separatorStartX.value = e.clientX

  const paneGroups = document.querySelectorAll('.split-pane-group')
  const leftPane = paneGroups[index - 1]
  const rightPane = paneGroups[index]

  if (leftPane && rightPane) {
    initialLeftWidth.value = leftPane.offsetWidth
    initialRightWidth.value = rightPane.offsetWidth
  }

  document.body.style.cursor = 'col-resize'
  e.preventDefault()
}

const handleSeparatorMouseMove = (e) => {
  if (!isDraggingSeparator.value || draggingSeparatorIndex.value === -1) return

  const delta = e.clientX - separatorStartX.value
  const index = draggingSeparatorIndex.value

  // 最小宽度限制（像素）
  const MIN_WIDTH = 200

  const paneGroups = document.querySelectorAll('.split-pane-group')
  const leftPane = paneGroups[index - 1]
  const rightPane = paneGroups[index]

  if (!leftPane || !rightPane) return

  // 计算新宽度（基于初始宽度）
  const newLeftWidth = initialLeftWidth.value + delta
  const newRightWidth = initialRightWidth.value - delta

  // 检查是否满足最小宽度限制
  if (newLeftWidth < MIN_WIDTH || newRightWidth < MIN_WIDTH) return

  // 更新宽度
  leftPane.style.flex = `0 0 ${newLeftWidth}px`
  rightPane.style.flex = `0 0 ${newRightWidth}px`
}

const handleSeparatorMouseUp = () => {
  isDraggingSeparator.value = false
  draggingSeparatorIndex.value = -1
  document.body.style.cursor = ''
}

// 窗口大小改变时，调整分区宽度比例
const handleResize = () => {
  if (isDraggingSeparator.value) return

  const paneGroups = document.querySelectorAll('.split-pane-group')
  const separators = document.querySelectorAll('.split-separator')

  if (paneGroups.length === 0) return

  // 计算当前总宽度
  let totalWidth = 0
  const widths = []
  paneGroups.forEach(pane => {
    const width = pane.offsetWidth
    widths.push(width)
    totalWidth += width
  })

  // 添加分隔线宽度
  totalWidth += separators.length * 4

  // 获取容器宽度
  const container = document.querySelector('.content-container')
  if (!container) return

  const containerWidth = container.offsetWidth

  // 如果总宽度与容器宽度差异不大，不调整
  if (Math.abs(totalWidth - containerWidth) < 10) return

  // 按比例调整每个分区宽度
  const scale = containerWidth / totalWidth
  paneGroups.forEach((pane, index) => {
    const newWidth = Math.max(200, Math.floor(widths[index] * scale))
    pane.style.flex = `0 0 ${newWidth}px`
  })
}

onMounted(() => {
  window.addEventListener('mousemove', handleSeparatorMouseMove)
  window.addEventListener('mouseup', handleSeparatorMouseUp)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleSeparatorMouseMove)
  window.removeEventListener('mouseup', handleSeparatorMouseUp)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="terminal-container">
    <!-- 内容区域 -->
    <div class="content-container">
      <template v-for="(pane, paneIndex) in splitPanes" :key="paneIndex">
        <!-- 分隔线 -->
        <div
          v-if="paneIndex > 0"
          class="split-separator"
          @mousedown="handleSeparatorMouseDown($event, paneIndex)"
          @dragover="handleTabListDragOver"
          @drop="handleTabListDrop($event, paneIndex)"
        ></div>

        <div class="split-pane-group">
          <!-- 标签页标题栏 -->
          <div class="tab-header-section">
            <div class="tab-list">
              <div
                v-for="port in pane.tabs"
                :key="port"
                :class="['tab-item', { active: pane.activeTab === port }]"
                :draggable="true"
                @click="selectTab(paneIndex, port)"
                @dragstart="handleDragStart($event, paneIndex, port)"
                @dragend="handleDragEnd"
              >
                <span class="tab-icon">📡</span>
                <span class="tab-label">{{ port }}</span>
                <span class="tab-close" @click.stop="disconnectPort(port)">✕</span>
              </div>
            </div>
            <!-- 拆分按钮 -->
            <button
              class="pane-split-btn"
              :title="'向右拆分'"
              @click.stop="splitPane(paneIndex)"
            >
              <span>◫</span>
            </button>
          </div>

          <!-- 内容区域 -->
          <div
            class="split-pane"
            @dragover="handleContentDragOver($event, paneIndex)"
            @drop="handleContentDrop($event, paneIndex)"
            @dragleave="handleContentDragLeave"
            :class="{
              'drop-zone-left': dropZoneIndex === paneIndex && dropPosition === 'left',
              'drop-zone-right': dropZoneIndex === paneIndex && dropPosition === 'right'
            }"
          >
            <SerialPanel v-if="pane.activeTab" :port-path="pane.activeTab" class="panel-full" />
            <div v-else class="empty-state">
              <span class="empty-icon">📡</span>
              <p>暂无串口</p>
              <button class="delete-empty-btn" @click="removeEmptyPane(paneIndex)" title="删除此分区">
                删除分区
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #1e1e1e;
  position: relative;
}

/* 内容区域 */
.content-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.split-pane-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* 分隔线 */
.split-separator {
  width: 4px;
  background-color: #3e3e42;
  flex-shrink: 0;
  cursor: col-resize;
  transition: background-color 0.15s;
}

.split-separator:hover {
  background-color: #007acc;
}

/* 标签栏区域 */
.tab-header-section {
  display: flex;
  align-items: center;
  background-color: #252526;
  border-bottom: 1px solid #3e3e42;
  flex-shrink: 0;
  height: 36px;
}

.tab-list {
  display: flex;
  flex: 1;
  overflow-x: auto;
  align-items: center;
}

.tab-list::-webkit-scrollbar {
  height: 3px;
}

.tab-list::-webkit-scrollbar-track {
  background: #252526;
}

.tab-list::-webkit-scrollbar-thumb {
  background: #424242;
}

/* 标签项 */
.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  min-width: 120px;
  max-width: 200px;
  background-color: #2d2d30;
  border-right: 1px solid #3e3e42;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  height: 36px;
  box-sizing: border-box;
}

.tab-item:hover {
  background-color: #323233;
}

.tab-item.active {
  background-color: #1e1e1e;
  border-bottom: 2px solid #007acc;
}

.tab-icon {
  font-size: 14px;
  cursor: grab;
}

.tab-item:active .tab-icon {
  cursor: grabbing;
}

.tab-label {
  flex: 1;
  font-size: 13px;
  color: #cccccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  font-size: 12px;
  color: #858585;
}

.tab-close:hover {
  background-color: #c42b1c;
  color: #ffffff;
}

/* 拆分按钮 */
.pane-split-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 36px;
  background: none;
  border: none;
  border-left: 1px solid #3e3e42;
  color: #cccccc;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.pane-split-btn:hover {
  background-color: #3e3e42;
  color: #ffffff;
}

/* 分屏内容 */
.split-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  position: relative;
}

.split-pane.drop-zone-left {
  background: linear-gradient(to right, rgba(0, 122, 204, 0.2) 0%, transparent 30%);
  box-shadow: inset 2px 0 0 0 rgba(0, 122, 204, 0.5);
}

.split-pane.drop-zone-right {
  background: linear-gradient(to left, rgba(0, 122, 204, 0.2) 0%, transparent 30%);
  box-shadow: inset -2px 0 0 0 rgba(0, 122, 204, 0.5);
}

.panel-full {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #555;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.empty-state p {
  font-size: 13px;
  margin: 4px 0;
}

.empty-state .hint {
  color: #858585;
  font-size: 12px;
}

.delete-empty-btn {
  margin-top: 12px;
  padding: 6px 16px;
  background-color: #c42b1c;
  border: 1px solid #a02015;
  color: #ffffff;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.delete-empty-btn:hover {
  background-color: #d63a2a;
  border-color: #b4281a;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(196, 43, 28, 0.3);
}
</style>
