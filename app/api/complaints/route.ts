import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, uuidv4 } from '@/lib/db';

function getAdminFromCookie(req: NextRequest) {
    const session = req.cookies.get('vero_session');
    if (!session) return null;
    try { return JSON.parse(session.value); } catch { return null; }
}

export async function GET(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const complaints = await query(`
    SELECT comp.*, a.name as agent_name, c.session_type
    FROM complaints comp
    JOIN agents a ON comp.agent_id = a.id
    JOIN conversations c ON comp.conversation_id = c.id
    WHERE comp.admin_id = ?
    ORDER BY comp.created_at DESC
  `, [admin.id]);

    return NextResponse.json({ complaints });
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { conversationId, agentId, userName, userPhone, summary, details } = body;

    // Get admin_id from agent
    const agent = await queryOne('SELECT admin_id FROM agents WHERE id = ?', [agentId]);
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    const id = uuidv4();
    await execute(`
    INSERT INTO complaints (id, conversation_id, agent_id, admin_id, user_name, user_phone, summary, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, conversationId, agentId, agent.admin_id, userName || '', userPhone || '', summary || '', details || '']);

    // Update conversation status
    await execute(`UPDATE conversations SET is_complaint = 1, status = 'complaint', user_name = ?, user_phone = ? WHERE id = ?`,
        [userName || '', userPhone || '', conversationId]);

    return NextResponse.json({ id, success: true }, { status: 201 });
}

export async function PUT(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    await execute(`UPDATE complaints SET status = ?, resolved_at = CASE WHEN ? IN ('resolved','closed') THEN NOW() ELSE resolved_at END WHERE id = ? AND admin_id = ?`,
        [body.status, body.status, body.id, admin.id]);

    return NextResponse.json({ success: true });
}
