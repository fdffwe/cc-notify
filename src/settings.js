'use strict';

const fs = require('fs');
const path = require('path');

/** 用于识别"是我们写进去的 hook"，卸载时只删自己的，不动别人的 */
const MARKER = 'cc-notify.js';

function read(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`无法解析 ${file}: ${err.message}`);
  }
}

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function isOurHook(hook) {
  return hook && typeof hook.command === 'string' && hook.command.includes(MARKER);
}

function isOurGroup(group) {
  return group && Array.isArray(group.hooks) && group.hooks.some(isOurHook);
}

/** 去掉某个事件下所有属于本工具的 hook（组内混装时只删自己那条） */
function stripOurHooks(groups) {
  return (groups || [])
    .map((group) => ({ ...group, hooks: (group.hooks || []).filter((h) => !isOurHook(h)) }))
    .filter((group) => group.hooks.length > 0);
}

/**
 * 幂等：重复调用不会产生重复条目 —— 先清掉旧的，再写一条新的。
 * 不影响同一事件下别人写的 hook。
 */
function addHook(data, event, command) {
  if (!data.hooks) data.hooks = {};
  const groups = stripOurHooks(data.hooks[event]);
  groups.push({
    hooks: [
      {
        type: 'command',
        command,
        timeout: 10,
        async: true,
        statusMessage: '发送桌面通知',
      },
    ],
  });
  data.hooks[event] = groups;
  return data;
}

/** 返回是否真的移除了东西 */
function removeHooks(data) {
  if (!data.hooks) return false;
  let changed = false;
  for (const event of Object.keys(data.hooks)) {
    if (!data.hooks[event].some(isOurGroup)) continue;
    const kept = stripOurHooks(data.hooks[event]);
    if (kept.length) {
      data.hooks[event] = kept;
    } else {
      delete data.hooks[event];
    }
    changed = true;
  }
  if (data.hooks && !Object.keys(data.hooks).length) delete data.hooks;
  return changed;
}

function listHookEvents(data) {
  if (!data.hooks) return [];
  return Object.keys(data.hooks).filter((event) => (data.hooks[event] || []).some(isOurGroup));
}

module.exports = { read, write, addHook, removeHooks, listHookEvents };
