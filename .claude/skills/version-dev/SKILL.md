---
name: version-dev
description: 版本开发分支管理 - 当用户需要开发新版本时自动创建和管理开发分支。触发场景：用户提到"开发新版本"、"创建版本分支"、"开始 v0.x.x 版本"、"分支管理"等。此技能确保版本开发遵循规范的分支策略，避免直接在 release 分支上开发。
---

# 版本开发分支管理技能

## 触发条件

当用户表达以下意图时，使用此技能：
- 开发新版本（如"开发 v0.0.2"、"新版本功能"）
- 创建版本分支（如"创建 0.0.2 分支"、"新建开发分支"）
- 分支管理相关请求（如"切换分支"、"分支怎么管理"）
- 提到版本号 + 开发/分支等关键词

## 分支命名规范

| 分支类型 | 命名格式 | 用途 |
|---------|---------|------|
| 发布分支 | `release/v{x.y.z}` | 稳定发布版本 |
| 开发分支 | `v{x.y.z}-dev` | 正在开发中的版本 |
| 功能分支 | `feature/{name}` | 特定功能开发 |

## 操作流程

### 1. 检查当前状态

```bash
# 检查当前分支
git branch

# 检查是否有未提交的更改
git status
```

### 2. 创建新版本开发分支

当用户要开发版本 `{x.y.z}` 时：

```bash
# 从对应的 release 分支创建新的开发分支
git checkout -b v{x.y.z}-dev release/v{x.y.z}

# 推送到远程
git push -u origin v{x.y.z}-dev
```

### 3. 分支切换指引

- **开发中**: 始终在 `v{x.y.z}-dev` 分支上进行开发
- **提交代码**: 频繁提交，使用清晰的提交信息
- **准备发布**: 开发完成后合并到 `release/v{x.y.z}`

### 4. 版本发布流程

```bash
# 开发完成，切换回 release 分支
git checkout release/v{x.y.z}

# 合并开发分支
git merge v{x.y.z}-dev

# 打标签
git tag -a v{x.y.z} -m "Release v{x.y.z}"

# 推送
git push origin release/v{x.y.z}
git push origin v{x.y.z}
```

## 常用命令参考

### 查看分支状态
```bash
git branch          # 本地分支
git branch -a       # 所有分支（含远程）
git status          # 当前状态
```

### 创建/切换分支
```bash
git checkout -b {branch-name}           # 创建并切换
git switch {branch-name}                # 切换到已有分支
git push -u origin {branch-name}        # 推送到远程并关联
```

### 提交代码
```bash
git add .                               # 暂存所有更改
git commit -m "type: description"       # 提交代码
git push                                # 推送到远程
```

### 提交信息格式
- `feat:` 新功能
- `fix:` 修复 bug
- `refactor:` 重构
- `chore:` 构建/工具相关
- `docs:` 文档更新
- `style:` 格式/样式

## 示例对话

**用户**: "开始开发 v0.0.2 版本"

**操作**:
1. 确认当前在 `release/v0.0.2` 或 `main` 分支
2. 执行 `git checkout -b v0.0.2-dev release/v0.0.2`
3. 推送：`git push -u origin v0.0.2-dev`
4. 回复用户分支已创建，可以开始开发

**用户**: "这个功能要单独开分支吗"

**建议**:
- 如果是独立大功能，建议 `feature/{feature-name}`
- 如果是版本内普通更新，直接在 `v{x.y.z}-dev` 开发即可

## 注意事项

1. **不要**直接在 `release/v{x.y.z}` 上开发新功能
2. **不要**在 `main` 分支上直接提交
3. 开发分支命名必须包含版本号，如 `v0.0.2-dev`
4. 提交信息使用英文或简体中文，保持清晰简洁
5. 推送前确认没有敏感信息（密码、密钥等）
