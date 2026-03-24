<script setup>
import { computed, ref } from 'vue'
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

const appearance = computed(() => serialStore.terminalAppearance)
const appTheme = computed(() => serialStore.appTheme || {})
const customAppearancePresets = computed(() => serialStore.customAppearancePresets || [])
const appUiState = computed(() => serialStore.appUiState || {})
const activeThemeSchemeId = computed(() => (
  appUiState.value.activeThemeSchemeId ||
  appUiState.value.terminalAppearanceMode ||
  `preset-${appUiState.value.themeMode || 'dark'}`
))
const wallpaperPath = computed(() => appUiState.value.wallpaperPath || '')
const wallpaperEnabled = computed(() => Boolean(appUiState.value.wallpaperEnabled && wallpaperPath.value))
const wallpaperOpacity = computed(() => {
  const value = Number(appUiState.value.wallpaperOpacity ?? 0.22)
  return Number.isFinite(value) ? Math.min(0.6, Math.max(0.28, value)) : 0.36
})
const sidebarOpacity = computed(() => {
  const value = Number(appUiState.value.sidebarOpacity ?? 0.42)
  return Number.isFinite(value) ? Math.min(0.82, Math.max(0.04, value)) : 0.42
})
const workspaceOpacity = computed(() => {
  const value = Number(appUiState.value.workspaceOpacity ?? 0.42)
  return Number.isFinite(value) ? Math.min(0.82, Math.max(0.04, value)) : 0.42
})
const terminalOpacity = computed(() => {
  const value = Number(appUiState.value.terminalOpacity ?? 0.34)
  return Number.isFinite(value) ? Math.min(0.82, Math.max(0.04, value)) : 0.34
})
const wallpaperTransparencyPercent = computed(() => Math.round((1 - wallpaperOpacity.value) * 100))
const sidebarTransparencyPercent = computed(() => Math.round((1 - sidebarOpacity.value) * 100))
const workspaceTransparencyPercent = computed(() => Math.round((1 - workspaceOpacity.value) * 100))
const terminalTransparencyPercent = computed(() => Math.round((1 - terminalOpacity.value) * 100))
const activeSection = ref('scheme')
const newPresetName = ref('')
const actionMessage = ref('')
const actionTone = ref('info')

const appearanceSchemeOptions = computed(() => ([
  {
    id: 'preset-dark',
    name: '深色默认',
    mode: 'preset-dark',
    kind: 'built-in',
    description: '内置暗黑方案，锁定不可直接修改'
  },
  {
    id: 'preset-light',
    name: '浅色默认',
    mode: 'preset-light',
    kind: 'built-in',
    description: '内置浅色方案，锁定不可直接修改'
  },
  ...customAppearancePresets.value.map((preset) => ({
    id: preset.id,
    name: preset.name,
    mode: `custom:${preset.id}`,
    kind: 'custom',
    description: '用户自定义方案，可继续编辑'
  }))
]))

const isBuiltInAppearanceMode = computed(() => (
  activeThemeSchemeId.value === 'preset-dark' || activeThemeSchemeId.value === 'preset-light'
))
const currentSchemeName = computed(() => {
  const current = appearanceSchemeOptions.value.find((scheme) => scheme.mode === activeThemeSchemeId.value)
  return current?.name || '未命名方案'
})
const canCreateScheme = computed(() => typeof serialStore.createThemeScheme === 'function' || typeof serialStore.createCustomTerminalAppearancePreset === 'function')

const baseColorFields = [
  { key: 'terminalBackground', label: '终端背景色', hint: 'xterm 主背景颜色' },
  { key: 'terminalForeground', label: '终端字体色', hint: '终端普通文本颜色' },
  { key: 'cursorColor', label: '光标颜色', hint: '输入和定位光标的颜色' },
  { key: 'selectionColor', label: '选区颜色', hint: '鼠标选中文本时的背景色' }
]

