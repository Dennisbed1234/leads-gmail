import { prisma } from '@/lib/db/prisma';

/**
 * Creates the SentEmail table if missing and adds open-tracking columns.
 */
export async function ensureSentEmailTable(): Promise<{
  ok: boolean;
  created: boolean;
  error?: string;
}> {
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
        "deliveredAt" TIMESTAMP(3),
        "openedAt" TIMESTAMP(3),
        "openCount" INTEGER NOT NULL DEFAULT 0,
        "lastEvent" TEXT,
        CONSTRAINT "SentEmail_pkey" PRIMARY KEY ("id")
      )
    `);

    // Migrate older tables
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "SentEmail" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "SentEmail" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "SentEmail" ADD COLUMN IF NOT EXISTS "openCount" INTEGER NOT NULL DEFAULT 0`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "SentEmail" ADD COLUMN IF NOT EXISTS "lastEvent" TEXT`
    );

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SentEmail_toEmail_idx" ON "SentEmail"("toEmail")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SentEmail_status_idx" ON "SentEmail"("status")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SentEmail_createdAt_idx" ON "SentEmail"("createdAt")`
    );

    await prisma.sentEmail.count();

    return { ok: true, created: true };
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('ensureSentEmailTable:', msg);
    return { ok: false, created: false, error: msg };
  }
}
