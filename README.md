# CryptoByt

Lead outreach platform: extract executives from SEC EDGAR filings, generate/verify emails, and run campaigns.

## Important: Vercel Setup

1. **Database (required)**  
   Use a free Postgres provider (Neon, Supabase, Railway).  
   Set `DATABASE_URL` in Vercel → Project → Settings → Environment Variables.  
   SQLite does **not** work on Vercel.

2. **SEC User-Agent (required)**  
   Set `SEC_USER_AGENT` to something like:  
   `CryptoByt (your-email@domain.com)`  
   SEC blocks requests without a proper User-Agent.

3. Redeploy after setting env vars.

## Local Development

```bash
cp .env.example .env.local
# Edit .env.local with a Postgres URL (or use a local Postgres)
npm install
npm run db:push
npm run dev
```

## How extraction works

1. Pull recent 10-K (or other) from SEC EDGAR via CIK
2. Parse executive names + titles
3. Generate common Gmail patterns (first.last@gmail.com etc.)
4. Verify format + MX (true Gmail account existence requires paid verification APIs)
5. Save only verified candidates to the database

## Notes on verification

Google does not provide a public API to check if a Gmail address exists.  
Format-valid @gmail.com addresses pass and can be saved as leads; use ZeroBounce (or similar) for full mailbox verification.
