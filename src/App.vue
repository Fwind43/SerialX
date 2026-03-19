<script setup>
import { onMounted, computed } from 'vue'
import { useSerialStore } from './stores/serial'
import SerialSidebar from './components/SerialSidebar.vue'
import TerminalView from './components/TerminalView.vue'
import DataConverter from './components/DataConverter.vue'

const serialStore = useSerialStore()

// 检查是否是转换器独立窗口
const isConverterMode = computed(() => {
  return window.location.hash === '#/converter'
})

onMounted(async () => {
  serialStore.refreshPorts()
  // 加载常用命令配置
  serialStore.loadCommonCommands()
})
</script>

<template>
  <div class="app-container" v-if="!isConverterMode">
    <!-- 顶部标题栏 -->
    <header class="app-header">
      <div class="header-content">
        <span class="app-icon">📡</span>
        <span class="app-title">SerialX</span>
        <span class="app-subtitle">串口调试工具</span>
      </div>
    </header>

    <div class="workspace">
      <!-- 左侧边栏：串口列表 -->
      <aside class="sidebar">
        <SerialSidebar />
      </aside>

      <!-- 中间内容区：多分屏终端 -->
      <main class="main-area">
        <TerminalView />
      </main>
    </div>

    <!-- 底部状态栏 -->
    <footer class="status-bar">
      <span class="status-item">
        <span class="status-label">串口：</span>
        <span class="status-value">{{ serialStore.selectedPort || '未选择' }}</span>
      </span>
      <span class="status-item">
        <span class="status-label">状态：</span>
        <span class="status-value">{{ serialStore.openPorts.size > 0 ? '已连接' : '未连接' }}</span>
      </span>
      <span class="status-item">
        <span class="status-label">打开的串口：</span>
        <span class="status-value">{{ serialStore.openPorts.size }}</span>
      </span>
    </footer>
  </div>

  <!-- 转换器独立模式 -->
  <div v-else class="converter-only">
    <DataConverter standalone />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1e1e1e;
  color: #cccccc;
  overflow: hidden;
}

/* 顶部标题栏 */
.app-header {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 16px;
  background-color: #323233;
  border-bottom: 1px solid #3e3e42;
  flex-shrink: 0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-icon {
  font-size: 20px;
}

.app-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.app-subtitle {
  font-size: 12px;
  color: #858585;
}

/* 工作区：左侧边栏 + 中间内容 */
.workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧边栏 */
.sidebar {
  width: 260px;
  min-width: 200px;
  max-width: 400px;
  background-color: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 中间内容区 */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* 底部状态栏 */
.status-bar {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  background-color: #007acc;
  color: #ffffff;
  font-size: 12px;
  gap: 20px;
  flex-shrink: 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-label {
  opacity: 0.8;
}

.status-value {
  font-weight: 500;
}

/* 转换器独立模式 */
.converter-only {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
</style>
