<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSerialStore } from '../stores/serial'
import SerialPanel from './SerialPanel.vue'

const serialStore = useSerialStore()

const splitPanes = ref([{ tabs: [], activeTab: '' }])
const paneRefs = ref([])

const draggedData = ref(null)
const dropZoneIndex = ref(-1)
const dropPosition = ref('')
const isDraggingSeparator = ref(false)
const draggingSeparatorIndex = ref(-1)
const separatorStartX = ref(0)
const initialLeftWidth = ref(0)
const initialRightWidth = ref(0)

const connectedPorts = computed(() => {
  return Array.from(serialStore.openPorts.entries())
    .filter(([, data]) => data.isConnected)
    .map(([path]) => path)
})

const allTabs = computed(() => splitPanes.value.flatMap((pane) => pane.tabs))
const setPaneRef = (element, paneIndex) => {
  if (element) {
    paneRefs.value[paneIndex] = element
  }
}

const clearPaneWidths = () => {
  paneRefs.value.forEach((pane) => {
    if (pane) {
      pane.style.flex = ''
    }
  })
}

const rebalancePaneWidths = (widths = null) => {
  nextTick(() => {
    const paneElements = paneRefs.value.filter(Boolean)
    if (!paneElements.length) return

    if (!widths || widths.length !== paneElements.length) {
      clearPaneWidths()
      return
    }

    paneElements.forEach((pane, index) => {
      pane.style.flex = `0 0 ${Math.max(240, Math.floor(widths[index]))}px`
    })
  })
}

watch(() => connectedPorts.value, (newPorts) => {
  const currentTabs = allTabs.value

  newPorts.forEach((port) => {
    if (!currentTabs.includes(port)) {
      if (splitPanes.value.length === 0) {
        splitPanes.value.push({ tabs: [], activeTab: '' })
      }
      splitPanes.value[0].tabs.push(port)
      if (!splitPanes.value[0].activeTab) {
        splitPanes.value[0].activeTab = port
      }
    }
  })

  splitPanes.value.forEach((pane) => {
    pane.tabs = pane.tabs.filter((port) => newPorts.includes(port))
    if (!newPorts.includes(pane.activeTab)) {
      pane.activeTab = pane.tabs[0] || ''
    }
  })

  while (splitPanes.value.length > 1 && splitPanes.value.some((pane) => pane.tabs.length === 0)) {
    const emptyIndex = splitPanes.value.findIndex((pane) => pane.tabs.length === 0)
    if (emptyIndex !== -1) {
      splitPanes.value.splice(emptyIndex, 1)
    }
  }

  nextTick(() => {
    paneRefs.value = paneRefs.value.slice(0, splitPanes.value.length)
  })

  if (!newPorts.includes(serialStore.selectedPort)) {
    serialStore.selectedPort = splitPanes.value.find((pane) => pane.activeTab)?.activeTab || newPorts[0] || null
  }
}, { deep: true })

watch(() => serialStore.selectedPort, (selectedPort) => {
  if (!selectedPort) return

  const targetPaneIndex = splitPanes.value.findIndex((pane) => pane.tabs.includes(selectedPort))
  if (targetPaneIndex === -1) return

  if (splitPanes.value[targetPaneIndex].activeTab !== selectedPort) {
    splitPanes.value[targetPaneIndex].activeTab = selectedPort
  }
})

const selectTab = (paneIndex, port) => {
  splitPanes.value[paneIndex].activeTab = port
  serialStore.selectedPort = port
}

const disconnectPort = (port) => {
  serialStore.disconnect(port)
}

const splitPane = (paneIndex) => {
  const pane = splitPanes.value[paneIndex]
  if (!pane.tabs.length) return

  const sourcePaneElement = paneRefs.value[paneIndex]
  const sourcePaneWidth = sourcePaneElement?.offsetWidth || 0
  const lastTab = pane.tabs.pop()
  if (pane.activeTab === lastTab) {
    pane.activeTab = pane.tabs[0] || ''
  }

  splitPanes.value.splice(paneIndex + 1, 0, {
    tabs: [lastTab],
    activeTab: lastTab
  })

  if (!sourcePaneWidth) return

  const minWidth = 240
  const nextWidths = paneRefs.value
    .slice(0, splitPanes.value.length - 1)
    .map((paneElement, index) => {
      if (!paneElement) return null
      if (index !== paneIndex) return paneElement.offsetWidth
      return Math.max(minWidth, Math.floor(sourcePaneWidth / 2))
    })

  const splitWidth = Math.max(minWidth, sourcePaneWidth - nextWidths[paneIndex])
  nextWidths.splice(paneIndex + 1, 0, splitWidth)
  rebalancePaneWidths(nextWidths)
}

