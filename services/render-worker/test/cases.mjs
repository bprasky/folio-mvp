export const attacks = [
  { id: 'loopback', target: 'http://127.0.0.1/', direct: true },
  { id: 'unspecified', target: 'http://0.0.0.0/', direct: true },
  { id: 'rfc1918', target: 'http://10.66.0.1/', direct: true },
  { id: 'link_local', target: 'http://169.254.10.1/', direct: true },
  { id: 'metadata', target: 'http://169.254.169.254/', direct: true },
  { id: 'ipv6_loopback', target: 'http://[::1]/', direct: true, ipv6: true },
  { id: 'ipv6_private', target: 'http://[fd00::1]/', direct: true, ipv6: true },
  { id: 'ipv6_link_local', target: 'http://[fe80::1]/', direct: true, ipv6: true },
  ...['redirect', 'mixed_dns', 'rebind_dns', 'img', 'script', 'css_font', 'fetch_xhr', 'iframe', 'websocket', 'worker', 'service_worker', 'prefetch_preconnect', 'beacon', 'webrtc'].map(id => ({ id, target: 'http://10.66.0.1/' })),
];
export const parityCases = ['static', 'hydrated', 'redirect-product', 'browser-required'];
