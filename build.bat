@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo   SerialX 打包脚本
echo ========================================
echo.

:: 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    exit /b 1
)

echo [1/4] 清理旧的构建文件...
rmdir /s /q dist-electron 2>nul
rmdir /s /q out 2>nul
rmdir /s /q release 2>nul

echo [2/4] 安装依赖...
call npm install

echo [3/4] 构建应用...
call npm run build
if errorlevel 1 (
    echo [错误] 构建失败
    exit /b 1
)

echo [4/4] 打包 Windows 安装包...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run dist:win
if errorlevel 1 (
    echo [错误] 打包失败
    exit /b 1
)

echo.
echo ========================================
echo   打包完成!
echo ========================================
echo.
echo 输出目录：release\
echo   - SerialX-1.0.0-Setup.exe (安装程序)
echo   - win-unpacked\ (绿色版)
echo.

endlocal