const removeEmptyPane = (paneIndex) => {
  if (splitPanes.value.length <= 1) return
  if (splitPanes.value[paneIndex].tabs.length > 0) return
  splitPanes.value.splice(paneIndex, 1)
  nextTick(() => {
    paneRefs.value = paneRefs.value.slice(0, splitPanes.value.length)
    clearPaneWidths()
    handleResize()
  })
}

const handleContentDragOver = (event, paneIndex) => {
  event.preventDefault()
  if (!draggedData.value) return

  dropZoneIndex.value = paneIndex
  const rect = event.currentTarget.getBoundingClientRect()
  dropPosition.value = event.clientX - rect.left < rect.width / 2 ? 'left' : 'right'
}

const handleContentDrop = (event, targetPaneIndex) => {
  event.preventDefault()
  const data = draggedData.value
  if (!data) return

  const { paneIndex: sourcePaneIndex, port } = data
  if (sourcePaneIndex === targetPaneIndex) {
    dropZoneIndex.value = -1
    dropPosition.value = ''
    return
  }

  const sourcePane = splitPanes.value[sourcePaneIndex]
  const sourceTabIndex = sourcePane.tabs.indexOf(port)
  if (sourceTabIndex !== -1) {
    sourcePane.tabs.splice(sourceTabIndex, 1)
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
    nextTick(() => {
      paneRefs.value = paneRefs.value.slice(0, splitPanes.value.length)
      clearPaneWidths()
      handleResize()
    })
  }

  dropZoneIndex.value = -1
  dropPosition.value = ''
  draggedData.value = null
}

const handleContentDragLeave = () => {
  dropZoneIndex.value = -1
  dropPosition.value = ''
}

const handleDragStart = (event, paneIndex, port) => {
  draggedData.value = { paneIndex, port }
  event.dataTransfer.setData('text', JSON.stringify({ paneIndex, port }))
  event.dataTransfer.effectAllowed = 'move'
}

const handleTabListDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}

const handleTabListDrop = (event, targetPaneIndex) => {
  event.preventDefault()
  const data = JSON.parse(event.dataTransfer.getData('text'))
  if (!data) return

  const { paneIndex: sourcePaneIndex, port } = data
  if (sourcePaneIndex === targetPaneIndex) return

  const sourcePane = splitPanes.value[sourcePaneIndex]
  const sourceTabIndex = sourcePane.tabs.indexOf(port)
  if (sourceTabIndex !== -1) {
    sourcePane.tabs.splice(sourceTabIndex, 1)
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
    nextTick(() => {
      paneRefs.value = paneRefs.value.slice(0, splitPanes.value.length)
      clearPaneWidths()
      handleResize()
    })
  }

  draggedData.value = null
  dropZoneIndex.value = -1
}

const handleDragEnd = () => {
  draggedData.value = null
  dropZoneIndex.value = -1
  dropPosition.value = ''
}

const handleSeparatorMouseDown = (event, index) => {
  isDraggingSeparator.value = true
  draggingSeparatorIndex.value = index
  separatorStartX.value = event.clientX

  const paneGroups = document.querySelectorAll('.split-pane-group')
  const leftPane = paneGroups[index - 1]
  const rightPane = paneGroups[index]

  if (leftPane && rightPane) {
    initialLeftWidth.value = leftPane.offsetWidth
    initialRightWidth.value = rightPane.offsetWidth
  }

  document.body.style.cursor = 'col-resize'
  event.preventDefault()
}

const handleSeparatorMouseMove = (event) => {
  if (!isDraggingSeparator.value || draggingSeparatorIndex.value === -1) return

  const delta = event.clientX - separatorStartX.value
  const paneGroups = document.querySelectorAll('.split-pane-group')
  const leftPane = paneGroups[draggingSeparatorIndex.value - 1]
  const rightPane = paneGroups[draggingSeparatorIndex.value]
  if (!leftPane || !rightPane) return

  const minWidth = 240
  const newLeftWidth = initialLeftWidth.value + delta
  const newRightWidth = initialRightWidth.value - delta

  if (newLeftWidth < minWidth || newRightWidth < minWidth) return

  leftPane.style.flex = `0 0 ${newLeftWidth}px`
  rightPane.style.flex = `0 0 ${newRightWidth}px`
}

const handleSeparatorMouseUp = () => {
  isDraggingSeparator.value = false
  draggingSeparatorIndex.value = -1
  document.body.style.cursor = ''
}