const searchColorFields = [
  { key: 'searchMatchColor', label: '搜索匹配色', hint: '普通命中的高亮颜色' },
  { key: 'searchMatchTextColor', label: '匹配文字色', hint: '普通命中的文字颜色' },
  { key: 'searchCurrentMatchColor', label: '当前匹配色', hint: '当前命中的高亮颜色' },
  { key: 'searchCurrentMatchTextColor', label: '当前文字色', hint: '当前命中的文字颜色' }
]

const appThemeFields = [
  { key: 'background', label: '应用背景', hint: '窗口最外层背景颜色' },
  { key: 'headerBg', label: '标题栏', hint: '顶部标题栏与窗口控制区域背景' },
  { key: 'menuBg', label: '菜单下拉', hint: '工具/设置等菜单下拉面板背景' },
  { key: 'sidebarShell', label: '侧栏外壳', hint: '左侧串口栏最外层面板背景' },
  { key: 'sidebarSurface', label: '侧栏内容', hint: '侧栏内部区块、按钮与设置区域背景' },
  { key: 'workspaceShell', label: '工作区外壳', hint: '主工作区与外层壳体背景' },
  { key: 'workspaceSurface', label: '工作区内容', hint: '标签、面板与内容区块背景' },
  { key: 'statusBarBg', label: '状态栏', hint: '底部状态胶囊与状态区域背景' },
  { key: 'text', label: '主文字色', hint: '标题与主要信息的文字颜色' },
  { key: 'textSoft', label: '次级文字色', hint: '说明、元信息与弱化文本' },
  { key: 'border', label: '边框色', hint: '面板边界、分隔线与描边' },
  { key: 'accent', label: '强调色', hint: '高亮、选中和品牌强调色' },
  { key: 'accentText', label: '强调文字色', hint: '高亮胶囊和强调内容上的文字色' }
]

const fontSize = computed(() => {
  const value = Number(appearance.value.fontSize ?? 13)
  return Number.isFinite(value) ? Math.min(24, Math.max(10, value)) : 13
})

const fontWeight = computed(() => {
  const value = String(appearance.value.fontWeight ?? '400')
  return ['300', '400', '500', '600', '700'].includes(value) ? value : '400'
})

const colorInputValue = (value) => {
  if (typeof value !== 'string') return '#000000'
  return value.startsWith('#') ? value : '#000000'
}

const updateColor = (key, value) => {
  serialStore.updateTerminalAppearance({ [key]: value })
}

const updateAppThemeColor = (key, value) => {
  if (typeof serialStore.updateAppTheme === 'function') {
    const updated = serialStore.updateAppTheme({ [key]: value })
    if (!updated) {
      showActionFeedback('内置方案不能直接编辑，请先基于它新建一套方案。', 'error')
    }
    return
  }

  serialStore.appTheme = {
    ...(serialStore.appTheme || {}),
    [key]: value
  }
  showActionFeedback('应用主题已更新。', 'success')
}

const updateFontSize = (value) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return
  serialStore.updateTerminalAppearance({
    fontSize: Math.min(24, Math.max(10, numericValue))
  })
}

const updateFontWeight = (value) => {
  const nextValue = String(value)
  if (!['300', '400', '500', '600', '700'].includes(nextValue)) return
  serialStore.updateTerminalAppearance({
    fontWeight: nextValue
  })
}

const updateLineHighlight = (value) => {
  serialStore.updateTerminalAppearance({
    searchLineHighlightColor: `rgba(${value.r}, ${value.g}, ${value.b}, ${value.a})`
  })
}

const parseRgba = (value) => {
  const match = typeof value === 'string'
    ? value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/i)
    : null

  if (!match) {
    return { r: 255, g: 235, b: 59, a: 0.14 }
  }

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: Number(match[4] ?? 1)
  }
}

const lineHighlight = computed(() => parseRgba(appearance.value.searchLineHighlightColor))

const showActionFeedback = (message, tone = 'info') => {
  actionMessage.value = message
  actionTone.value = tone
}

const closeModal = () => {
  emit('update:show', false)
}

const pickWallpaper = async () => {
  const result = await window.electronAPI?.selectWallpaper?.()
  if (!result || result.canceled || !result.success) return

  serialStore.updateAppUiState({
    wallpaperEnabled: true,
    wallpaperPath: result.filePath
  })
}

