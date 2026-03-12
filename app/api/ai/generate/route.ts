import { NextRequest, NextResponse } from 'next/server';

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
        const { prompt } = await req.json();
        if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
        if (!GROQ_API_KEY) throw new Error('Groq API Key not configured');

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: 'You are an AI assistant that helps set up chatbot agents. Always respond with valid JSON only, no markdown backticks or extra text.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 4096,
                response_format: { type: 'json_object' },
            }),
        });

        if (!groqRes.ok) {
            const errText = await groqRes.text();
            throw new Error(`Groq API Error: ${groqRes.status} ${errText}`);
        }

        const data = await groqRes.json();
        const text = data.choices[0]?.message?.content || '{}';

        return NextResponse.json({ text });

    } catch (error: any) {
        console.error('AI Generate Error:', error);
        return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
    }
}