const handleResize = () => {
  if (isDraggingSeparator.value) return

  const paneGroups = document.querySelectorAll('.split-pane-group')
  const separators = document.querySelectorAll('.split-separator')
  const container = document.querySelector('.content-container')

  if (!paneGroups.length || !container) return

  let totalWidth = separators.length * 10
  const widths = []
  paneGroups.forEach((pane) => {
    widths.push(pane.offsetWidth)
    totalWidth += pane.offsetWidth
  })

  const containerWidth = container.offsetWidth
  if (Math.abs(totalWidth - containerWidth) < 10) return

  const scale = containerWidth / totalWidth
  paneGroups.forEach((pane, index) => {
    pane.style.flex = `0 0 ${Math.max(240, Math.floor(widths[index] * scale))}px`
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
  <div class="terminal-shell">
    <div class="content-container">
      <template v-for="(pane, paneIndex) in splitPanes" :key="paneIndex">
        <div
          v-if="paneIndex > 0"
          class="split-separator"
          @mousedown="handleSeparatorMouseDown($event, paneIndex)"
          @dragover="handleTabListDragOver"
          @drop="handleTabListDrop($event, paneIndex)"
        ></div>

        <div :ref="(element) => setPaneRef(element, paneIndex)" class="split-pane-group">
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
                <span class="tab-icon"></span>
                <span class="tab-label">{{ port }}</span>
                <span class="tab-close" @click.stop="disconnectPort(port)">×</span>
              </div>
            </div>
            <button class="pane-split-btn" title="向右拆分" @click.stop="splitPane(paneIndex)">
              拆分
            </button>
          </div>

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
              <span class="empty-icon">◎</span>
              <p>这个面板还没有串口</p>
              <span class="empty-hint">连接设备后会自动出现在这里，也可以拖拽标签重新排布。</span>
              <button class="delete-empty-btn" @click="removeEmptyPane(paneIndex)">
                删除空面板
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.terminal-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  background: rgba(7, 13, 19, 0.82);
}

.content-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
  padding: 6px;
  gap: 6px;
}

.split-pane-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  border-radius: 14px;
  background: rgba(8, 14, 20, 0.58);
  border: 1px solid rgba(126, 161, 183, 0.12);
}

.split-separator {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  position: relative;
}

.split-separator::before {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 2px;
  width: 2px;
  border-radius: 999px;
  background: rgba(98, 130, 151, 0.18);
  transition: all 0.18s ease;
}

.split-separator:hover::before {
  background: rgba(87, 199, 255, 0.4);
}

.tab-header-section {
  display: flex;
  align-items: center;
  background: rgba(10, 19, 27, 0.56);
  border-bottom: 1px solid rgba(126, 161, 183, 0.12);
  flex-shrink: 0;
  height: 40px;
}

.tab-list {
  display: flex;
  flex: 1;
  overflow-x: auto;
  align-items: center;
  padding-left: 6px;
}

.tab-list::-webkit-scrollbar {
  height: 4px;
}

.tab-list::-webkit-scrollbar-thumb {
  background: rgba(126, 161, 183, 0.3);
  border-radius: 999px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-right: 6px;
  min-width: 112px;
  max-width: 220px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
  border: 1px solid transparent;
  color: #b7cbd9;
}

.tab-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.tab-item.active {
  background: rgba(87, 199, 255, 0.08);
  border-color: rgba(87, 199, 255, 0.16);
  color: #f4fbff;
}

.tab-icon {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #57c7ff;
  box-shadow: 0 0 0 4px rgba(87, 199, 255, 0.08);
  flex-shrink: 0;
}

.tab-label {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 14px;
  color: #8ca4b6;
}

.tab-close:hover {
  background: rgba(196, 43, 28, 0.18);
  color: #fff;
}

.pane-split-btn {
  margin-right: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(126, 161, 183, 0.12);
  background: rgba(255, 255, 255, 0.03);
  color: #a8bfce;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.18s ease;
}

.pane-split-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

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
  background: linear-gradient(to right, rgba(87, 199, 255, 0.18) 0%, transparent 28%);
  box-shadow: inset 3px 0 0 rgba(87, 199, 255, 0.54);
}

.split-pane.drop-zone-right {
  background: linear-gradient(to left, rgba(87, 199, 255, 0.18) 0%, transparent 28%);
  box-shadow: inset -3px 0 0 rgba(87, 199, 255, 0.54);
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
  gap: 10px;
  padding: 24px;
  text-align: center;
  color: #8ea5b7;
}

.empty-icon {
  width: 72px;
  height: 72px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  color: #dceaf4;
  font-size: 28px;
}

.empty-state p {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #eef8ff;
}

.empty-hint {
  max-width: 340px;
  line-height: 1.6;
}

.delete-empty-btn {
  margin-top: 6px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(196, 43, 28, 0.22);
  background: rgba(196, 43, 28, 0.14);
  color: #ffd5d1;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}

.delete-empty-btn:hover {
  background: rgba(196, 43, 28, 0.22);
}
</style>
