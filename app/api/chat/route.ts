import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, uuidv4 } from '@/lib/db';
import crypto from 'crypto';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Token budget
const MAX_KNOWLEDGE_CHARS = 1200; // Dikurangi dari 1500 agar lebih hemat, tapi cukup buat detail
const MAX_HISTORY = 8; // Mengirim 8 pesan terakhir
const MAX_TOKENS = 800; // Batas output AI dikembalikan agak panjang agar ramah

function truncate(content: string, max: number): string {
    // Minify text untuk membuang spasi ganda dan enter kosong (sangat menghemat token!)
    const minified = content.replace(/\s+/g, ' ').trim();
    if (minified.length <= max) return minified;
    return minified.substring(0, max) + '...';
}

function hashQuestion(agentId: string, msg: string): string {
    const normalized = msg.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    return crypto.createHash('md5').update(`${agentId}:${normalized}`).digest('hex');
}

async function callGroq(messages: { role: string; content: string }[]) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7, max_tokens: MAX_TOKENS }),
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Groq Error: ${res.status} ${err}`); }
    const data = await res.json();
    return { content: data.choices[0]?.message?.content || '', usage: data.usage || { total_tokens: 0 } };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { agentId, message, conversationId, sessionType = 'chat' } = body;

        if (!agentId || !message) return NextResponse.json({ error: 'agentId and message required' }, { status: 400 });
        if (!GROQ_API_KEY) return NextResponse.json({ error: 'GROQ_API_KEY belum dikonfigurasi.' }, { status: 500 });

        const agent = await queryOne('SELECT id, admin_id, name, role, tone, language, instructions, goal, industry, topic FROM agents WHERE id = ?', [agentId]);
        if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

        // Get or create conversation
        let convId = conversationId;
        if (!convId) {
            convId = uuidv4();
            await execute('INSERT INTO conversations (id, agent_id, session_type) VALUES (?, ?, ?)', [convId, agentId, sessionType]);
        }

        // Save user message
        await execute('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)', [uuidv4(), convId, 'user', message]);

        // ── Check response cache first (save tokens!) ──
        const qHash = hashQuestion(agentId, message);
        const cached = await queryOne('SELECT id, response FROM response_cache WHERE agent_id = ? AND question_hash = ?', [agentId, qHash]);

        let responseText: string;
        let tokensUsed = 0;
        let fromCache = false;

        if (cached) {
            // Cache hit — no tokens used!
            responseText = cached.response;
            fromCache = true;
            await execute('UPDATE response_cache SET hit_count = hit_count + 1 WHERE id = ?', [cached.id]);
        } else {
            // ── Build compact system instruction ──
            let sys = `You are ${agent.name}, a ${agent.role} (${agent.industry}). Tone: ${agent.tone}. Language: ${agent.language}. Goal: ${agent.goal}.\n`;

            if (agent.instructions) sys += `\nINSTRUCTIONS:\n${truncate(agent.instructions, 2000)}\n`;

            // Agent-specific knowledge (truncated)
            const sources = await query('SELECT name, content FROM knowledge_sources WHERE agent_id = ? AND type != ?', [agentId, 'file']);
            if (sources.length > 0) {
                sys += "\nKNOWLEDGE:\n";
                for (const s of sources) sys += `[${s.name}]: ${truncate(s.content, MAX_KNOWLEDGE_CHARS)}\n`;
            }

            // General knowledge (truncated)
            const genSources = await query("SELECT gks.name, gks.content FROM general_knowledge_sources gks JOIN agents a ON gks.admin_id = a.admin_id WHERE a.id = ? AND gks.type != 'file'", [agentId]);
            if (genSources.length > 0) {
                sys += "\nGENERAL KNOWLEDGE:\n";
                for (const s of genSources) sys += `[${s.name}]: ${truncate(s.content, MAX_KNOWLEDGE_CHARS)}\n`;
            }

            // Business info
            const gi = await queryOne('SELECT gi.business_name, gi.address, gi.city, gi.phone, gi.website FROM general_info gi JOIN agents a ON gi.admin_id = a.admin_id WHERE a.id = ?', [agentId]);
            if (gi) {
                sys += `\nBUSINESS: ${gi.business_name || ''}, ${gi.address || ''}, ${gi.city || ''}`;
                if (gi.phone) sys += ` | CS: ${gi.phone}`;
                if (gi.website) sys += ` | Web: ${gi.website}`;
                sys += '\n';
            }

            if (agent.topic) sys += `\nTOPIC: "${agent.topic}"\n`;

            sys += `\nRULES:
