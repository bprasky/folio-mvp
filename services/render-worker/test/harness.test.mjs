import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { fixtureResponse, dnsAnswer } from './public-fixture.mjs';
import { startCanary } from './canary.mjs';
import { attacks } from './cases.mjs';

test('public fixture emits every browser mechanism; missing fixture fails explicitly', () => {
  for (const attack of attacks.filter(a => !a.direct)) {
    const fixture = fixtureResponse(`/${attack.id}`, attack.target, 'https://fixture.example');
    if (attack.id === 'redirect') assert.equal(fixture.location, attack.target);
    else { assert.ok(fixture.body.includes(attack.id)); assert.ok(!fixture.status); }
  }
  assert.equal(fixtureResponse('/missing', '', '').status, 404);
  assert.ok(!fixtureResponse('/browser-required', '', '').body.includes('Acceptance Oak Chair'));
});
function query(name) {
  const header = Buffer.alloc(12); header.writeUInt16BE(1, 4);
  return Buffer.concat([header, ...name.split('.').map(s => Buffer.concat([Buffer.from([s.length]), Buffer.from(s)])), Buffer.from([0, 0, 1, 0, 1])]);
}
test('controlled DNS produces mixed answers and a public-to-private TTL-zero change', () => {
  const mixed = dnsAnswer(query('mixed.fixture.example'), '8.8.8.8', 'fixture.example', 1);
  assert.equal(mixed.readUInt16BE(6), 2);
  const early = dnsAnswer(query('rebind.fixture.example'), '8.8.8.8', 'fixture.example', 1);
  const late = dnsAnswer(query('rebind.fixture.example'), '8.8.8.8', 'fixture.example', 2);
  assert.deepEqual([...early.subarray(-4)], [8, 8, 8, 8]);
  assert.deepEqual([...late.subarray(-4)], [10, 66, 0, 1]);
  assert.equal(late.readUInt32BE(late.length - 10), 0);
});
test('canary counts TCP connection before HTTP and accepts a WebSocket upgrade', async () => {
  let hits = 0;
  const listener = await startCanary({ host: '127.0.0.1', ports: [0], udpPort: 0, onHit: () => hits++ });
  try {
    const data = await new Promise((resolve, reject) => {
      const socket = net.connect(listener.ports[0], '127.0.0.1'); let text = '';
      socket.on('connect', () => socket.write('GET / HTTP/1.1\r\nHost: fixture\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n'));
      socket.on('data', chunk => { text += chunk; }); socket.on('end', () => resolve(text)); socket.on('error', reject);
    });
    assert.equal(hits, 1); assert.match(data, /101 Switching Protocols/);
  } finally { await listener.close(); }
});
