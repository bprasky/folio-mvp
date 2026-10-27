// Test-process preload only. Never imported by the application. No provider,
// email or other external request can leave this connected acceptance fixture.
function check(value) {
  const url = value instanceof URL ? value : new URL(typeof value === 'string' ? value : value.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error(`Rollout fixture blocked external request to ${url.hostname}`);
}
const fetch = global.fetch;
global.fetch = (input, init) => { check(input); return fetch(input, init); };
for (const scheme of ['http', 'https']) {
  const module = require('node:' + scheme);
  for (const name of ['request', 'get']) {
    const original = module[name];
    module[name] = function(input, ...args) {
      if (typeof input === 'string' || input instanceof URL) check(input);
      else check(`${scheme}://${input.hostname || input.host || 'localhost'}`);
      return original.call(this, input, ...args);
    };
  }
}
