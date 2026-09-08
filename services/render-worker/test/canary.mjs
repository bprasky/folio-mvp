import http from 'node:http';
import dgram from 'node:dgram';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function startCanary({ host = '0.0.0.0', ports = [80, 443], udpPort = 3478, onHit = () => {} } = {}) {
  const servers = []; let udp;
  try {
    for (const port of ports) {
      const server = http.createServer((_req, res) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.end('canary'); });
      server.on('connection', () => onHit('tcp'));
      server.on('upgrade', (req, socket) => {
        const accept = createHash('sha1').update(String(req.headers['sec-websocket-key']) + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
        socket.end(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      });
      servers.push(server);
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
    }
    udp = dgram.createSocket('udp4'); udp.on('message', () => onHit('udp'));
    await new Promise((resolve, reject) => { udp.once('error', reject); udp.bind(udpPort, host, resolve); });
    return { ports: servers.map(s => s.address().port), close: async () => {
      udp.close();
      await Promise.all(servers.map(s => { s.closeAllConnections(); return new Promise(resolve => s.close(resolve)); }));
    } };
  } catch (error) { for (const s of servers) s.close(); try { udp?.close(); } catch {} throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startCanary({ onHit: () => process.stdout.write('hit\n') });
  process.stdout.write('ready\n');
}
