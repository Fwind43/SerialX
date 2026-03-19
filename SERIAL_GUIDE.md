# 串口调试指南

## 问题：找不到串口设备

如果运行应用后显示"未找到串口设备"，这是正常的。现代电脑大多没有内置串口。

## 解决方案

### 方案一：使用虚拟串口（推荐用于测试）

虚拟串口软件可以创建一对互相连接的虚拟串口，用于测试软件功能。

#### Windows - 使用 com0com（免费）

1. 下载 com0com：
   - 官网：https://sourceforge.net/projects/com0com/
   - 或 GitHub：https://github.com/fr500/com0com

2. 安装后运行 `SetupCOM` 或 `hw3com`

3. 创建一对虚拟串口（如 COM3 <-> COM4）：
   ```
   install -n Com3#Com4
   ```

4. 在 SerialX 中选择 COM3，用 SSCOM 或其他工具打开 COM4
   - 两个工具可以互相通信！

#### Windows - 使用 VSPE (Virtual Serial Port Emulator)

1. 下载：https://www.eterlogic.com/Products.VSPE.html

2. 创建 "Connector" 和 "Splitter" 设备

### 方案二：连接物理串口设备

以下设备插入 USB 后会被识别为串口：

- **Arduino Uno/Nano** - 需要上传一个发送数据的程序
- **ESP32/ESP8266** - 开发板自带 USB 转串口
- **USB 转 TTL 适配器** - 常见芯片：
  - CH340（最常见，便宜）
  - CP2102
  - FT232
  - PL2303

#### 测试 Arduino 示例

```cpp
// 上传到 Arduino
void setup() {
  Serial.begin(9600);
}

void loop() {
  Serial.println("Hello from Arduino!");
  delay(1000);

  // 读取接收到的数据
  if (Serial.available()) {
    String received = Serial.readString();
    Serial.print("收到：");
    Serial.println(received);
  }
}
```

### 方案三：检查设备管理器（Windows）

1. 按 `Win + X`，选择"设备管理器"
2. 展开"端口 (COM 和 LPT)"
3. 查看是否有任何 COM 端口

如果有设备但显示黄色感叹号：
- 需要安装驱动程序
- CH340 驱动：https://github.com/nodemcu/nodemcu-devkit-v1.0/raw/master/Drivers/CH341SER.zip

## 验证 serialport 工作正常

运行以下命令测试：

```bash
node -e "const { SerialPort } = require('serialport'); SerialPort.list().then(ports => console.log('Ports:', ports))"
```

如果输出 `Ports: []` 表示库正常但没有设备。
如果报错，说明 serialport 安装有问题。

## 常见问题

### Q: 设备管理器能看到 COM 口，但软件里看不到？

A: 尝试：
1. 重启 SerialX
2. 点击刷新按钮
3. 检查设备是否被其他程序占用（关闭 SSCOM、Putty 等）

### Q: 打开串口失败？

A: 检查：
1. 串口是否被其他程序占用
2. 波特率是否正确
3. 设备是否正常工作（设备管理器无感叹号）

### Q: 能打开但收不到数据？

A: 检查：
1. TX/RX 是否接反（TX 接 RX，RX 接 TX）
2. 波特率是否匹配
3. GND 是否共地
