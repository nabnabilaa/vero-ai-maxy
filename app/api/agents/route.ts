import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, uuidv4 } from '@/lib/db';

function getAdminFromCookie(req: NextRequest) {
  const session = req.cookies.get('vero_session');
  if (!session) return null;
  try {
    return JSON.parse(session.value);
  } catch { return null; }
}

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function generateQuickActions(agentData: any): Promise<string> {
    if (!GROQ_API_KEY) return '';
    try {
        const prompt = `You are an AI generating quick action buttons for a chatbot UI.
The chatbot is for:
Business Industry: ${agentData.industry}
Agent Role: ${agentData.role}
Agent Topic: ${agentData.topic}
Agent Goal: ${agentData.goal}
Agent Instructions: ${agentData.instructions}

Generate 5 short, common questions users would ask this bot (e.g. "Peta Sekitar", "Harga", "Cara Pesan").
Make sure these questions are STRICTLY relevant to the Agent Topic and Agent Goal.
Format as JSON: {"actions": [{"label": "emoji + Short Label", "action": "Full question text"}]}
Provide the output in ${agentData.language || 'Indonesian'}.`;

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: 'You are a UI config generator. Always return JSON only.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                response_format: { type: 'json_object' },
            }),
        });
        if (!groqRes.ok) return '';
        const data = await groqRes.json();
        const text = data.choices[0]?.message?.content || '{}';
        const result = JSON.parse(text);
        if (result.actions && Array.isArray(result.actions)) {
            return JSON.stringify(result.actions);
        }
    } catch { }
    return '';
}

export async function GET(req: NextRequest) {
  const admin = getAdminFromCookie(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const agents = await query(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM knowledge_sources WHERE agent_id = a.id) as knowledge_count,
        (SELECT COUNT(*) FROM conversations WHERE agent_id = a.id) as conversation_count
      FROM agents a WHERE a.admin_id = ? ORDER BY a.created_at DESC
    `, [admin.id]);

    return NextResponse.json({ agents });
  } catch (error: any) {
    console.error('Agents GET Error:', error);
    return NextResponse.json({ error: error.message, agents: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = getAdminFromCookie(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const id = uuidv4();

    const quickActionsStr = await generateQuickActions(body);

    await execute(`
      INSERT INTO agents (id, admin_id, name, role, tone, language, voice_type, quick_actions, instructions, goal, industry, topic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, admin.id, body.name || 'New Agent', body.role || 'Assistant', body.tone || 'Professional', body.language || 'Indonesian', body.voice_type || 'female', quickActionsStr, body.instructions || '', body.goal || '', body.industry || admin.industry || 'General', body.topic || '']);

    const agent = await queryOne('SELECT * FROM agents WHERE id = ?', [id]);
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error: any) {
    console.error('Agent POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const admin = getAdminFromCookie(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });

    const quickActionsStr = await generateQuickActions(body);

    await execute(`
      UPDATE agents SET name=?, role=?, tone=?, language=?, voice_type=?, quick_actions=?, instructions=?, goal=?, industry=?, topic=?, is_active=?, updated_at=NOW()
      WHERE id=? AND admin_id=?
    `, [body.name || 'Agent', body.role || 'Assistant', body.tone || 'Professional', body.language || 'Indonesian', body.voice_type || 'female', quickActionsStr, body.instructions || '', body.goal || '', body.industry || admin.industry || 'General', body.topic || '', body.is_active ?? 1, body.id, admin.id]);

    const agent = await queryOne('SELECT * FROM agents WHERE id = ?', [body.id]);
    return NextResponse.json({ agent });
  } catch (error: any) {
    console.error('Agent PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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
