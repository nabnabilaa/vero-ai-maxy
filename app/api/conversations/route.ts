import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, uuidv4 } from '@/lib/db';

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

  let conversations;
  if (agentId) {
    conversations = await query(`
      SELECT c.*, a.name as agent_name,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT COALESCE(SUM(tokens_used), 0) FROM messages WHERE conversation_id = c.id) as total_tokens
      FROM conversations c 
      JOIN agents a ON c.agent_id = a.id 
      WHERE a.admin_id = ? AND c.agent_id = ?
      ORDER BY c.started_at DESC LIMIT 100
    `, [admin.id, agentId]);
  } else {
    conversations = await query(`
      SELECT c.*, a.name as agent_name,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT COALESCE(SUM(tokens_used), 0) FROM messages WHERE conversation_id = c.id) as total_tokens
      FROM conversations c 
      JOIN agents a ON c.agent_id = a.id 
      WHERE a.admin_id = ?
      ORDER BY c.started_at DESC LIMIT 100
    `, [admin.id]);
  }

  return NextResponse.json({ conversations });
}

// Get specific conversation with messages
export async function POST(req: NextRequest) {
  const admin = getAdminFromCookie(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversationId } = await req.json();

  const conversation = await queryOne(`
    SELECT c.*, a.name as agent_name
    FROM conversations c JOIN agents a ON c.agent_id = a.id
    WHERE c.id = ? AND a.admin_id = ?
  `, [conversationId, admin.id]);

  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const messages = await query(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`, [conversationId]);

  return NextResponse.json({ conversation, messages });
}
