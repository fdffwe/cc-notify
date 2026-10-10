'use strict';

const test = require('node:test');
const assert = require('node:assert');
const settings = require('../src/settings');

const OUR_CMD = '"/usr/bin/node" "/opt/cc-notify.js" hook --event permission';

function otherHook() {
  return { hooks: [{ type: 'command', command: 'echo someone-elses-hook' }] };
}

test('addHook 写入正确的事件与命令', () => {
  const data = settings.addHook({}, 'PermissionRequest', OUR_CMD);
  assert.ok(Array.isArray(data.hooks.PermissionRequest));
  const hook = data.hooks.PermissionRequest[0].hooks[0];
  assert.strictEqual(hook.command, OUR_CMD);
  assert.strictEqual(hook.type, 'command');
  assert.strictEqual(hook.async, true);
});

test('addHook 幂等：重复调用不产生重复条目', () => {
  let data = {};
  data = settings.addHook(data, 'PermissionRequest', OUR_CMD);
  data = settings.addHook(data, 'PermissionRequest', OUR_CMD);
  data = settings.addHook(data, 'PermissionRequest', OUR_CMD);
  assert.strictEqual(data.hooks.PermissionRequest.length, 1);
  assert.strictEqual(data.hooks.PermissionRequest[0].hooks.length, 1);
});

test('addHook 不影响别人写的 hook', () => {
  const data = { hooks: { PermissionRequest: [otherHook()] } };
  settings.addHook(data, 'PermissionRequest', OUR_CMD);
  const groups = data.hooks.PermissionRequest;
  assert.strictEqual(groups.length, 2);
  assert.strictEqual(groups[0].hooks[0].command, 'echo someone-elses-hook');
});

test('removeHooks 只删自己的，保留别人的', () => {
  const data = { hooks: { PermissionRequest: [otherHook()], Stop: [] } };
  settings.addHook(data, 'PermissionRequest', OUR_CMD);
  settings.addHook(data, 'Stop', OUR_CMD.replace('permission', 'stop'));

  const changed = settings.removeHooks(data);
  assert.strictEqual(changed, true);
  assert.strictEqual(data.hooks.PermissionRequest.length, 1);
  assert.strictEqual(data.hooks.PermissionRequest[0].hooks[0].command, 'echo someone-elses-hook');
  assert.strictEqual(data.hooks.Stop, undefined);
});

test('removeHooks 清空后删掉空的 hooks 字段', () => {
  const data = settings.addHook({}, 'Stop', OUR_CMD);
  settings.removeHooks(data);
  assert.strictEqual(data.hooks, undefined);
});

test('removeHooks 在无本工具 hook 时返回 false 且不改动', () => {
  const data = { hooks: { PermissionRequest: [otherHook()] } };
  assert.strictEqual(settings.removeHooks(data), false);
  assert.strictEqual(data.hooks.PermissionRequest.length, 1);
});

test('listHookEvents 只列出本工具注册的事件', () => {
  const data = { hooks: { PermissionRequest: [otherHook()] } };
  settings.addHook(data, 'Stop', OUR_CMD);
  assert.deepStrictEqual(settings.listHookEvents(data), ['Stop']);
});

test('read 对不存在的文件返回空对象', () => {
  assert.deepStrictEqual(settings.read('/nonexistent/path/settings.json'), {});
});
