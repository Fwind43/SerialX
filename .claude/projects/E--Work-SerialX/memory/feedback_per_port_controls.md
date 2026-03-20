---
name: Per-port independent control settings
description: All control options (Hex, Auto-scroll, Loop-send) should use per-port settings via portControlSettings Map for split-screen independence
type: feedback
---

**When implementing control options for serial ports**, always use per-port settings stored in `portControlSettings` Map rather than global variables.

**Why:** In split-screen mode with multiple serial panels, each panel needs independent control over its own settings (Hex mode, auto-scroll, loop-send interval/count).

**How to apply:**
- Store settings: `portControlSettings.value.set(portPath, { isAutoScroll, isLoopSend, loopInterval, loopMaxCount, hexMode })`
- Get settings: `getPortControlSettings(portPath)` returns the port's settings object
- Update settings: `updatePortControlSettings(portPath, { key: value })`
- In Vue templates, use `portControlSettings.value.isXxx` not `serialStore.isXxx`
- Call `serialStore.updatePortControlSettings()` in change handlers
- Settings are auto-saved to localStorage on every change

**Reference:** See `src/stores/serial.js` for store functions and `src/components/SerialPanel.vue` for usage examples.