const toggleWallpaper = () => {
  if (!wallpaperPath.value) {
    pickWallpaper()
    return
  }

  serialStore.updateAppUiState({
    wallpaperEnabled: !wallpaperEnabled.value
  })
}

const clearWallpaper = () => {
  serialStore.updateAppUiState({
    wallpaperEnabled: false,
    wallpaperPath: ''
  })
}

const updateTransparencyField = (key, value, minAlpha, maxAlpha) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return

  serialStore.updateAppUiState({
    [key]: Math.min(maxAlpha, Math.max(minAlpha, 1 - numericValue / 100))
  })
}

const applyAppearanceScheme = (mode) => {
  if (activeThemeSchemeId.value === mode) {
    showActionFeedback('当前方案已在使用中。', 'info')
    return
  }

  if (typeof serialStore.applyThemeScheme === 'function') {
    const applied = serialStore.applyThemeScheme(mode)
    showActionFeedback(applied ? '方案已应用。' : '方案应用失败。', applied ? 'success' : 'error')
    return
  }

  if (typeof serialStore.applyTerminalAppearanceMode === 'function') {
    const applied = serialStore.applyTerminalAppearanceMode(mode)
    showActionFeedback(applied ? '方案已应用。' : '方案应用失败。', applied ? 'success' : 'error')
    return
  }

  const presetMode = mode === 'preset-light' ? 'light' : mode === 'preset-dark' ? 'dark' : null
  if (presetMode) {
    serialStore.resetTerminalAppearance?.(presetMode)
    showActionFeedback('内置方案已应用。', 'success')
    return
  }

  showActionFeedback('当前窗口需要刷新后才能使用方案切换。', 'error')
}

const createAppearanceScheme = (sourceMode = activeThemeSchemeId.value) => {
  const createScheme = serialStore.createThemeScheme || serialStore.createCustomTerminalAppearancePreset
  if (typeof createScheme !== 'function') {
    showActionFeedback('当前窗口需要刷新后才能创建方案。', 'error')
    return
  }
  const preset = createScheme(newPresetName.value, sourceMode)
  newPresetName.value = ''
  showActionFeedback(`已新建方案“${preset?.name || '自定义方案'}”。`, 'success')
}

const removeAppearanceScheme = (mode) => {
  const presetId = typeof mode === 'string' && mode.startsWith('custom:')
    ? mode.slice('custom:'.length)
    : ''
  const removeScheme = serialStore.removeThemeScheme || serialStore.removeCustomTerminalAppearancePreset
  if (!presetId || typeof removeScheme !== 'function') {
    showActionFeedback('当前窗口需要刷新后才能删除方案。', 'error')
    return
  }
  removeScheme(presetId)
  showActionFeedback('自定义方案已删除。', 'success')
}

const resetDefaults = () => {
  if (typeof serialStore.resetThemeScheme === 'function') {
    serialStore.resetThemeScheme()
    showActionFeedback('当前方案已恢复到创建时的默认状态。', 'success')
    return
  }

  serialStore.resetTerminalAppearance?.()
  serialStore.resetAppTheme?.()
  showActionFeedback('当前方案已恢复默认状态。', 'success')
}

const resetApplicationTheme = () => {
  if (typeof serialStore.resetAppTheme === 'function') {
    serialStore.resetAppTheme()
    showActionFeedback('应用主题已恢复当前模式默认值。', 'success')
    return
  }
}
</script>

