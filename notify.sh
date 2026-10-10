#!/usr/bin/env bash
# notify.sh — 从 WSL 向 Windows 发送 toast 通知
# 用法: notify.sh [标题] [消息]
# 设计: hook 同步链路上运行，必须快速返回、失败静默，绝不阻塞 Claude Code

set -u
TITLE="${1:-Claude Code}"
MESSAGE="${2:-需要你的注意}"
LOG_FILE="${TMPDIR:-/tmp}/claude-notify.log"

# 标题/消息经环境变量传入 PowerShell，避免命令拼接导致的注入与转义问题
export NA_TITLE="$TITLE" NA_MESSAGE="$MESSAGE"

# 后台执行 + 超时保护：powershell.exe 首次调用可能较慢，不能阻塞 hook
(
  timeout 15 powershell.exe -NoProfile -NonInteractive -Command '
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
    $x = New-Object Windows.Data.Xml.Dom.XmlDocument
    $title = [System.Security.SecurityElement]::Escape($env:NA_TITLE)
    $msg   = [System.Security.SecurityElement]::Escape($env:NA_MESSAGE)
    $x.LoadXml("<toast><visual><binding template=""ToastText02""><text id=""1"">$title</text><text id=""2"">$msg</text></binding></visual></toast>")
    $t = New-Object Windows.UI.Notifications.ToastNotification $x
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("ClaudeCode.NotifyAssistant").Show($t)
  ' 2>>"$LOG_FILE"
) >/dev/null 2>&1 &

# 立即返回，不等待 powershell 结果
exit 0
