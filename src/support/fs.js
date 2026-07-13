'use strict';

const fs = require('fs');
const path = require('path');

const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const read = (p) => fs.readFileSync(p, 'utf8');
const readJsonSafe = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const write = (p, s) => { ensureDir(path.dirname(p)); fs.writeFileSync(p, s); };
const listDirs = (p) => {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch { return []; }
};
const listFiles = (p) => { try { return fs.readdirSync(p); } catch { return []; } };
const copyDir = (src, dst) => {
  ensureDir(dst);
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name); const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else write(d, read(s));
  }
};

module.exports = { exists, read, readJsonSafe, ensureDir, write, listDirs, listFiles, copyDir };
