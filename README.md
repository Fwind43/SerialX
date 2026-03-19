# SerialX

A modern serial port debugger built with Electron and Vue 3, combining the stability of SSCOM with the user experience of VS Code.

## Features

- **Serial Port Management**: Connect/disconnect, port scanning, baud rate settings
- **Terminal View**: Real-time data display with TX/RX indicators
- **Hex Mode**: Send and receive data in hexadecimal format
- **Loop Send**: Automatically send data at specified intervals
- **Custom Baud Rate**: Support for non-standard baud rates
- **Data Filters**: Regex-based filtering for incoming data (coming soon)
- **History Storage**: Save frequently used commands and configurations (coming soon)
- **Dark/Light Theme**: Adaptable UI with CSS variables (coming soon)

## Tech Stack

- **Framework**: Electron 30+
- **Frontend**: Vue 3 (SFC + Setup)
- **Build Tool**: Vite + Electron-Vite
- **State Management**: Pinia
- **Serial Port**: serialport
- **Terminal**: xterm.js (planned)

## Project Structure

```
SerialX/
├── electron/          # Electron main process files
│   ├── main.js       # Main process entry
│   └── preload.js    # Preload script
├── src/              # Vue renderer process files
│   ├── assets/       # CSS and static assets
│   ├── components/   # Vue components
│   │   ├── SerialControl.vue
│   │   └── TerminalView.vue
│   ├── stores/       # Pinia stores
│   │   └── serial.js
│   ├── App.vue       # Root component
│   └── main.js       # Vue app entry
├── index.html        # HTML template
├── electron.vite.config.js
├── vite.config.js
└── package.json
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

This will start the Electron app with hot-reload enabled.

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## Configuration

### Serial Port Settings

- **Baud Rate**: 300 to 921600 (including custom values)
- **Data Bits**: 5, 6, 7, 8
- **Stop Bits**: 1, 2
- **Parity**: None, Even, Odd, Mark, Space

## Roadmap

### Phase 1: Foundation (Week 1-2)
- [x] Electron + Vue 3 + Vite setup
- [x] SerialManager class implementation
- [x] Basic UI layout
- [x] IPC communication channels

### Phase 2: Advanced Layout (Week 3-4)
- [ ] Golden-Layout integration
- [ ] xterm.js integration
- [ ] Multi-window support

### Phase 3: Feature Enhancement (Week 5-6)
- [ ] Hex mode improvements
- [ ] Data filters with regex
- [ ] Better-Sqlite3 integration

### Phase 4: Polish & Release (Week 7+)
- [ ] Dark/Light theme
- [ ] Performance optimization
- [ ] Cross-platform builds (dmg/exe/deb)

## License

ISC
