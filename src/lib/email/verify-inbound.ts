import { Webhook } from 'svix';

export class InboundVerificationError extends Error {
  constructor(public readonly status: 400 | 503) {
    super(status === 503 ? 'Webhook unavailable' : 'Invalid webhook');
  }
}

/** Verify the exact bytes before parsing or dispatching any event, including test events. */
export function verifyInbound(raw: string, headers: Headers, secret = process.env.RESEND_WEBHOOK_SECRET): unknown {
  if (!secret) throw new InboundVerificationError(503);
  let verifier: Webhook;
  try { verifier = new Webhook(secret); }
  catch { throw new InboundVerificationError(503); }
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signature = headers.get('svix-signature');
  if (!id || !timestamp || !signature) throw new InboundVerificationError(400);
  try {
    return verifier.verify(raw, { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signature });
  } catch { throw new InboundVerificationError(400); }
}
