// ============================================================
// 重建 ChatGPT 快捷方式（Codex 中文界面启动器）
// 用途：Codex 升级后（exe 版本号变化），修改下方 ICON 里的版本号，
//       然后运行:  node 重建快捷方式.mjs
// 依赖：无需任何第三方库，直接 node 运行即可。
// ============================================================
import fs from 'node:fs';

// ---- 需要按版本维护的常量（Codex 升级后改这里）----
const ICON = 'C:\\Program Files\\WindowsApps\\OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0\\app\\ChatGPT.exe';
const CMD_FILE = 'C:\\Users\\mrpau\\codex-zh-fix\\start-codex-zh.cmd'; // 启动脚本位置（ASCII 路径）
const WORKDIR = 'C:\\Users\\mrpau\\codex-zh-fix';
const OUT = 'C:\\Users\\mrpau\\Desktop\\智能应用\\ChatGPT.lnk'; // 快捷方式输出位置

// ---- 以下为二进制模板（头部+IDList+LinkInfo，勿动）----
const PREFIX_B64 = [
  'TAAAAAEUAgAAAAAAwAAAAAAAAEb7AAAAIAAAAFXEkwkDWtcBlWHAGkqR2wFVxJMJA1rXAQAQBQAAAAAABwAAAAAAAAAAAAAAAAAA',
  'ADUBFAAfUOBP0CDqOmkQotgIACswMJ0ZAC9DOlwAAAAAAAAAAAAAAAAAAAAAAAAAVgAxAAAAAABmWhu7MABXaW5kb3dzAEAACQAE',
  'AO++xVItYGlazLouAAAAigQAAAAAAQAAAAAAAAAAAAAAAAAAAI1MAgBXAGkAbgBkAG8AdwBzAAAAFgBaADEAAAAAAGhaiwAwAFN5',
  'c3RlbTMyAABCAAkABADvvsVSLWBpWsy6LgAAAJoMAAAAAAEAAAAAAAAAAAAAAAAAAACxhacAUwB5AHMAdABlAG0AMwAyAAAAGABW',
  'ADIAABAFAMVSp2AgAGNtZC5leGUAQAAJAAQA777FUqdgaVrKui4AAABGmAAAAAABAAAAAACAAAAAAAAAAAAAq3QGAWMAbQBkAC4A',
  'ZQB4AGUAAAAWAAAATgAAABwAAAABAAAAHAAAADEAAAAAAAAATQAAABUAAAADAAAAaeTCHhAAAADPtc2zAEM6XFdpbmRvd3NcU3lz',
  'dGVtMzJcY21kLmV4ZQAA',
].join('');

const RELPATH = 'Windows\\System32\\cmd.exe';

// ---- 构建 ----
const prefix = Buffer.from(PREFIX_B64, 'base64');
const u16 = (v) => { const x = Buffer.alloc(2); x.writeUInt16LE(v & 0xFFFF); return x; };
const uniStr = (s) => Buffer.concat([u16([...s].length + 1), Buffer.from(s + '\0', 'utf16le')]);

const strings = Buffer.concat([
  uniStr(RELPATH),
  uniStr(WORKDIR),
  uniStr('/c "' + CMD_FILE + '"'),
  uniStr(ICON),
]);
fs.writeFileSync(OUT, Buffer.concat([prefix, strings]));
console.log('已重建快捷方式:', OUT);

// ---- 自检 ----
const t = fs.readFileSync(OUT);
console.log('自检: 图标路径=', t.includes(Buffer.from('ChatGPT.exe', 'utf16le')),
  '| 启动脚本=', t.includes(Buffer.from('start-codex-zh.cmd', 'utf16le')));
