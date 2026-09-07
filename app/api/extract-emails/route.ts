import { NextResponse } from 'next/server';
import {
  extractEmailsFromText,
  emailsToCsv,
} from '@/lib/email/extract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_CHARS = 2_000_000; // ~2MB text

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let text = '';
    let gmailOnly = false;
    let unique = true;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      const pasted = form.get('text');
      gmailOnly = String(form.get('gmailOnly') || '') === 'true';
      unique = String(form.get('unique') || 'true') !== 'false';

      if (file && typeof file === 'object' && 'text' in file) {
        const f = file as File;
        // Limit size
        if (f.size > MAX_CHARS) {
          return NextResponse.json(
            { error: 'File too large (max ~2MB text)' },
            { status: 400 }
          );
        }
        text = await f.text();
      } else if (typeof pasted === 'string') {
        text = pasted;
      }
    } else {
      const body = await request.json().catch(() => ({}));
      text = String(body.text || body.content || '');
      gmailOnly = Boolean(body.gmailOnly);
      unique = body.unique !== false;
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'Paste text or upload a file containing emails' },
        { status: 400 }
      );
    }

    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS);
    }

    const emails = extractEmailsFromText(text, { unique, gmailOnly });
    const gmailCount = emails.filter((e) => e.isGmail).length;

    return NextResponse.json({
      success: true,
      total: emails.length,
      gmailCount,
      otherCount: emails.length - gmailCount,
      emails,
      csv: emailsToCsv(emails),
      truncated: text.length >= MAX_CHARS,
    });
  } catch (error: any) {
    console.error('extract-emails error:', error);
    return NextResponse.json(
      { error: error?.message || 'Extraction failed' },
      { status: 500 }
    );
  }
}
