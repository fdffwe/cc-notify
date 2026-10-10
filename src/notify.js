'use strict';

const fs = require('fs');

const KINDS = ['win-toast', 'macos', 'linux'];

function readProcVersion() {
  try {
    return fs.readFileSync('/proc/version', 'utf8');
  } catch {
    return '';
  }
}

function isWsl(procVersion) {
  const content = procVersion === undefined ? readProcVersion() : procVersion;
  return /microsoft/i.test(content || '');
}

/**
 * 选后端：Windows(WSL 或原生) 用 toast，macOS 用 osascript，其余按 Linux 处理。
 */
function detectKind({ platform = process.platform, procVersion } = {}) {
  if (platform === 'win32') return 'win-toast';
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return isWsl(procVersion) ? 'win-toast' : 'linux';
  return 'linux';
}

function backendFor(kind) {
  if (!KINDS.includes(kind)) throw new Error(`未知后端: ${kind}`);
  return require(`./backends/${kind}`);
}

function send({ title, body }) {
  const kind = detectKind();
  try {
    const result = backendFor(kind).send({ title, body });
    return { kind, ...result };
  } catch (err) {
    return { kind, ok: false, error: err.message };
  }
}

module.exports = { detectKind, isWsl, send, currentKind: detectKind, KINDS };
