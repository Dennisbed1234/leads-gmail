/** Public HTTPS base URL embedded in tracking pixels */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;
  if (explicit) {
    let u = explicit.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    return u;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/**
 * Inject open-tracking pixel (same idea as Resend open events).
 * Avoid display:none — many clients strip those images.
 */
export function injectOpenPixel(html: string, emailId: string): string {
  if (!html || !emailId) return html;
  if (html.includes('/api/track/open?id=')) return html;

  const base = getAppBaseUrl();
  const src = `${base}/api/track/open?id=${encodeURIComponent(emailId)}&t=${Date.now()}`;
  const pixel = `<img src="${src}" width="1" height="1" alt="" border="0" style="width:1px;height:1px;border:0;opacity:0;" />`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}\n</body>`);
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${pixel}\n</html>`);
  }
  return `${html}${pixel}`;
}

/** Rewrite http(s) links so clicks also count as engagement */
export function injectClickTracking(html: string, emailId: string): string {
  if (!html || !emailId) return html;
  const base = getAppBaseUrl();

  return html.replace(
    /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi,
    (_m, url: string) => {
      if (url.includes('/api/track/')) return `href="${url}"`;
      const tracked = `${base}/api/track/click?id=${encodeURIComponent(emailId)}&u=${encodeURIComponent(url)}`;
      return `href="${tracked}"`;
    }
  );
}

/** Footer unsubscribe link (unique per message id). */
export function injectUnsubscribeLink(html: string, emailId: string): string {
  if (!html || !emailId) return html;
  if (html.includes('/api/track/unsubscribe')) return html;

  const base = getAppBaseUrl();
  const href = `${base}/api/track/unsubscribe?id=${encodeURIComponent(emailId)}`;
  const block = `
<p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#6b7280;text-align:center;">
  If you no longer want these emails,
  <a href="${href}" style="color:#6b7280;text-decoration:underline;">unsubscribe</a>.
</p>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${block}\n</body>`);
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${block}\n</html>`);
  }
  return `${html}${block}`;
}

export function unsubscribeUrlFor(emailId: string): string {
  return `${getAppBaseUrl()}/api/track/unsubscribe?id=${encodeURIComponent(emailId)}`;
}

export function prepareTrackedHtml(html: string | undefined, emailId: string) {
  if (!html) return undefined;
  let out = injectOpenPixel(html, emailId);
  out = injectClickTracking(out, emailId);
  out = injectUnsubscribeLink(out, emailId);
  return out;
}

/** Classify SMTP errors into soft bounce / hard bounce / other. */
export function classifySmtpFailure(message: string): {
  bounceType: 'hard' | 'soft' | null;
  status: 'BOUNCED' | 'FAILED';
} {
  const m = String(message || '');
  if (
    /550|551|552|553|user unknown|mailbox unavailable|does not exist|no such user|invalid recipient|recipient rejected|address rejected/i.test(
      m
    )
  ) {
    return { bounceType: 'hard', status: 'BOUNCED' };
  }
  if (
    /421|450|451|452|try again|temporarily|greylist|rate limit|too many|deferred/i.test(
      m
    )
  ) {
    return { bounceType: 'soft', status: 'FAILED' };
  }
  return { bounceType: null, status: 'FAILED' };
}

export const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);
