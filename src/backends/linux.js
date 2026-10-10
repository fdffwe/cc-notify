'use strict';

const { spawnSync } = require('child_process');

const APP_NAME = 'Claude Code';

/**
 * 依赖 libnotify 的 notify-send。标题/正文作为独立 argv 传入，不经 shell。
 * 未安装时返回可读的错误，由 CLI 打印，不影响 Claude Code 主流程。
 */
function send({ title, body }) {
  const result = spawnSync('notify-send', [`--app-name=${APP_NAME}`, title, body], {
    encoding: 'utf8',
    timeout: 10000,
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      return { ok: false, error: '未找到 notify-send，请先安装 libnotify-bin（Debian/Ubuntu）或 libnotify（Fedora/Arch）' };
    }
    return { ok: false, error: result.error.message };
  }
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || '').trim() || `notify-send 退出码 ${result.status}` };
  }
  return { ok: true };
}

module.exports = { send };
