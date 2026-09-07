# BOA / BIG OLD ALPS — Email deliverability

Code headers help a little. **DNS authentication decides most spam scores.**

## Why Mail-Tester scores low

Typical failures:

1. **No SPF / DKIM / DMARC** on the From domain  
2. **From domain ≠ SMTP domain** (e.g. From `boa@company.com` but sending via Gmail)  
3. Free **Gmail** SMTP for cold outreach (weak reputation)  
4. Spammy content (ALL CAPS, “CLICK NOW”, only images, no plain text)  
5. Sending **too many too fast** from a new domain

## Fix checklist (do in order)

### 1. Use your company domain as From

```
SMTP_FROM=boa@yourdomain.com
SMTP_FROM_NAME=BOA
SMTP_USER=… (account on that domain’s SMTP)
SMTP_HOST=… (your host / Workspace / Microsoft 365 / ESP)
```

Do **not** put `BOA` as the email local-part only in the display name while From is still `@gmail.com` if you want company reputation — align them.

### 2. DNS records (at your domain registrar)

| Record | Name | Value (examples) |
|--------|------|------------------|
| SPF | `@` | `v=spf1 include:_spf.google.com ~all` (or your provider’s include) |
| DKIM | `selector._domainkey` | Public key from Google Workspace / host / ESP |
| DMARC | `_dmarc` | `v=DMARC1; p=none; rua=mailto:you@yourdomain.com` |

Start DMARC with `p=none`, then move to `quarantine` once reports look clean.

### 3. Test

1. Open [mail-tester.com](https://www.mail-tester.com)  
2. Copy their unique address  
3. Send one campaign email **to that address** from this app  
4. Aim for **9/10 or 10/10**

Also check: MXToolbox blacklist, Google Postmaster Tools (after volume).

### 4. Content rules in Campaigns

- Fill **both** HTML and plain text  
- Personalize with `{{name}}`  
- Avoid ALL CAPS subjects, “FREE!!!”, many links  
- Include a real reply path (Reply-To = real inbox)

### 5. Volume

- Week 1: **10–20/day**  
- Then ramp slowly  
- Gmail free accounts are not built for bulk outreach

## What this app already does

- Display name **BOA**  
- Multipart text + HTML  
- Message-ID, Date, UTF-8  
- List-Unsubscribe (if `SMTP_UNSUBSCRIBE_URL` set)  
- Envelope From alignment option (`SMTP_ENVELOPE_FROM`)  
- Paced sends (default ~5s + jitter)  
- Subject soft-sanitization  

Without SPF/DKIM/DMARC on **your** domain, scores will stay low no matter the code.
