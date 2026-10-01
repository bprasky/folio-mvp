// Dedicated Node entry: satisfy Next's build-time server marker without the
// React 18-incompatible react-server runtime condition.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {};
  return originalLoad.call(this, request, parent, isMain);
};
require('tsx/cjs');
require('./live-interview-cleanup.ts');
