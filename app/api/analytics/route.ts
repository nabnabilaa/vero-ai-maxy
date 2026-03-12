import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

function getAdminFromCookie(req: NextRequest) {
  const session = req.cookies.get('vero_session');
  if (!session) return null;
  try { return JSON.parse(session.value); } catch { return null; }
}

export async function GET(req: NextRequest) {
  const admin = getAdminFromCookie(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Total tokens
  const tokenStats = await queryOne(`
    SELECT COALESCE(SUM(a.token_usage), 0) as total_tokens
    FROM agents a WHERE a.admin_id = ?
  `, [admin.id]);

  // Total agents
  const agentCount = await queryOne('SELECT COUNT(*) as count FROM agents WHERE admin_id = ?', [admin.id]);

  // Total conversations today
  const todayConvs = await queryOne(`
    SELECT COUNT(*) as count FROM conversations c 
    JOIN agents a ON c.agent_id = a.id 
    WHERE a.admin_id = ? AND DATE(c.started_at) = CURDATE()
  `, [admin.id]);

  // Total conversations
  const totalConvs = await queryOne(`
    SELECT COUNT(*) as count FROM conversations c 
    JOIN agents a ON c.agent_id = a.id 
    WHERE a.admin_id = ?
  `, [admin.id]);

  // Open complaints
  const openComplaints = await queryOne(`
    SELECT COUNT(*) as count FROM complaints WHERE admin_id = ? AND status IN ('open', 'in_progress')
  `, [admin.id]);

  // Per-agent stats
  const perAgent = await query(`
    SELECT a.id, a.name, a.token_usage,
      (SELECT COUNT(*) FROM conversations WHERE agent_id = a.id) as conversations,
      (SELECT COUNT(*) FROM complaints WHERE agent_id = a.id AND status IN ('open','in_progress')) as open_complaints
    FROM agents a WHERE a.admin_id = ?
    ORDER BY a.token_usage DESC
  `, [admin.id]);

  // Recent conversations
  const recentConvs = await query(`
    SELECT c.id, c.session_type, c.user_name, c.is_complaint, c.started_at, a.name as agent_name,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
    FROM conversations c JOIN agents a ON c.agent_id = a.id
    WHERE a.admin_id = ?
    ORDER BY c.started_at DESC LIMIT 10
  `, [admin.id]);

  return NextResponse.json({
    totalTokens: tokenStats?.total_tokens ?? 0,
    totalAgents: agentCount?.count ?? 0,
    todayConversations: todayConvs?.count ?? 0,
    totalConversations: totalConvs?.count ?? 0,
    openComplaints: openComplaints?.count ?? 0,
    perAgent,
    recentConversations: recentConvs,
  });
}
