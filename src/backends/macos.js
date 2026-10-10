'use strict';

const { spawnSync } = require('child_process');

const SCRIPT = [
  'on run argv',
  '  display notification (item 2 of argv) with title (item 1 of argv)',
  'end run',
];

/**
 * 标题/正文作为 osascript 的参数传入（不走 shell），脚本里用 argv 取用，
 * 因此内容里带引号、换行也安全。
 */
function send({ title, body }) {
  const result = spawnSync('osascript', [...SCRIPT.flatMap((s) => ['-e', s]), '--', title, body], {
    encoding: 'utf8',
    timeout: 10000,
  });

  if (result.error) return { ok: false, error: result.error.message };
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || '').trim() || `osascript 退出码 ${result.status}` };
  }
  return { ok: true };
}

module.exports = { send };
