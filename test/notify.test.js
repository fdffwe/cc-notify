'use strict';

const test = require('node:test');
const assert = require('node:assert');
const notify = require('../src/notify');

test('原生 Windows 走 toast 后端', () => {
  assert.strictEqual(notify.detectKind({ platform: 'win32', procVersion: '' }), 'win-toast');
});

test('macOS 走 osascript 后端', () => {
  assert.strictEqual(notify.detectKind({ platform: 'darwin', procVersion: '' }), 'macos');
});

test('WSL 里的 Linux 走 toast 后端', () => {
  const procVersion = 'Linux version 6.6.87.2-microsoft-standard-WSL2';
  assert.strictEqual(notify.detectKind({ platform: 'linux', procVersion }), 'win-toast');
});

test('普通 Linux 走 notify-send 后端', () => {
  const procVersion = 'Linux version 6.6.0-generic (buildd@lcy02)';
  assert.strictEqual(notify.detectKind({ platform: 'linux', procVersion }), 'linux');
});

test('isWsl 能识别 WSL 内核标识', () => {
  assert.strictEqual(notify.isWsl('Linux version 5.15.90.1-microsoft-standard-WSL2'), true);
  assert.strictEqual(notify.isWsl('Linux version 6.6.0-generic'), false);
});

test('每个后端都导出 send', () => {
  for (const kind of notify.KINDS) {
    const backend = require(`../src/backends/${kind}`);
    assert.strictEqual(typeof backend.send, 'function', `${kind} 缺少 send`);
  }
});
