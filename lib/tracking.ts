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

export function prepareTrackedHtml(html: string | undefined, emailId: string) {
  if (!html) return undefined;
  let out = injectOpenPixel(html, emailId);
  out = injectClickTracking(out, emailId);
  return out;
}

export const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);
