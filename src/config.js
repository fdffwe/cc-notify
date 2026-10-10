'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULTS = {
  events: {
    permission: {
      enabled: true,
      title: 'Claude Code 需要确认',
      body: '{{tool}}',
    },
    stop: {
      enabled: true,
      title: 'Claude Code',
      body: '任务完成',
    },
  },
};

function configPath(home = os.homedir()) {
  return path.join(home, '.claude', 'cc-notify.json');
}

/** 用户配置与默认值做一层浅合并（按事件的字段级覆盖） */
function merge(userConfig) {
  const merged = { events: {} };
  for (const [event, def] of Object.entries(DEFAULTS.events)) {
    merged.events[event] = { ...def, ...((userConfig && userConfig.events) || {})[event] };
  }
  return merged;
}

function load(file = configPath()) {
  try {
    return merge(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (err) {
    if (err.code === 'ENOENT') return merge(null);
    throw new Error(`无法解析 ${file}: ${err.message}`);
  }
}

/** 把 {{key}} 替换成变量值；未知变量替换为空串 */
function render(template, vars) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] === undefined || vars[key] === null ? '' : String(vars[key])
  );
}

module.exports = { load, merge, render };
