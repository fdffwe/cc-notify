'use strict';

const { spawnSync } = require('child_process');

const { AUMID } = require('../constants');

/**
 * 标题/正文经环境变量传入 PowerShell，不经命令行拼接 —— 避免注入。
 * PowerShell 侧再用 SecurityElement.Escape 转义 XML 特殊字符。
 */
const PS_SCRIPT = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$x = New-Object Windows.Data.Xml.Dom.XmlDocument
$title = [System.Security.SecurityElement]::Escape($env:CLAUDE_NOTIFY_TITLE)
$body  = [System.Security.SecurityElement]::Escape($env:CLAUDE_NOTIFY_BODY)
$x.LoadXml("<toast><visual><binding template=""ToastText02""><text id=""1"">$title</text><text id=""2"">$body</text></binding></visual></toast>")
$t = New-Object Windows.UI.Notifications.ToastNotification $x
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("${AUMID}").Show($t)
`;

function send({ title, body }) {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT],
    {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, CLAUDE_NOTIFY_TITLE: title, CLAUDE_NOTIFY_BODY: body },
    }
  );

  if (result.error) {
    return { ok: false, error: `${result.error.message}（WSL 下需要在 Windows 上开启互操作）` };
  }
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || '').trim() || `powershell 退出码 ${result.status}` };
  }
  return { ok: true };
}

module.exports = { send };