<template>
  <div v-if="show" :class="['modal-overlay', { standalone: props.standalone }]">
    <div class="modal">
      <div class="modal-header">
        <div>
          <div class="modal-title">外观设置</div>
          <div class="modal-subtitle">先选方案，再细调终端与壁纸；主窗口会同步实时预览</div>
        </div>
        <button class="modal-close" @click="closeModal">×</button>
      </div>

      <div class="modal-body">
        <section class="settings-section hero-section">
          <div class="hero-card">
            <div class="hero-copy">
              <div class="hero-label">当前方案</div>
              <div class="hero-title">{{ currentSchemeName }}</div>
              <div class="hero-meta">{{ isBuiltInAppearanceMode ? '内置方案，锁定只读' : '自定义方案，可直接编辑' }}</div>
            </div>
            <div class="hero-actions">
              <button class="modal-btn secondary" :disabled="!canCreateScheme" @click="createAppearanceScheme()">基于当前新建</button>
              <button v-if="!isBuiltInAppearanceMode" class="modal-btn secondary" @click="resetDefaults">恢复当前方案默认值</button>
            </div>
          </div>
          <div v-if="actionMessage" :class="['action-feedback', actionTone]">{{ actionMessage }}</div>
          <div class="section-tabs">
            <button :class="['section-tab', { active: activeSection === 'scheme' }]" @click="activeSection = 'scheme'">方案</button>
            <button :class="['section-tab', { active: activeSection === 'app' }]" @click="activeSection = 'app'">应用</button>
            <button :class="['section-tab', { active: activeSection === 'wallpaper' }]" @click="activeSection = 'wallpaper'">壁纸</button>
            <button :class="['section-tab', { active: activeSection === 'terminal' }]" @click="activeSection = 'terminal'">终端</button>
            <button :class="['section-tab', { active: activeSection === 'advanced' }]" @click="activeSection = 'advanced'">高级</button>
          </div>
        </section>

        <section v-if="activeSection === 'scheme'" class="settings-section">
          <div class="section-heading">
            <div class="section-title">外观方案</div>
            <div class="section-subtitle">内置浅色与深色方案锁定不可修改，先基于某套方案新建，再编辑自己的方案</div>
          </div>
          <div class="settings-grid">
            <div
              v-for="scheme in appearanceSchemeOptions"
              :key="scheme.mode"
              :class="['setting-card', 'scheme-card', { active: activeThemeSchemeId === scheme.mode }]"
            >
              <div class="scheme-card-head">
                <div>
                  <div class="setting-label">{{ scheme.name }}</div>
                  <div class="setting-hint">{{ scheme.description }}</div>
                </div>
                <span :class="['scheme-badge', scheme.kind]">
                  {{ scheme.kind === 'built-in' ? '内置' : '自定义' }}
                </span>
              </div>
              <div class="scheme-actions">
                <button class="modal-btn secondary" :disabled="activeThemeSchemeId === scheme.mode" @click="applyAppearanceScheme(scheme.mode)">
                  {{ activeThemeSchemeId === scheme.mode ? '当前使用中' : '应用' }}
                </button>
                <button class="modal-btn secondary" :disabled="!canCreateScheme" @click="createAppearanceScheme(scheme.mode)">基于此新建</button>
                <button
                  v-if="scheme.kind === 'custom'"
                  class="modal-btn danger"
                  :disabled="activeThemeSchemeId === scheme.mode"
                  @click="removeAppearanceScheme(scheme.mode)"
                >
                  删除
                </button>
              </div>
            </div>

            <div class="setting-card">
              <div class="setting-info">
                <label class="setting-label">新方案名称</label>
                <span class="setting-hint">当前会基于已选中的方案创建一套新的可编辑方案</span>
              </div>
              <div class="setting-controls">
                <input
                  v-model="newPresetName"
                  type="text"
                  class="color-input"
                  maxlength="30"
                  placeholder="例如：浅蓝终端 / 低对比深色"
                />
                <button class="modal-btn primary" :disabled="!canCreateScheme" @click="createAppearanceScheme()">新建方案</button>
              </div>
            </div>
          </div>
          <div v-if="isBuiltInAppearanceMode" class="locked-hint">
            当前使用的是内置方案。颜色、字号和字重不会直接写回内置方案；先“基于此新建”后再调。
          </div>
        </section>

        <section v-if="activeSection === 'wallpaper'" class="settings-section">
          <div class="section-heading">
            <div class="section-title">壁纸与透明度</div>
            <div class="section-subtitle">把壁纸开关和各区域透出强度集中到一个面板里调</div>
          </div>
          <div class="settings-grid">
            <div class="setting-card">
              <div class="setting-info">
                <label class="setting-label">桌面背景</label>
                <span class="setting-hint">{{ wallpaperPath || '还没有选择壁纸' }}</span>
              </div>
              <div class="wallpaper-actions">
                <button class="modal-btn secondary" @click="pickWallpaper">
                  {{ wallpaperPath ? '更换壁纸' : '选择壁纸' }}
                </button>
                <button v-if="wallpaperPath" class="modal-btn secondary" @click="toggleWallpaper">
                  {{ wallpaperEnabled ? '关闭壁纸' : '启用壁纸' }}
                </button>
                <button v-if="wallpaperPath" class="modal-btn danger" @click="clearWallpaper">清除壁纸</button>
              </div>
            </div>

            <div class="setting-card">
              <div class="setting-info">
                <label class="setting-label">壁纸透明度</label>
                <span class="setting-hint">数值越高越透明，壁纸会更淡一些</span>
              </div>
              <div class="slider-row">
                <input
                  class="slider-input"
                  type="range"
                  min="40"
                  max="72"
                  step="2"
                  :value="wallpaperTransparencyPercent"
                  @input="updateTransparencyField('wallpaperOpacity', $event.target.value, 0.28, 0.6)"
                />
                <span class="slider-value">{{ wallpaperTransparencyPercent }}%</span>
              </div>
            </div>

            <div class="setting-card">
              <div class="setting-info">
                <label class="setting-label">侧栏透明度</label>
                <span class="setting-hint">控制左侧串口栏与设置区的透出程度</span>
              </div>
              <div class="slider-row">
                <input
                  class="slider-input"
                  type="range"
                  min="18"
                  max="96"
                  step="2"
                  :value="sidebarTransparencyPercent"
                  @input="updateTransparencyField('sidebarOpacity', $event.target.value, 0.04, 0.82)"
                />
                <span class="slider-value">{{ sidebarTransparencyPercent }}%</span>
              </div>
            </div>

            <div class="setting-card">
              <div class="setting-info">
                <label class="setting-label">工作区透明度</label>
                <span class="setting-hint">控制标签区、pane 容器和主内容壳层</span>
              </div>
              <div class="slider-row">
                <input
                  class="slider-input"
                  type="range"
                  min="18"
                  max="96"
                  step="2"
                  :value="workspaceTransparencyPercent"
                  @input="updateTransparencyField('workspaceOpacity', $event.target.value, 0.04, 0.82)"
                />
                <span class="slider-value">{{ workspaceTransparencyPercent }}%</span>
              </div>
            </div>

            <div class="setting-card">
              <div class="setting-info">
                <label class="setting-label">终端透明度</label>
                <span class="setting-hint">控制终端正文区域和终端外框的透出程度</span>
              </div>
              <div class="slider-row">
                <input
                  class="slider-input"
                  type="range"
                  min="18"
                  max="96"
                  step="2"
                  :value="terminalTransparencyPercent"
                  @input="updateTransparencyField('terminalOpacity', $event.target.value, 0.04, 0.82)"
                />
                <span class="slider-value">{{ terminalTransparencyPercent }}%</span>
              </div>
            </div>

          </div>
        </section>

        <section v-if="activeSection === 'app'" class="settings-section">
          <div class="section-heading">
            <div class="section-title">应用主题</div>
            <div class="section-subtitle">先开放最核心的全局壳层颜色，覆盖侧栏、面板、菜单、文字和高亮语义色</div>
          </div>
          <div class="settings-grid">
            <div v-for="field in appThemeFields" :key="field.key" class="setting-card">
              <div class="setting-info">
                <label class="setting-label">{{ field.label }}</label>
                <span class="setting-hint">{{ field.hint }}</span>
              </div>
              <div class="setting-controls">
                <input
                  :value="colorInputValue(appTheme[field.key])"
                  type="color"
                  class="color-picker"
                  :disabled="isBuiltInAppearanceMode"
                  @input="updateAppThemeColor(field.key, $event.target.value)"
                />
                <input
                  :value="appTheme[field.key]"
                  type="text"
                  class="color-input"
                  :disabled="isBuiltInAppearanceMode"
                  @input="updateAppThemeColor(field.key, $event.target.value)"
                />
              </div>
            </div>
          </div>
          <div class="setting-actions">
            <button class="modal-btn secondary" :disabled="isBuiltInAppearanceMode" @click="resetApplicationTheme">恢复应用主题默认值</button>
          </div>
          <div v-if="isBuiltInAppearanceMode" class="locked-hint">
            当前使用的是内置整套主题方案。应用区域颜色和终端外观都会一起锁定；请先在“方案”页基于当前方案新建，再编辑。
          </div>
        </section>

        <section v-if="activeSection === 'terminal'" class="settings-section">
          <div class="section-heading">
            <div class="section-title">基础</div>
            <div class="section-subtitle">终端背景、文字、字号、字重和选区</div>
          </div>
          <div class="settings-grid">
            <div class="setting-card">
              <div class="setting-info">
                <label class="setting-label">字体大小</label>
                <span class="setting-hint">直接影响终端每行显示密度与整体可读性</span>
              </div>
              <div class="slider-row">
                <input
                  class="slider-input"
                  type="range"
                  min="10"
                  max="24"
                  step="1"
                  :value="fontSize"
                  :disabled="isBuiltInAppearanceMode"
                  @input="updateFontSize($event.target.value)"
                />
                <span class="slider-value">{{ fontSize }}px</span>
              </div>
            </div>

            <div class="setting-card">
              <div class="setting-info">
                <label class="setting-label">字体粗细</label>
                <span class="setting-hint">让终端文字更轻或更扎实，便于搭配不同主题</span>
              </div>
              <div class="setting-controls">
                <select class="color-input" :value="fontWeight" :disabled="isBuiltInAppearanceMode" @change="updateFontWeight($event.target.value)">
                  <option value="300">300 细体</option>
                  <option value="400">400 常规</option>
                  <option value="500">500 中等</option>
                  <option value="600">600 半粗</option>
                  <option value="700">700 粗体</option>
                </select>
              </div>
            </div>

            <div v-for="field in baseColorFields" :key="field.key" class="setting-card">
              <div class="setting-info">
                <label class="setting-label">{{ field.label }}</label>
                <span class="setting-hint">{{ field.hint }}</span>
              </div>
              <div class="setting-controls">
                <input
                  :value="colorInputValue(appearance[field.key])"
                  type="color"
                  class="color-picker"
                  :disabled="isBuiltInAppearanceMode"
                  @input="updateColor(field.key, $event.target.value)"
                />
                <input
                  :value="appearance[field.key]"
                  type="text"
                  class="color-input"
                  :disabled="isBuiltInAppearanceMode"
                  @input="updateColor(field.key, $event.target.value)"
                />
              </div>
            </div>
          </div>
          <div v-if="isBuiltInAppearanceMode" class="locked-hint">
            当前处于内置方案浏览状态。要修改颜色、字号或字重，请先回到“方案”页基于它新建一套自定义方案。
          </div>
        </section>

        <section v-if="activeSection === 'advanced'" class="settings-section">
          <div class="section-heading">
            <div class="section-title">搜索高亮</div>
            <div class="section-subtitle">普通命中和当前命中的颜色组合</div>
          </div>
          <div class="settings-grid">
            <div v-for="field in searchColorFields" :key="field.key" class="setting-card">
              <div class="setting-info">
                <label class="setting-label">{{ field.label }}</label>
                <span class="setting-hint">{{ field.hint }}</span>
              </div>
              <div class="setting-controls">
                <input
                  :value="colorInputValue(appearance[field.key])"
                  type="color"
                  class="color-picker"
                  :disabled="isBuiltInAppearanceMode"
                  @input="updateColor(field.key, $event.target.value)"
                />
                <input
                  :value="appearance[field.key]"
                  type="text"
                  class="color-input"
                  :disabled="isBuiltInAppearanceMode"
                  @input="updateColor(field.key, $event.target.value)"
                />
              </div>
            </div>
          </div>
        </section>

        <div v-if="activeSection === 'terminal' || activeSection === 'advanced'" class="preview-card">
          <div class="preview-title">预览</div>
          <div
            class="preview-surface"
            :style="{
              backgroundColor: appearance.terminalBackground,
              color: appearance.terminalForeground,
              fontSize: `${fontSize}px`,
              fontWeight
            }"
          >
            <span class="preview-text">RX: normal text</span>
            <span
              class="preview-mark"
              :style="{ color: appearance.searchMatchTextColor, boxShadow: `inset 0 -0.62em 0 ${appearance.searchMatchColor}` }"
            >
              matched
            </span>
            <span
              class="preview-mark current"
              :style="{ color: appearance.searchCurrentMatchTextColor, boxShadow: `inset 0 -0.68em 0 ${appearance.searchCurrentMatchColor}` }"
            >
              current
            </span>
          </div>
        </div>

        <section v-if="activeSection === 'advanced'" class="settings-section advanced-section">
          <div class="setting-card line-highlight-card">
            <div class="setting-info">
              <label class="setting-label">当前匹配行高亮</label>
              <span class="setting-hint">低频设置，支持 RGBA 自定义整行弱高亮</span>
            </div>
            <div class="line-grid">
              <input
                :value="appearance.searchLineHighlightColor"
                type="text"
                class="color-input line-input"
                :disabled="isBuiltInAppearanceMode"
                @input="serialStore.updateTerminalAppearance({ searchLineHighlightColor: $event.target.value })"
              />
              <label class="range-group">
                <span>透明度</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="lineHighlight.a"
                  :disabled="isBuiltInAppearanceMode"
                  @input="updateLineHighlight({ ...lineHighlight, a: Number($event.target.value) })"
                />
              </label>
            </div>
          </div>
          <div v-if="isBuiltInAppearanceMode" class="locked-hint">
            高级搜索高亮同样遵循方案锁定规则。内置方案只读，自定义方案可编辑。
          </div>
        </section>
      </div>

      <div class="modal-footer">
        <button class="modal-btn secondary" @click="resetDefaults">恢复默认</button>
        <button class="modal-btn primary" @click="closeModal">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: transparent;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 72px 20px 20px;
  z-index: 1100;
  pointer-events: none;
}

