function baseLayout(content: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fdfbf8;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    ${content}
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e7e5e4;text-align:center;">
      <p style="font-size:12px;color:#a8a29e;margin:0;">Folio — Where design meets community</p>
    </div>
  </div>
</body>
</html>`;
}

export function thankYouEmailHtml(
  attendeeName: string,
  eventTitle: string,
  checkedInAt: string
) {
  const time = new Date(checkedInAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return baseLayout(`
    <h1 style="font-size:24px;color:#1c1917;margin:0 0 8px;">Thanks for joining us!</h1>
    <p style="font-size:16px;color:#44403c;line-height:1.6;margin:0 0 24px;">
      Hi ${attendeeName}, thank you for attending <strong>${eventTitle}</strong>.
      You checked in at ${time} — we're glad you made it.
    </p>
    <p style="font-size:16px;color:#44403c;line-height:1.6;margin:0 0 24px;">
      We hope you made great connections. Keep an eye on your Folio feed for event
      highlights and follow-ups from vendors you met.
    </p>
    <a href="https://folioad.com/events" style="display:inline-block;padding:12px 24px;background:#c8a97e;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">
      Browse Upcoming Events
    </a>
  `);
}

export function missedYouEmailHtml(
  attendeeName: string,
  eventTitle: string
) {
  return baseLayout(`
    <h1 style="font-size:24px;color:#1c1917;margin:0 0 8px;">We missed you!</h1>
    <p style="font-size:16px;color:#44403c;line-height:1.6;margin:0 0 24px;">
      Hi ${attendeeName}, we noticed you RSVP'd to <strong>${eventTitle}</strong>
      but weren't able to make it. No worries — we hope to see you at a future event.
    </p>
    <p style="font-size:16px;color:#44403c;line-height:1.6;margin:0 0 24px;">
      Check out what's coming up next on Folio.
    </p>
    <a href="https://folioad.com/events" style="display:inline-block;padding:12px 24px;background:#c8a97e;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">
      See Upcoming Events
    </a>
  `);
}

export function walkInFollowUpEmailHtml(
  attendeeName: string,
  eventTitle: string
) {
  return baseLayout(`
    <h1 style="font-size:24px;color:#1c1917;margin:0 0 8px;">Great meeting you!</h1>
    <p style="font-size:16px;color:#44403c;line-height:1.6;margin:0 0 24px;">
      Hi ${attendeeName}, thanks for stopping by <strong>${eventTitle}</strong> as a walk-in guest.
      We're glad you found us!
    </p>
    <p style="font-size:16px;color:#44403c;line-height:1.6;margin:0 0 24px;">
      Complete your Folio profile to stay connected with the designers and vendors
      you met, and get early access to future events.
    </p>
    <a href="https://folioad.com/onboarding" style="display:inline-block;padding:12px 24px;background:#c8a97e;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">
      Complete Your Profile
    </a>
  `);
}
