'use server';

import { put } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { extractPdfText } from '@/lib/parsing';
import { ingestNotice } from '@/lib/notice-pipeline/run';

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

  try {
    const buffer = await file.arrayBuffer();

    const blob = await put(`notices/${Date.now()}-${file.name}`, file, {
      access: 'private',
      addRandomSuffix: true,
    });

    const { text } = await extractPdfText(buffer);

    await ingestNotice({
      text,
      rawFileUrl: blob.url,
      senderEmail: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during upload';
    console.error('Upload failed:', err);
    return { ok: false, error: message };
  }

  revalidatePath('/');
  redirect('/');
}
