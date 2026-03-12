import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function getAdminFromCookie(req: NextRequest) {
    const session = req.cookies.get('vero_session');
    if (!session) return null;
    try { return JSON.parse(session.value); } catch { return null; }
}

export async function POST(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { topicName, agentIds } = await req.json();
        if (!agentIds || agentIds.length === 0) {
            return NextResponse.json({ error: 'No agents provided' }, { status: 400 });
        }

        const placeholders = agentIds.map(() => '?').join(',');

        // Fetch up to 50 recent conversations for this topic
        const conversations = await query(`
            SELECT c.id, c.session_type, c.user_name, c.is_complaint, c.started_at, a.name as agent_name
            FROM conversations c 
            JOIN agents a ON c.agent_id = a.id
            WHERE a.admin_id = ? AND a.id IN (${placeholders})
            ORDER BY c.started_at DESC LIMIT 50
        `, [admin.id, ...agentIds]);

        if (conversations.length === 0) {
            return NextResponse.json({ error: 'No conversations found for this topic to analyze.' }, { status: 404 });
        }

        // Fetch messages for these conversations
        const convIds = conversations.map((c: any) => c.id);
        const convMap = new Map();

        for (let i = 0; i < convIds.length; i += 10) {
            const batch = convIds.slice(i, i + 10);
            const msgPlaceholders = batch.map(() => '?').join(',');
            const messages = await query(`
                SELECT conversation_id, role, content 
                FROM messages 
                WHERE conversation_id IN (${msgPlaceholders})
                ORDER BY created_at ASC
            `, batch);

            messages.forEach((m: any) => {
                if (!convMap.has(m.conversation_id)) convMap.set(m.conversation_id, []);
                convMap.get(m.conversation_id).push(`[${m.role.toUpperCase()}]: ${m.content}`);
            });
        }

        let fullTranscript = `Topic: ${topicName}\n\n`;
        conversations.forEach((c: any) => {
            const msgs = convMap.get(c.id) || [];
            if (msgs.length > 0) {
                fullTranscript += `--- Conversation ${c.id} (${c.session_type}, User: ${c.user_name || 'Anon'}) ---\n`;
                fullTranscript += msgs.join('\n') + '\n\n';
            }
        });

        if (!GROQ_API_KEY) throw new Error('Groq API Key missing');

        const prompt = `You are an expert Data Analyst AI for a business.
Analyze the following recent chat/voice transcripts for the topic "${topicName}".
Extract business intelligence and output ONLY valid JSON in the exact schema below.

If there are no conversations or they are empty, return safe default empty arrays/neutral sentiment.

Analyze for:
1. Overall Sentiment (Positive, Neutral, Negative) and a short 1-sentence reason.
2. Structured Data: Extract any user details mentioned across all conversations (names, emails, phone numbers, addresses, preferences).
3. Orders/Requests: Extract any explicit orders, bookings, or requests made by users.

Required JSON schema:
{
  "sentiment": "Positive" | "Neutral" | "Negative",
  "sentimentReason": "string",
  "structuredDataExtractor": [{ "customerName": "string", "contactInfo": "string", "extractedInfo": "string" }],
  "orders": [{ "itemOrRequest": "string", "quantityOrDetails": "string", "customerContext": "string" }]
}

TRANSCRIPTS:
${fullTranscript.slice(0, 30000)}`;

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: 'You are a data analysis AI. Always respond with valid JSON only.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 4096,
                response_format: { type: 'json_object' },
            }),
        });

        if (!groqRes.ok) {
            const errText = await groqRes.text();
            throw new Error(`Groq API Error: ${groqRes.status} ${errText}`);
        }

        const groqData = await groqRes.json();
        const rawText = groqData.choices[0]?.message?.content || '{}';

        let data;
        try {
            data = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch {
            data = { error: 'Failed to parse AI output' };
        }

        return NextResponse.json({ success: true, analysis: data });

    } catch (error: any) {
        console.error('Live Analysis Error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