- Respond concisely and naturally (max 3 paragraphs unless detail asked).
- For complaints: acknowledge empathetically, ask name & phone. CS: ${gi?.phone || 'not available'}.
- NEVER say "cari di Google Maps", "buka Google Maps", or "tanya staf hotel". YOU are the guide — give direct answers.
- For ANY place, food, or viral recommendations: ALWAYS provide specific recommendations with names, approximate distance, descriptions, AND ALWAYS format the name as a Google Maps link like this: [Name](https://www.google.com/maps/search/Name+${encodeURIComponent(gi?.city || '')}). Focus on locations closest to ${gi?.business_name || 'our location'}.
- For "Tempat Viral" or tourist/place questions, ONLY recommend tourist attractions, parks, photo spots, or landmarks (NO FOOD).
- For "Makanan Viral" or food questions, ONLY recommend food stalls, cafes, or restaurants.
- If you don't have exact data, still recommend popular places in ${gi?.city || 'the city'} that fit the category.
- CRITICAL RULE: If you are asked about the business/hotel (prices, facilities, rules) and the info is NOT in your Knowledge, DO NOT GUESS. You must answer politely and helpfully (e.g., advising them to contact CS or check the website), and you MUST append EXACTLY "()" at the very end of your sentence. Example: "...silakan hubungi CS kami ya Kak. ()"
- When recommending places, list them as numbered items.`;

            // History (Sangat dibatasi untuk hemat token: LIMIT 5 agar hanya baca 2 tanya-jawab terakhir)
            const history = await query(
                `SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 5`,
                [convId]
            );
            const chronoHistory = history.reverse().slice(0, -1); // skip last (current msg)

            const msgs: { role: string; content: string }[] = [{ role: 'system', content: sys }];
            for (const m of chronoHistory) msgs.push({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content });
            msgs.push({ role: 'user', content: message });

            const result = await callGroq(msgs);
            responseText = result.content;
            tokensUsed = result.usage.total_tokens;

            let isUnanswered = false;
            // Pengecekan ekstra tanda kurung kosong () dari instruksi AI
            if (responseText.includes('()')) {
                isUnanswered = true;
                responseText = responseText.replace(/\(\)/g, '').trim();
                try {
                    await execute(
                        'INSERT INTO unanswered_queries (id, admin_id, agent_id, question) VALUES (?, ?, ?, ?)',
                        [uuidv4(), agent.admin_id, agentId, message]
                    );
                } catch { /* ignore */ }
            }

            // Save to cache for future reuse (only if answered properly)
            if (!isUnanswered) {
                try {
                    await execute(
                        'INSERT INTO response_cache (id, agent_id, question_hash, question, response) VALUES (?, ?, ?, ?, ?)',
                        [uuidv4(), agentId, qHash, message, responseText]
                    );
                } catch { /* ignore duplicate key errors */ }
            }
        }

        // Save model message
        await execute('INSERT INTO messages (id, conversation_id, role, content, tokens_used) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), convId, 'model', responseText, tokensUsed]);

        // Update token usage (only if not cached)
        if (!fromCache && tokensUsed > 0) {
            await execute('UPDATE agents SET token_usage = token_usage + ? WHERE id = ?', [tokensUsed, agentId]);
        }

        // Log token usage for dashboard tracking
        try {
            await execute(
                'INSERT INTO token_logs (id, admin_id, agent_id, source, action, tokens_used, from_cache) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uuidv4(), agent.admin_id, agentId, sessionType || 'chat', fromCache ? 'cached_response' : 'ai_response', tokensUsed, fromCache ? 1 : 0]
            );
        } catch { /* ignore logging errors */ }

        // Detect complaint
        const complaintWords = ['complain', 'complaint', 'keluhan', 'kecewa', 'marah', 'buruk', 'jelek', 'tidak puas', 'masalah', 'rusak', 'lambat', 'payah', 'komplain'];
        const isComplaint = complaintWords.some(k => message.toLowerCase().includes(k));
        if (isComplaint) {
            await execute("UPDATE conversations SET is_complaint = 1, status = 'complaint' WHERE id = ?", [convId]);
        }

        return NextResponse.json({ conversationId: convId, response: responseText, tokensUsed, isComplaint, fromCache });

    } catch (error: any) {
        console.error('Chat error:', error);
        return NextResponse.json({ error: 'Chat failed: ' + error.message }, { status: 500 });
    }
}
