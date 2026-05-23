/**
 * Stream a notice's PDF from Vercel Blob (private) back to the client.
 *
 * Private blob URLs include a signed token; rather than exposing that token
 * to the browser we proxy through this route so the only thing the client
 * sees is /api/notices/<id>/pdf. Also gives us a single place to add ACL
 * checks later (a paralegal can only view notices for their workspace, etc.).
 */
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { db, schema } from '@/db';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const [notice] = await db
    .select({ rawFileUrl: schema.notices.rawFileUrl })
    .from(schema.notices)
    .where(eq(schema.notices.id, id))
    .limit(1);

  if (!notice?.rawFileUrl) {
    return new NextResponse('Notice or file not found', { status: 404 });
  }

  // Private blob: @vercel/blob.get() adds the Bearer auth header for us.
  try {
    const result = await get(notice.rawFileUrl, { access: 'private' });
    if (!result?.stream) {
      return new NextResponse('Upstream blob has no stream', { status: 502 });
    }
    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        'Content-Type': result.blob.contentType || 'application/pdf',
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename="notice-${id}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('PDF proxy error:', err);
    return new NextResponse(`Upstream blob fetch failed: ${message}`, { status: 502 });
  }
}
