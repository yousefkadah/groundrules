'use strict';

const path = require('path');
const { readJsonSafe } = require('../support/fs');
const StackDetector = require('./StackDetector');

class VueDetector extends StackDetector {
  get id() { return 'vue'; }

  detect(cwd) {
    const pkg = readJsonSafe(path.join(cwd, 'package.json'));
    if (!pkg) return null;
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hasVue = !!deps.vue || !!deps['@inertiajs/vue3'] || !!deps['@vue/runtime-core'] || !!deps.nuxt;
    if (!hasVue) return null;
    return { signal: 'package.json:vue' + (deps['@inertiajs/vue3'] ? '+inertia' : '') };
  }
}

module.exports = VueDetector;
