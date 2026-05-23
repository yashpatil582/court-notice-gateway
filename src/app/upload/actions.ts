'use server';

import { put } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { analyseNotice, extractPdfText } from '@/lib/parsing';
import { findOrCreateCase } from '@/lib/case-lookup';

export type UploadResult = { ok: false; error: string };

export async function uploadNotice(_prev: UploadResult | null, formData: FormData): Promise<UploadResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Select a PDF to upload.' };
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, error: 'Only PDF files are supported in v1.' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'Max upload size is 10MB.' };
  }

  let noticeId: string;
  try {
    const buffer = await file.arrayBuffer();

    const blob = await put(`notices/${Date.now()}-${file.name}`, file, {
      access: 'private',
      addRandomSuffix: true,
    });

    const { text, pageCount, requiresOcr } = await extractPdfText(buffer);
    const analysis = analyseNotice({ text, senderEmail: null });

    const caseId = analysis.caseNumber ? await findOrCreateCase(analysis.caseNumber) : null;

    const [notice] = await db
      .insert(schema.notices)
      .values({
        caseId,
        source: 'pdf',
        status: analysis.verdict === 'suspicious' ? 'suspicious' : 'received',
        rawText: text,
        rawFileUrl: blob.url,
      })
      .returning({ id: schema.notices.id });

    noticeId = notice.id;

    await db.insert(schema.auditEvents).values({
      entity: 'notice',
      entityId: notice.id,
      actor: 'system',
      action: 'ingested',
      after: {
        verdict: analysis.verdict,
        caseNumber: analysis.caseNumber?.caseNumber ?? null,
        proceeding: analysis.caseNumber?.proceeding ?? null,
        pageCount,
        requiresOcr,
        linkCount: analysis.links.links.length,
        linkOverall: analysis.links.overall,
        reasons: analysis.reasons,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during upload';
    return { ok: false, error: message };
  }

  revalidatePath('/');
  redirect('/');
}
