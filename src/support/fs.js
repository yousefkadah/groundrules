'use strict';

const fs = require('fs');
const path = require('path');

const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const read = (p) => fs.readFileSync(p, 'utf8');
const readJsonSafe = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

/**
 * Write atomically, and refuse to follow a symlink at the target — a repo must
 * not be able to redirect a generated file to overwrite something outside it.
 */
const write = (p, s) => {
  ensureDir(path.dirname(p));
  try {
    if (fs.lstatSync(p).isSymbolicLink()) throw new Error(`refusing to write through a symlink: ${p}`);
  } catch (e) { if (e && e.code !== 'ENOENT') throw e; }
  const tmp = `${p}.gr-tmp-${process.pid}`;
  fs.writeFileSync(tmp, s);
  fs.renameSync(tmp, p);
};

// Sorted for deterministic, cross-platform ordering.
const listDirs = (p) => {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); }
  catch { return []; }
};
const listFiles = (p) => { try { return fs.readdirSync(p).sort(); } catch { return []; } };

/** Copy a directory of regular files, skipping symlinks and special files. */
const copyDir = (src, dst) => {
  ensureDir(dst);
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    const s = path.join(src, e.name); const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (e.isFile()) write(d, read(s));
  }
};

module.exports = { exists, read, readJsonSafe, ensureDir, write, listDirs, listFiles, copyDir };
