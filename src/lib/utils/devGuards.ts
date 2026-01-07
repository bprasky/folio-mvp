export function isDev() {
  return process.env.NODE_ENV !== 'production';
}

export function ensureDev() {
  if (!isDev()) {
    const err: any = new Error('Not available in production');
    err.status = 404;
    throw err;
  }
}

export function redacted(val?: string) {
  if (!val) return 'unset';
  return val.length <= 6 ? 'set' : `${val.slice(0, 3)}…${val.slice(-2)}`;
}


