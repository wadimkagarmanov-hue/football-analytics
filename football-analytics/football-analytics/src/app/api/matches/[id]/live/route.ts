import { NextResponse } from 'next/server';
import { getMatch } from '@/lib/data';
import { buildLive } from '@/lib/live';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const match = (await getMatch(id)).data;
    if (!match) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(await buildLive(match), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
