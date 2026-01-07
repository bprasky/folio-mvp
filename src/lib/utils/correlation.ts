import crypto from 'crypto';

export function cid(prefix = 'post'): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}


