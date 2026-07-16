'use strict';

const path = require('path');
const { exists, read, readJsonSafe } = require('../support/fs');

/**
 * Classify what KIND of project this is, so composition can drop rules that
 * don't apply. A CLI or library has no tenants, migrations, request
 * authorization, uploads, queues, or deploys — shipping those rules is noise
 * that dilutes the ones that matter.
 *
 * FAIL-SAFE: anything we can't classify is `unknown`, which keeps ALL content.
 * Never strip security rules from a web app we merely failed to recognize.
 *
 * Manifests that are JSON are parsed (not substring-matched) so the Rust port
 * decides identically; the rest use plain `includes` on the raw text.
 */

const WEB_FILES = ['artisan', 'manage.py', 'bin/rails', 'config/application.rb'];
const WEB_NODE = ['next', 'nuxt', 'express', '@nestjs/core', 'koa', 'fastify', 'astro', '@sveltejs/kit', '@remix-run/node', 'hapi', '@hapi/hapi'];
const WEB_PY = ['django', 'fastapi', 'flask', 'starlette', 'tornado', 'sanic'];
const WEB_GO = ['gin-gonic/gin', 'labstack/echo', 'gofiber/fiber', 'go-chi/chi', 'gorilla/mux'];
const WEB_RUST = ['axum', 'actix-web', 'rocket', 'warp', 'tide'];

const nodeDeps = (pkg) => [
  ...Object.keys((pkg && pkg.dependencies) || {}),
  ...Object.keys((pkg && pkg.devDependencies) || {}),
];
const composerDeps = (c) => [
  ...Object.keys((c && c.require) || {}),
  ...Object.keys((c && c['require-dev']) || {}),
];

/** @returns {'web-app'|'cli'|'library'|'unknown'} */
function detectArchetype(cwd) {
  const at = (f) => path.join(cwd, f);
  const has = (f) => exists(at(f));
  const readIf = (f) => (has(f) ? read(at(f)) : '');

  const pkg = readJsonSafe(at('package.json'));
  const composer = readJsonSafe(at('composer.json'));
  const cargo = readIf('Cargo.toml');
  const gomod = readIf('go.mod');
  const pyproject = readIf('pyproject.toml');

  // 1) Serves HTTP → the web rules apply. Strongest signal, checked first.
  if (WEB_FILES.some(has)) return 'web-app';
  if (composerDeps(composer).some((d) => d.startsWith('laravel/') || d.startsWith('symfony/') || d === 'slim/slim')) return 'web-app';
  if (nodeDeps(pkg).some((d) => WEB_NODE.includes(d))) return 'web-app';
  const pyText = (pyproject + readIf('requirements.txt')).toLowerCase();
  if (WEB_PY.some((n) => pyText.includes(n))) return 'web-app';
  if (WEB_GO.some((n) => gomod.includes(n))) return 'web-app';
  if (readIf('Gemfile').includes('rails')) return 'web-app';
  if (WEB_RUST.some((n) => cargo.includes(n))) return 'web-app';

  // 2) Ships an executable → CLI.
  if (pkg && pkg.bin) return 'cli';
  if (pyproject.includes('[project.scripts]') || readIf('setup.py').includes('console_scripts')) return 'cli';
  if (cargo.includes('[[bin]]') || has('src/main.rs')) return 'cli';
  if (gomod && (gomod.includes('spf13/cobra') || gomod.includes('urfave/cli') || has('cmd'))) return 'cli';

  // 3) A published package with no executable and no web surface → library.
  if (cargo && has('src/lib.rs')) return 'library';
  if (pkg && (pkg.exports || pkg.main)) return 'library';
  if (pyproject.includes('[project]')) return 'library';

  return 'unknown';
}

module.exports = { detectArchetype };
