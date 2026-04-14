import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

function getAdminFromCookie(req: NextRequest) {
    const session = req.cookies.get('vero_session');
    if (!session) return null;
    try { return JSON.parse(session.value); } catch { return null; }
}

// GET — list all unanswered queries for admin
export async function GET(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const queries = await query(`
        SELECT uq.id, uq.agent_id, uq.question, uq.status, uq.created_at,
               a.name as agent_name
        FROM unanswered_queries uq
        JOIN agents a ON uq.agent_id = a.id
        WHERE uq.admin_id = ? AND uq.status = 'open'
        ORDER BY uq.created_at DESC
        LIMIT 200
    `, [admin.id]);

    // Count total
    const stats = await query(`
        SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT agent_id) as agents_affected,
            COUNT(DISTINCT question) as unique_questions
        FROM unanswered_queries 
        WHERE admin_id = ? AND status = 'open'
    `, [admin.id]);

    return NextResponse.json({
        queries,
        stats: stats[0] || { total: 0, agents_affected: 0, unique_questions: 0 }
    });
}

// DELETE — mark as resolved or dismiss
export async function DELETE(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all');

    if (all === 'true') {
        await execute("UPDATE unanswered_queries SET status = 'resolved' WHERE admin_id = ?", [admin.id]);
    } else if (id) {
        await execute("UPDATE unanswered_queries SET status = 'resolved' WHERE id = ? AND admin_id = ?", [id, admin.id]);
    } else {
        return NextResponse.json({ error: 'ID or all=true required' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}
