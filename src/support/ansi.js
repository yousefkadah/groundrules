'use strict';

/** Minimal ANSI colour helpers (no dependency). */
const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', magenta: '\x1b[35m',
};

const paint = (colour, text) => `${C[colour] || ''}${text}${C.reset}`;

module.exports = { C, paint };
