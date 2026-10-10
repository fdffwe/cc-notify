'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { AUMID, DISPLAY_NAME } = require('../constants');

const APP_DIR_NAME = 'ClaudeCode';
const SHORTCUT_NAME = 'Claude Code.lnk';

const REG_APPID = `HKCU\\SOFTWARE\\Classes\\AppUserModelId\\${AUMID}`;
const REG_THROTTLE = `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings\\${AUMID}`;

function isWsl() {
  try {
    return /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8'));
  } catch {
    return false;
  }
}

function isWindowsHost() {
  return process.platform === 'win32' || isWsl();
}

function run(exe, args) {
  return spawnSync(exe, args, { encoding: 'utf8', timeout: 20000 });
}

function runPs(script) {
  const tmp = path.join(os.tmpdir(), `cc-notify-${process.pid}.ps1`);
  fs.writeFileSync(tmp, script, 'utf8');
  try {
    const file = isWsl() ? toWindowsPath(tmp) : tmp;
    return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file]);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* 清理失败无所谓 */
    }
  }
}

/** WSL 路径 → Windows 路径 */
function toWindowsPath(linuxPath) {
  if (process.platform === 'win32') return linuxPath;
  const result = run('wslpath', ['-w', linuxPath]);
  if (result.status !== 0) throw new Error(`wslpath 失败: ${(result.stderr || '').trim()}`);
  return result.stdout.trim();
}

