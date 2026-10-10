'use strict';

const os = require('os');
const path = require('path');

const settings = require('./settings');
const notify = require('./notify');
const hook = require('./hook');

const CLI_PATH = path.resolve(__dirname, '..', 'bin', 'cc-notify.js');
const ASSETS = path.resolve(__dirname, '..', 'assets');

/** 事件名 → Claude Code hook 事件名 */
const EVENT_TO_HOOK = {
  permission: 'PermissionRequest',
  stop: 'Stop',
};

function scopeFile(scope) {
  if (scope === 'user') return path.join(os.homedir(), '.claude', 'settings.json');
  if (scope === 'project') return path.join(process.cwd(), '.claude', 'settings.json');
  throw new Error(`未知 scope: ${scope}（可选 user / project）`);
}

/**
 * 用绝对路径调用 CLI，避免 hook 执行环境 PATH 不全。
 * 文本内容不经命令行传递，全部走 stdin JSON，杜绝注入。
 */
function hookCommand(event) {
  return `"${process.execPath}" "${CLI_PATH}" hook --event ${event}`;
}

function parseFlags(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function windowsModule() {
  return require('./windows/register');
}

function parseEvents(raw) {
  const list = String(raw || 'permission,stop')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const event of list) {
    if (!EVENT_TO_HOOK[event]) {
      throw new Error(`未知事件: ${event}（可选 ${Object.keys(EVENT_TO_HOOK).join(' / ')}）`);
    }
  }
  if (!list.length) throw new Error('至少要选一个事件');
  return list;
}

function cmdInstall(flags) {
  const scope = flags.scope || 'user';
  const events = parseEvents(flags.events);
  const file = scopeFile(scope);

  const data = settings.read(file);
  for (const event of events) {
    settings.addHook(data, EVENT_TO_HOOK[event], hookCommand(event));
  }
  settings.write(file, data);
  console.log(`✓ 已写入 hooks: ${file}`);
  for (const event of events) {
    console.log(`  - ${EVENT_TO_HOOK[event]}  →  ${event}`);
  }

  const register = windowsModule();
  if (register.isWindowsHost()) {
    const result = register.install({
      iconPng: path.join(ASSETS, 'icon.png'),
      iconIco: path.join(ASSETS, 'icon.ico'),
      nodePath: process.execPath,
      cliPath: CLI_PATH,
      iconOverride: typeof flags.icon === 'string' ? flags.icon : null,
    });
    for (const line of result.messages) console.log(`  ${line}`);
    if (!result.ok) console.log('  ! Windows 侧注册未完全成功，通知仍可用但显示名/图标可能不生效');
  }

  console.log('\n下一步：打开一次 /hooks 让 Claude Code 重新加载配置。');
  return 0;
}

function cmdUninstall(flags) {
  const scope = flags.scope || 'user';
  const file = scopeFile(scope);

  const data = settings.read(file);
  const removed = settings.removeHooks(data);
  if (removed) settings.write(file, data);
  console.log(removed ? `✓ 已从 ${file} 移除 hooks` : `· ${file} 中没有本工具的 hooks`);

  const register = windowsModule();
  if (register.isWindowsHost()) {
    const result = register.uninstall();
    for (const line of result.messages) console.log(`  ${line}`);
  }
  return 0;
}

function cmdStatus(flags) {
  const scopes = flags.scope ? [flags.scope] : ['user', 'project'];
  for (const scope of scopes) {
    let file;
    try {
      file = scopeFile(scope);
    } catch {
      continue;
    }
    const data = settings.read(file);
    const events = settings.listHookEvents(data);
    const label = scope === 'user' ? '用户级' : '项目级';
    console.log(`${label}: ${file}`);
    console.log(events.length ? `  已注册事件: ${events.join(', ')}` : '  （未注册）');
  }

  const register = windowsModule();
  if (register.isWindowsHost()) {
    console.log('\nWindows 侧:');
    for (const line of register.status().messages) console.log(`  ${line}`);
  } else {
    console.log(`\n通知后端: ${notify.currentKind()}`);
  }
  return 0;
}

function cmdTest() {
  const result = notify.send({ title: 'Claude Code', body: '测试通知' });
  if (result.ok) {
    console.log(`✓ 已通过 ${result.kind} 发送测试通知`);
    return 0;
  }
  console.error(`✗ 发送失败（${result.kind}）: ${result.error}`);
  return 1;
}

function cmdSend(flags) {
  const title = typeof flags.title === 'string' ? flags.title : 'Claude Code';
  const body = typeof flags.body === 'string' ? flags.body : '通知';
  const result = notify.send({ title, body });
  if (!result.ok) {
    console.error(`发送失败（${result.kind}）: ${result.error}`);
    return 1;
  }
  return 0;
}

async function cmdHook(flags) {
  const event = typeof flags.event === 'string' ? flags.event : '';
  if (!EVENT_TO_HOOK[event]) throw new Error(`hook 需要一个 --event，可选 ${Object.keys(EVENT_TO_HOOK).join(' / ')}`);
  await hook.run({ event });
  return 0;
}

const USAGE = `cc-notify — Claude Code 跨平台桌面通知

用法:
  cc-notify install   [--scope user|project] [--events permission,stop] [--icon <png>]
  cc-notify uninstall [--scope user|project]
  cc-notify status
  cc-notify test
  cc-notify send --title <标题> --body <内容>
  cc-notify hook --event permission|stop   （读 stdin JSON，供 hook 调用）
`;

async function main(argv) {
  const [command, ...rest] = argv;
  const flags = parseFlags(rest);

  switch (command) {
    case 'install':
      return cmdInstall(flags);
    case 'uninstall':
      return cmdUninstall(flags);
    case 'status':
      return cmdStatus(flags);
    case 'test':
      return cmdTest();
    case 'send':
      return cmdSend(flags);
    case 'hook':
      return cmdHook(flags);
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(USAGE);
      return 0;
    default:
      throw new Error(`未知命令: ${command}\n\n${USAGE}`);
  }
}

module.exports = { main };
