// Next interprets `server-only` at build time. This entry is a dedicated Node
// worker (never bundled for browsers), so satisfy that marker without enabling
// React's unsupported `react-server` condition in this Next 14 / React 18 app.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {};
  return originalLoad.call(this, request, parent, isMain);
};
require('tsx/cjs');
require('./interview-media-worker.ts');