.modal {
  width: min(560px, calc(100vw - 40px));
  max-height: calc(100vh - 92px);
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, var(--app-modal-bg), var(--app-modal-soft));
  border: 1px solid var(--app-modal-border);
  border-radius: 18px;
  box-shadow: var(--app-shadow-lg);
  backdrop-filter: blur(18px);
  pointer-events: auto;
}

.modal-overlay.standalone {
  position: relative;
  inset: auto;
  display: block;
  height: 100vh;
  padding: 0;
  pointer-events: auto;
}

.modal-overlay.standalone .modal {
  width: 100%;
  height: 100vh;
  max-height: 100vh;
  min-height: 0;
  border-radius: 0;
  border: none;
  box-shadow: none;
}

.modal-header,
.modal-footer {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header { border-bottom: 1px solid var(--app-border); }

.modal-footer {
  border-top: 1px solid var(--app-border);
  gap: 12px;
  justify-content: flex-end;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
}

.modal-subtitle {
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-text-soft);
}

.modal-close {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: var(--app-chip-bg);
  color: var(--app-text);
  cursor: pointer;
}

.modal-body {
  flex: 1;
  min-height: 0;
  padding: 24px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero-section {
  gap: 14px;
}

.hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border-radius: 16px;
  background: linear-gradient(160deg, var(--app-accent-soft), var(--app-chip-bg));
  border: 1px solid var(--app-chip-border);
}

