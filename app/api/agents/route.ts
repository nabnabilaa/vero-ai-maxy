import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, uuidv4 } from '@/lib/db';

function getAdminFromCookie(req: NextRequest) {
  const session = req.cookies.get('vero_session');
  if (!session) return null;
  try {
    return JSON.parse(session.value);
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const admin = getAdminFromCookie(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agents = await query(`
    SELECT a.*, 
      (SELECT COUNT(*) FROM knowledge_sources WHERE agent_id = a.id) as knowledge_count,
      (SELECT COUNT(*) FROM conversations WHERE agent_id = a.id) as conversation_count
    FROM agents a WHERE a.admin_id = ? ORDER BY a.created_at DESC
  `, [admin.id]);

  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {
  const admin = getAdminFromCookie(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const id = uuidv4();

  await execute(`
    INSERT INTO agents (id, admin_id, name, role, tone, language, voice_type, instructions, goal, industry, topic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, admin.id, body.name || 'New Agent', body.role || 'Assistant', body.tone || 'Professional', body.language || 'Indonesian', body.voice_type || 'female', body.instructions || '', body.goal || '', body.industry || admin.industry, body.topic || '']);

  const agent = await queryOne('SELECT * FROM agents WHERE id = ?', [id]);
  return NextResponse.json({ agent }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const admin = getAdminFromCookie(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });

  await execute(`
    UPDATE agents SET name=?, role=?, tone=?, language=?, voice_type=?, instructions=?, goal=?, industry=?, topic=?, is_active=?, updated_at=NOW()
    WHERE id=? AND admin_id=?
  `, [body.name, body.role, body.tone, body.language, body.voice_type || 'female', body.instructions, body.goal, body.industry, body.topic || '', body.is_active ?? 1, body.id, admin.id]);

  const agent = await queryOne('SELECT * FROM agents WHERE id = ?', [body.id]);
  return NextResponse.json({ agent });
}

export async function DELETE(req: NextRequest) {
  const admin = getAdminFromCookie(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });

  await execute('DELETE FROM agents WHERE id = ? AND admin_id = ?', [id, admin.id]);
  return NextResponse.json({ success: true });
}
