/**
 * PDF text extraction for court notices.
 *
 * Court notices are nearly always text-PDFs (CM-ECF renders them server-side
 * as PDF/A). We use `unpdf` — a pure-JS pdfjs wrapper that works in Node and
 * edge runtimes — and merge pages with a clear separator so downstream
 * parsing can still see page boundaries if it wants to.
 *
 * If a notice arrives as an image-only PDF (rare but possible for scans), this
 * function returns whatever text pdfjs produces (often empty) along with a
 * `requiresOcr` flag. OCR is out of scope for v1; flag and route to review.
 */

import { extractText, getDocumentProxy } from 'unpdf';

export type PdfExtraction = {
  text: string;
  pageCount: number;
  pageTexts: string[];
  requiresOcr: boolean;
};

const MIN_CHARS_PER_PAGE_HEURISTIC = 50;

export async function extractPdfText(buffer: ArrayBuffer | Uint8Array): Promise<PdfExtraction> {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  const pageTexts = Array.isArray(text) ? text : [text];
  const joined = pageTexts.join('\n\n--- page break ---\n\n');
  const requiresOcr =
    pageTexts.every((p) => p.replace(/\s+/g, '').length < MIN_CHARS_PER_PAGE_HEURISTIC);

  return {
    text: joined,
    pageCount: totalPages,
    pageTexts,
    requiresOcr,
  };
}