.hero-copy {
  min-width: 0;
}

.hero-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--app-chip-text);
}

.hero-title {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 700;
  color: var(--app-text);
}

.hero-meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-text-soft);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.action-feedback {
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid transparent;
}

.action-feedback.info {
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
  color: var(--app-chip-text);
}

.action-feedback.success {
  background: var(--app-success-soft);
  border-color: var(--app-success-border);
  color: var(--app-success-text);
}

.action-feedback.error {
  background: var(--app-danger-soft);
  border-color: var(--app-danger-border);
  color: var(--app-danger-text);
}

.section-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.section-tab {
  height: 40px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-chip-bg);
  color: var(--app-text);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}

.section-tab:hover { background: var(--app-accent-soft); }

.section-tab:active {
  transform: translateY(1px) scale(0.985);
  background: var(--app-accent-strong);
}

.section-tab.active {
  background: var(--app-accent-strong);
  border-color: var(--app-chip-border);
  color: var(--app-text);
}

.section-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text);
}

.section-subtitle {
  font-size: 12px;
  color: var(--app-text-soft);
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.setting-card,
.preview-card {
  padding: 16px;
  border-radius: 14px;
  background: var(--app-workspace-shell);
  border: 1px solid var(--app-border);
}

.scheme-card.active {
  border-color: var(--app-chip-border);
  box-shadow: inset 0 0 0 1px var(--app-accent-soft);
}

.setting-info {
  margin-bottom: 12px;
}

.scheme-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.scheme-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.scheme-badge.built-in {
  background: var(--app-warning-soft);
  color: var(--app-warning-text);
}

.scheme-badge.custom {
  background: var(--app-accent-soft);
  color: var(--app-chip-text);
}

.scheme-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.wallpaper-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.locked-hint {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--app-warning-soft);
  border: 1px solid var(--app-warning-border);
  color: var(--app-warning-text);
  font-size: 12px;
  line-height: 1.6;
}

