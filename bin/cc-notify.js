#!/usr/bin/env node
'use strict';

const { main } = require('../src/cli');

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`cc-notify: ${err.message}\n`);
  process.exit(1);
});

