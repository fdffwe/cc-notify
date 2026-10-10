# cc-notify

Claude Code 的跨平台桌面通知工具：需要你确认权限、或任务完成时，在系统上弹出通知。

支持 **WSL/Windows**（原生 toast）、**macOS**（通知中心）、**Linux**（notify-send）。零运行时依赖。

## 环境要求

- **Node.js ≥ 18**（`node -v` 检查）
- 平台：WSL/Windows、macOS、Linux
- 额外依赖：
  - **Linux**：`libnotify`，即 `notify-send` 命令 —— `sudo apt install libnotify-bin`（Debian/Ubuntu）
  - **WSL**：需开启与 Windows 的互操作（`powershell.exe` 可用），默认开启
  - **macOS**：无

## 从 GitHub 安装

### 1. 克隆仓库

```bash
git clone https://github.com/yuannn/cc-notify.git
cd cc-notify
```

### 2. 全局安装

零运行时依赖，**不需要先跑 `npm install`**，直接从当前目录全局安装：

```bash
npm install -g .
```

装完确认命令可用：

```bash
cc-notify --help
```

#### 如果提示 `EACCES`

说明全局目录 `/usr/local` 属于 root。改用用户级前缀（`~/.local/bin` 通常已在 PATH 里）：

```bash
npm install -g --prefix "$HOME/.local" .
```

若 `~/.local/bin` 不在 PATH，补一句：

```bash
export PATH="$HOME/.local/bin:$PATH"     # 建议写进 ~/.bashrc
```

（也可以 `npm config set prefix ~/.npm-global && export PATH="$HOME/.npm-global/bin:$PATH"`。）

#### 不想全局安装？

直接在克隆目录里跑脚本也行，hooks 会指向这个目录，**但别删或移动该目录**：

```bash
node bin/cc-notify.js install
```

### 3. 注册到 Claude Code

```bash
cc-notify install
```

默认写**用户级**配置（对所有项目生效），做两件事：

1. 把 hooks 写进 `~/.claude/settings.json`
2. 仅 WSL/Windows：注册通知显示名与图标、创建开始菜单快捷方式

只想在单个项目生效，用 `cc-notify install --scope project`（写入该目录的 `.claude/settings.json`）。

### 4. 重载 Claude Code 配置

**这一步不能省。** 打开一次 `/hooks`，让 Claude Code 重新加载配置——不重载，新写的 hooks 不会生效。

### 5. 验证

```bash
cc-notify status    # 查看已注册的事件与 Windows 侧状态
cc-notify test      # 弹一条测试通知
```

`test` 能弹出通知就说明后端正常。之后在 Claude Code 里触发一次需要确认权限的操作（如运行不在白名单里的命令），应当**即时**弹出通知。

### 更新

```bash
cd cc-notify
git pull
npm install -g .        # 或 npm install -g --prefix "$HOME/.local" .
```

## 卸载

分两步，**顺序不要颠倒**：

```bash
cc-notify uninstall          # 1. 移除 hooks / 快捷方式 / 注册表项
npm uninstall -g cc-notify    # 2. 再卸载 npm 包
```

`cc-notify uninstall` 只删本工具写入的条目（你自己写进 `settings.json` 的 hook 不动）：用户级 hooks、开始菜单快捷方式、Windows 注册表项（AppId 与通知节流计数）。若装的是项目级，卸载时加 `--scope project`。

> 别先跑第 2 步。如果 npm 包先被删，`settings.json` 里的 hooks 会变成指向失效路径的孤儿条目，通知静默失败，只能手动清理。

## 命令

```bash
cc-notify install   [--scope user|project] [--events permission,stop] [--icon <png>]
cc-notify uninstall [--scope user|project]
cc-notify status
cc-notify test
cc-notify send --title <标题> --body <内容>
```

## 触发的事件

| 事件 | Claude Code hook | 默认通知 |
|---|---|---|
| `permission` | `PermissionRequest` | 「Claude Code 需要确认」+ 工具名 |
| `stop` | `Stop` | 「Claude Code」+「任务完成」 |

> 用 `PermissionRequest` 而不是 `Notification`：后者在权限提示出现约 6 秒后才触发，前者是即时的。计划审批和 `AskUserQuestion` 也走 `PermissionRequest`。

## 配置

`~/.claude/cc-notify.json`：

```json
{
  "events": {
    "permission": { "enabled": true, "title": "Claude Code 需要确认", "body": "{{tool}}" },
    "stop":       { "enabled": true, "title": "Claude Code",        "body": "任务完成"  }
  }
}
```

`body` / `title` 支持模板变量：`{{tool}}`（工具名）、`{{message}}`、`{{cwd}}`、`{{session}}`。

## 已知行为

- **用户级 `settings.json` 可能被覆盖**：切换模型等操作会整体重写该文件。若发现通知失效，重新跑一次 `cc-notify install` 即可。
- **改完配置要重载**：编辑 hooks 后需打开一次 `/hooks`。
- **别连发大量测试通知**：Windows 会按 `通知数/交互数` 节流，横幅延迟数秒。`uninstall` 会清掉这个计数。
- **Linux 需装 libnotify**：`sudo apt install libnotify-bin`（Debian/Ubuntu）。
- macOS / Linux 后端已实现并有单测，但未在真机上验证过。

## 开发

```bash
npm test        # node:test，无外部依赖
```

## License

MIT
