#!/usr/bin/env node
'use strict';

const { Cli } = require('../src/cli/Cli');

new Cli().run(process.argv.slice(2));