.setting-actions {
  display: flex;
  justify-content: flex-start;
}

.slider-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.slider-input {
  width: 100%;
}

.slider-value {
  min-width: 48px;
  text-align: right;
  font-size: 12px;
  font-weight: 700;
  color: var(--app-text);
}

.setting-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
}

.setting-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-text-soft);
}

.setting-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.color-picker {
  width: 44px;
  height: 36px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.color-input {
  flex: 1;
  height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--app-border);
  background: var(--app-workspace-soft);
  color: var(--app-text);
  font-family: Consolas, "Courier New", monospace;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
  margin-bottom: 12px;
}

.preview-surface {
  border-radius: 12px;
  padding: 18px 16px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 14px;
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.preview-mark {
  background: transparent;
  border-radius: 0.08em;
  padding: 0 0.08em;
}

.preview-mark.current {
  border-radius: 0.1em;
}

.advanced-toggle {
  align-self: flex-start;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-chip-bg);
  color: var(--app-text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.advanced-toggle:hover {
  background: var(--app-accent-soft);
}

.line-grid {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.line-input {
  min-width: 280px;
}

.range-group {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--app-text-soft);
  font-size: 12px;
}

.modal-btn {
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.12s ease, filter 0.12s ease, background-color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
}

.modal-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-btn.secondary {
  background: var(--app-chip-bg);
  border-color: var(--app-border);
  color: var(--app-text);
}

.modal-btn.secondary:hover:not(:disabled) {
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
  color: var(--app-text);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--app-accent) 18%, transparent);
}

.modal-btn.danger {
  background: var(--app-danger-soft);
  border-color: var(--app-danger-border);
  color: var(--app-danger-text);
}

.modal-btn.primary {
  background: linear-gradient(135deg, var(--app-accent) 0%, color-mix(in srgb, var(--app-accent) 70%, #f59e0b) 100%);
  color: var(--app-text);
}

.modal-btn.primary:hover:not(:disabled),
.modal-btn.danger:hover:not(:disabled) {
  filter: brightness(1.06);
}

.modal-btn.secondary:active:not(:disabled),
.modal-btn.primary:active:not(:disabled),
.modal-btn.danger:active:not(:disabled) {
  transform: translateY(1px) scale(0.985);
  filter: brightness(0.96);
}

@media (max-width: 900px) {
  .modal-overlay {
    justify-content: center;
    padding: 20px;
  }

  .modal {
    width: min(560px, calc(100vw - 24px));
    max-height: min(90vh, 900px);
  }

  .hero-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .section-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
