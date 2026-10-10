'use strict';

const config = require('./config');
const notify = require('./notify');

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      raw += chunk;
    });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', () => resolve(raw));
  });
}

/**
 * hook 入口：读 Claude Code 从 stdin 给的 JSON，渲染文案后发通知。
 * 任何异常都必须吞掉——hook 失败不该影响 Claude Code 主流程。
 */
async function run({ event, stdin } = {}) {
  try {
    const raw = stdin !== undefined ? stdin : await readStdin();
    let payload = {};
    try {
      payload = JSON.parse(raw || '{}');
    } catch {
      payload = {};
    }

    const cfg = config.load();
    const ev = cfg.events[event];
    if (!ev || !ev.enabled) return { ok: false, skipped: true };

    const vars = {
      tool: payload.tool_name || '未知操作',
      message: payload.message || '',
      cwd: payload.cwd || '',
      session: payload.session_id || '',
    };

    return notify.send({
      title: config.render(ev.title, vars),
      body: config.render(ev.body, vars),
    });
  } catch (err) {
    if (process.env.CLAUDE_NOTIFY_DEBUG) {
      process.stderr.write(`cc-notify hook: ${err.message}\n`);
    }
    return { ok: false, error: err.message };
  }
}

module.exports = { run };
