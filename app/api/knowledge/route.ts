import { NextRequest, NextResponse } from 'next/server';
import { query, execute, uuidv4 } from '@/lib/db';

function getAdminFromCookie(req: NextRequest) {
    const session = req.cookies.get('vero_session');
    if (!session) return null;
    try { return JSON.parse(session.value); } catch { return null; }
}

export async function GET(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });

    const sources = await query('SELECT * FROM knowledge_sources WHERE agent_id = ? ORDER BY date_added DESC', [agentId]);
    return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const id = uuidv4();

    await execute(`
    INSERT INTO knowledge_sources (id, agent_id, type, name, content, mime_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, body.agentId, body.type, body.name, body.content || '', body.mimeType || 'text/plain']);

    return NextResponse.json({ id, success: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await execute('DELETE FROM knowledge_sources WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
}
