'use strict';

const fs = require('fs');
const path = require('path');

const dir = path.resolve('logs');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `bot-${new Date().toISOString().slice(0, 10)}.log`);

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function fmt(v) {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.stack || v.message;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function write(level, args) {
  const line = `[${ts()}] [${level}] ${args.map(fmt).join(' ')}`;
  fs.appendFileSync(file, line + '\n');
  console.log(line);
}

module.exports = {
  info: (...args) => write('INFO', args),
  warn: (...args) => write('WARN', args),
  error: (...args) => write('ERR ', args),
  debug: (...args) => process.env.DEBUG ? write('DBG ', args) : undefined
};