/** C:\Users\x\... → /mnt/c/Users/x/... */
function toLinuxPath(windowsPath) {
  if (process.platform !== 'win32' && !isWsl()) return windowsPath;
  const match = /^([A-Za-z]):\\(.*)$/.exec(windowsPath);
  if (!match) return windowsPath;
  return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, '/')}`;
}

function localAppData() {
  const result = run('powershell.exe', ['-NoProfile', '-Command', '$env:LOCALAPPDATA']);
  const value = (result.stdout || '').trim();
  if (!value) throw new Error('无法读取 Windows 的 LOCALAPPDATA');
  return value;
}

function startMenuDir() {
  const result = run('powershell.exe', ['-NoProfile', '-Command', '[Environment]::GetFolderPath("Programs")']);
  const value = (result.stdout || '').trim();
  if (!value) throw new Error('无法读取 Windows 的开始菜单目录');
  return value;
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** 给 .lnk 打上 AppUserModelID —— WScript.Shell 不支持，必须走 IPropertyStore */
const AUMID_SETTER_CS = `
$code = @'
using System;
using System.Runtime.InteropServices;
public static class AumidSetter
{
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct PropertyKey { public Guid fmtid; public uint pid; }
    [StructLayout(LayoutKind.Explicit)]
    public struct PropVariant {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr p;
    }
    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    interface IPropertyStore {
        uint GetCount();
        PropertyKey GetAt(uint iProp);
        void GetValue(ref PropertyKey key, out PropVariant pv);
        void SetValue(ref PropertyKey key, ref PropVariant pv);
        void Commit();
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    static extern IPropertyStore SHGetPropertyStoreFromParsingName(
        [MarshalAs(UnmanagedType.LPWStr)] string pszPath, IntPtr pbc, uint flags, ref Guid riid);
    public static void Set(string lnkPath, string aumid)
    {
        Guid iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
        IPropertyStore store = SHGetPropertyStoreFromParsingName(lnkPath, IntPtr.Zero, 2, ref iid);
        PropertyKey pk = new PropertyKey();
        pk.fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
        pk.pid = 5;
        PropVariant pv = new PropVariant();
        pv.vt = 31;
        pv.p = Marshal.StringToHGlobalUni(aumid);
        store.SetValue(ref pk, ref pv);
        store.Commit();
        Marshal.FreeHGlobal(pv.p);
    }
}
'@
Add-Type -TypeDefinition $code -Language CSharp
`;

function shortcutScript({ lnkPath, icoPath, target, args }) {
  return `$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut(${psQuote(lnkPath)})
$s.TargetPath = ${psQuote(target)}
$s.Arguments = ${psQuote(args)}
$s.Description = 'Claude Code 通知'
$s.IconLocation = ${psQuote(`${icoPath},0`)}
$s.Save()
${AUMID_SETTER_CS}
[AumidSetter]::Set(${psQuote(lnkPath)}, ${psQuote(AUMID)})
`;
}

function reg(args) {
  return run('reg.exe', args);
}

function regAdd(key, name, value) {
  return reg(['add', key, '/v', name, '/t', 'REG_SZ', '/d', value, '/f']);
}

function regValue(key, name) {
  const result = reg(['query', key, '/v', name]);
  if (result.status !== 0) return null;
  const match = new RegExp(`${name}\\s+REG_SZ\\s+(.+)`).exec(result.stdout || '');
  return match ? match[1].trim() : null;
}

function install({ iconPng, iconIco, nodePath, cliPath, iconOverride }) {
  const messages = [];
  try {
    const appDir = `${localAppData()}\\${APP_DIR_NAME}`;
    const appDirLinux = toLinuxPath(appDir);
    fs.mkdirSync(appDirLinux, { recursive: true });

    const pngSource = iconOverride || iconPng;
    const pngDest = `${appDir}\\icon.png`;
    const icoDest = `${appDir}\\icon.ico`;
    fs.copyFileSync(pngSource, toLinuxPath(pngDest));
    fs.copyFileSync(iconIco, toLinuxPath(icoDest));
    messages.push(`✓ 图标已安装到 ${appDir}`);

    regAdd(REG_APPID, 'DisplayName', DISPLAY_NAME);
    regAdd(REG_APPID, 'IconUri', pngDest);
    messages.push(`✓ 已注册 AppId 显示名与图标`);

    const lnkPath = `${startMenuDir()}\\${SHORTCUT_NAME}`;
    const isWslHost = isWsl();
    const target = isWslHost ? 'C:\\Windows\\System32\\wsl.exe' : nodePath;
    const args = isWslHost
      ? `-e "${nodePath}" "${cliPath}" test`
      : `"${cliPath}" test`;
    const psResult = runPs(shortcutScript({ lnkPath, icoPath: icoDest, target, args }));
    if (psResult.status !== 0) {
      messages.push(`! 快捷方式创建失败: ${(psResult.stderr || '').trim()}`);
      return { ok: false, messages };
    }
    messages.push('✓ 已创建开始菜单快捷方式并绑定 AppUserModelID');
    return { ok: true, messages };
  } catch (err) {
    messages.push(`! ${err.message}`);
    return { ok: false, messages };
  }
}

function uninstall() {
  const messages = [];
  try {
    const lnkPath = `${startMenuDir()}\\${SHORTCUT_NAME}`;
    const lnkLinux = toLinuxPath(lnkPath);
    if (fs.existsSync(lnkLinux)) {
      fs.unlinkSync(lnkLinux);
      messages.push('✓ 已删除开始菜单快捷方式');
    } else {
      messages.push('· 开始菜单快捷方式不存在');
    }

    const appIdDel = reg(['delete', REG_APPID, '/f']);
    messages.push(appIdDel.status === 0 ? '✓ 已删除 AppId 注册' : '· AppId 注册不存在');

    const throttleDel = reg(['delete', REG_THROTTLE, '/f']);
    messages.push(throttleDel.status === 0 ? '✓ 已删除通知节流计数' : '· 通知节流计数不存在');
    return { ok: true, messages };
  } catch (err) {
    messages.push(`! ${err.message}`);
    return { ok: false, messages };
  }
}

function status() {
  const messages = [];
  try {
    const displayName = regValue(REG_APPID, 'DisplayName');
    messages.push(displayName ? `✓ AppId 显示名: ${displayName}` : '· AppId 未注册');
    const iconUri = regValue(REG_APPID, 'IconUri');
    messages.push(iconUri ? `✓ 图标: ${iconUri}` : '· 图标未设置');

    const lnkPath = `${startMenuDir()}\\${SHORTCUT_NAME}`;
    messages.push(fs.existsSync(toLinuxPath(lnkPath)) ? '✓ 开始菜单快捷方式存在' : '· 开始菜单快捷方式不存在');
    return { ok: true, messages };
  } catch (err) {
    messages.push(`! ${err.message}`);
    return { ok: false, messages };
  }
}

module.exports = {
  install,
  uninstall,
  status,
  isWindowsHost,
};
