import { prisma } from '@/lib/db/prisma';

/**
 * Creates the SentEmail table if it is missing.
 * Safe to call repeatedly (IF NOT EXISTS).
 */
export async function ensureSentEmailTable(): Promise<{ ok: boolean; created: boolean; error?: string }> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SentEmail" (
        "id" TEXT NOT NULL,
        "toEmail" TEXT NOT NULL,
        "toName" TEXT,
        "subject" TEXT NOT NULL,
        "bodySnippet" TEXT,
        "status" TEXT NOT NULL DEFAULT 'SENT',
        "messageId" TEXT,
        "error" TEXT,
        "mode" TEXT,
        "isHtml" BOOLEAN NOT NULL DEFAULT true,
        "fromName" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SentEmail_pkey" PRIMARY KEY ("id")
      )
    `);

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SentEmail_toEmail_idx" ON "SentEmail"("toEmail")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SentEmail_status_idx" ON "SentEmail"("status")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SentEmail_createdAt_idx" ON "SentEmail"("createdAt")`
    );

    // Probe that Prisma client can see the table
    await prisma.sentEmail.count();

    return { ok: true, created: true };
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('ensureSentEmailTable:', msg);
    return { ok: false, created: false, error: msg };
  }
}
