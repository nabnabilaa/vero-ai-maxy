import { NextRequest } from 'next/server';
import { query, queryOne, execute, uuidv4 } from '@/lib/db';
import crypto from 'crypto';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Token budget
const MAX_KNOWLEDGE_CHARS = 1500;
const MAX_SOURCES_IN_PROMPT = 8;   // Only inject top N most relevant knowledge sources
const MAX_TOKENS = 800;
const CACHE_TTL_HOURS = 24;        // Cache expires after 24 hours

function truncate(content: string, max: number): string {
    const minified = content.replace(/\s+/g, ' ').trim();
    if (minified.length <= max) return minified;
    return minified.substring(0, max) + '...';
}

function hashQuestion(agentId: string, msg: string): string {
    const normalized = msg.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    return crypto.createHash('md5').update(`${agentId}:${normalized}`).digest('hex');
}

/**
 * Simple keyword-based relevance scorer.
 * Scores how many words from the user question appear in a knowledge source.
 */
function scoreRelevance(question: string, sourceName: string, sourceContent: string): number {
    const qWords = question.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const combined = `${sourceName} ${sourceContent}`.toLowerCase();

    let score = 0;
    for (const word of qWords) {
        if (combined.includes(word)) score += 1;
        // Bonus for exact phrase matches in name
        if (sourceName.toLowerCase().includes(word)) score += 2;
    }
    return score;
}

// ── Streaming Groq call ──
async function* streamGroq(messages: { role: string; content: string }[]): AsyncGenerator<{ chunk?: string; done?: boolean; usage?: any }> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7, max_tokens: MAX_TOKENS, stream: true }),
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Groq Error: ${res.status} ${err}`); }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
                yield { done: true };
                return;
            }
            try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) yield { chunk: delta };
                // Capture usage from the final chunk
                if (json.usage) yield { usage: json.usage };
                if (json.x_groq?.usage) yield { usage: json.x_groq.usage };
            } catch { /* skip malformed JSON */ }
        }
    }
}

// ── Non-streaming Gemini (used for non-Latin languages & vision) ──
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function callGeminiText(sys: string, message: string, history: any[]) {
    const chatHistory = history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: sys }] },
            contents: [...chatHistory, { role: 'user', parts: [{ text: message }] }]
        })
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Gemini Error: ${res.status} ${err}`); }
    const data = await res.json();
    return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '', usage: { total_tokens: 150 } };
}

async function callGeminiVision(sys: string, message: string, imageBase64: string, history: any[]) {
    const chatHistory = history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));
    
    // Strip "data:image/jpeg;base64," prefix
    const b64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: sys }] },
            contents: [
                ...chatHistory,
                {
                    role: 'user',
                    parts: [
                        { text: message },
                        { inlineData: { mimeType: 'image/jpeg', data: b64Data } }
                    ]
                }
            ]
        })
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Gemini Error: ${res.status} ${err}`); }
    const data = await res.json();
    return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '', usage: { total_tokens: 150 } };
}

// ── Build system prompt (extracted for reuse) ──
async function buildSystemPrompt(agent: any, message: string, userLang: string): Promise<string> {
    let sys = `# IDENTITY
You are "${agent.name}".
- Role: ${agent.role}
- Industry: ${agent.industry}
- Focus Topic: ${agent.topic || 'General Information'}
- Communication Tone: ${agent.tone}
- Primary Language: ${userLang || agent.language}
- Goal: ${agent.goal}

IMPORTANT: The user has selected "${userLang || agent.language}" as their preferred language. You MUST reply ONLY in this language!
`;

    // ── Personality & Tone enforcement ──
    sys += `\n# PERSONALITY & TONE
You MUST strictly follow the tone "${agent.tone}" in ALL your responses.
- If the tone is "Ramah" or "Friendly": be warm, use casual language, add empathy.
- If the tone is "Profesional" or "Professional": be precise, factual, structured.
- If the tone is "Formal": use respectful honorifics, avoid slang.
- If the tone is "Santai" or "Casual": be relaxed, use informal language, be approachable.
- If a custom tone is specified, adapt your language style to match it exactly.
Your role as "${agent.role}" defines HOW you interact — embody this role completely.
Your goal "${agent.goal}" defines WHAT you try to achieve in every conversation.
`;

    // ── Custom instructions (highest priority) ──
    if (agent.instructions) sys += `\n# CUSTOM INSTRUCTIONS (HIGHEST PRIORITY)\nFollow these instructions above all other rules:\n${truncate(agent.instructions, 2000)}\n`;

    // ── Agent-specific knowledge (ranked by relevance) ──
    const allSources = await query('SELECT name, content FROM knowledge_sources WHERE agent_id = ?', [agent.id]);
    if (allSources.length > 0) {
        const scored = allSources.map(s => ({
            ...s,
            score: scoreRelevance(message, s.name, s.content)
        })).sort((a, b) => b.score - a.score);

        const topSources = scored.slice(0, MAX_SOURCES_IN_PROMPT);
        sys += "\n# AGENT KNOWLEDGE\nUse this data to answer questions accurately:\n";
        for (const s of topSources) {
            sys += `[${s.name}]: ${truncate(s.content, MAX_KNOWLEDGE_CHARS)}\n`;
        }
    }

    // ── General knowledge (ranked by relevance) ──
    const genSources = await query(
        "SELECT gks.name, gks.content FROM general_knowledge_sources gks JOIN agents a ON gks.admin_id = a.admin_id WHERE a.id = ?",
        [agent.id]
    );
    if (genSources.length > 0) {
        const scored = genSources.map(s => ({
            ...s,
            score: scoreRelevance(message, s.name, s.content)
        })).sort((a, b) => b.score - a.score);

        const topGen = scored.slice(0, MAX_SOURCES_IN_PROMPT);
        sys += "\n# GENERAL COMPANY KNOWLEDGE\n";
        for (const s of topGen) {
            sys += `[${s.name}]: ${truncate(s.content, MAX_KNOWLEDGE_CHARS)}\n`;
        }
    }

    // ── Past Chat History (from response_cache) ranked by relevance ──
    const pastCache = await query('SELECT question, response FROM response_cache WHERE agent_id = ? ORDER BY created_at DESC LIMIT 20', [agent.id]);
    if (pastCache.length > 0) {
        const scoredPast = pastCache.map(s => ({
            ...s,
            score: scoreRelevance(message, s.question || '', s.response)
        })).sort((a, b) => b.score - a.score);

        // Only include top 3 that have a decent score (> 0)
        const relevantPast = scoredPast.slice(0, 3).filter(s => s.score > 0);
        if (relevantPast.length > 0) {
            sys += "\n# PAST CONVERSATION HISTORY\nBelow are previous questions from users and how you answered them. Use these to ensure consistency if the current question is similar:\n";
            for (const s of relevantPast) {
                sys += `User: ${s.question}\nYour Answer: ${truncate(s.response, 400)}\n\n`;
            }
        }
    }

    // Business info
    const gi = await queryOne('SELECT gi.business_name, gi.address, gi.city, gi.phone, gi.website, gi.description FROM general_info gi JOIN agents a ON gi.admin_id = a.admin_id WHERE a.id = ?', [agent.id]);
    if (gi) {
        sys += `\n# BUSINESS INFO\n`;
        sys += `Business Name: ${gi.business_name || 'N/A'}\n`;
        sys += `Address: ${gi.address || 'N/A'}\n`;
        sys += `City: ${gi.city || 'N/A'}\n`;
        if (gi.phone) sys += `Phone/CS: ${gi.phone}\n`;
        if (gi.website) sys += `Website: ${gi.website}\n`;
        if (gi.description) sys += `Description: ${gi.description}\n`;
    }

    if (agent.topic) sys += `\n# TOPIC FOCUS: "${agent.topic}"\nStay focused on this topic when answering. If asked about unrelated things, gently redirect.\n`;

    // ── Dynamic rules based on industry ──
    sys += `\n# RULES\n`;
    sys += `- STRICT LANGUAGE: You MUST communicate EXCLUSIVELY in ${userLang || agent.language}. Always reply in ${userLang || agent.language} regardless of the user's language.\n`;
    sys += `- Respond concisely and naturally (max 3 paragraphs unless the user asks for more detail).\n`;
    if (gi?.website) {
        sys += `- If the user asks for more details or further info, direct them to check our website.\n`;
    } else {
        sys += `- If the user asks for more details or further info, direct them to contact our customer service/admin.\n`;
    }

    // Industry-specific rules
    const industry = agent.industry || 'General';
    if (industry === 'Hotel') {
        sys += `- For complaints: acknowledge empathetically, ask guest name & room number. CS: ${gi?.phone || 'not available'}.\n`;
        sys += `- NEVER say "cari di Google Maps" or "tanya staf hotel". YOU are the concierge — give direct answers.\n`;
        sys += `- For place/food recommendations: provide specific names, distance, descriptions, and format as Google Maps links: [Name](https://www.google.com/maps/search/Name+${encodeURIComponent(gi?.city || '')}).\n`;
        sys += `- For "Tempat Viral" or tourist questions: recommend attractions, parks, landmarks (NOT food).\n`;
        sys += `- For "Makanan Viral" or food questions: recommend restaurants, cafes, food stalls only.\n`;
        sys += `- When recommending places, list them as numbered items.\n`;
    } else if (industry === 'Restaurant') {
        sys += `- For menu questions: provide specific items, prices, and descriptions from your knowledge.\n`;
        sys += `- For dietary/allergy questions: be very precise and careful.\n`;
        sys += `- For reservation questions: provide booking info, hours, and capacity.\n`;
        sys += `- For complaints: acknowledge empathetically, ask name & phone. CS: ${gi?.phone || 'not available'}.\n`;
    } else if (industry === 'Retail') {
        sys += `- For product questions: provide specific items, prices, specs, and availability.\n`;
        sys += `- For shipping/return questions: provide clear policies and timelines.\n`;
        sys += `- For complaints: acknowledge empathetically, ask order number & phone. CS: ${gi?.phone || 'not available'}.\n`;
    } else if (industry === 'Real Estate') {
        sys += `- For property questions: provide specific listings, prices, specs, and locations.\n`;
        sys += `- For mortgage/KPR questions: provide available options and requirements.\n`;
        sys += `- Always mention viewing appointments for serious inquiries. CS: ${gi?.phone || 'not available'}.\n`;
    } else {
        sys += `- For complaints: acknowledge empathetically, ask name & phone. CS: ${gi?.phone || 'not available'}.\n`;
    }

    // Universal rules
    if (gi?.city) {
        sys += `- If you don't have exact data but the question is about places in ${gi.city}, recommend popular options that fit the category.\n`;
    }
    sys += `- CRITICAL: If asked about ${gi?.business_name || 'this business'} (prices, facilities, rules) and the info is NOT in your Knowledge, DO NOT GUESS. Answer politely (e.g., advise them to contact CS or check the website), and append EXACTLY "()" at the end. Example: "...silakan hubungi CS kami ya Kak. ()"\n`;

    sys += `\n# COMPLAINT DETECTION
- If the user expresses dissatisfaction, frustration, or reports a problem, start your response with exactly "[COMPLAINT]" (including brackets).
- Only use this tag for genuine complaints, NOT neutral questions or positive feedback.
- After the [COMPLAINT] tag, respond empathetically as "${agent.name}" would.`;

    sys += `\n# FOLLOW-UP SUGGESTIONS
- At the very end of your response, you MUST provide exactly 3 contextual follow-up questions that the user might want to ask next based on your response and the topic.
- Write the suggestions in ${userLang || agent.language}.
- Format the suggestions EXACTLY like this on a new line: [SUGGESTIONS]Question 1|Question 2|Question 3[/SUGGESTIONS]`;

    return sys;
}

// ── SSE helper to send events ──
function sseEvent(data: object): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

// ── Post-stream processing: extract markers, save to DB ──
async function postStreamProcess(
    fullText: string, agent: any, agentId: string, message: string, convId: string,
    tokensUsed: number, fromCache: boolean, sessionType: string
) {
    let responseText = fullText;

    // Check for unanswered marker ()
    let isUnanswered = false;
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

    // Save to cache (only if answered properly)
    const qHash = hashQuestion(agentId, message);
    if (!isUnanswered) {
        // Delete stale cache entry if exists
        try { await execute('DELETE FROM response_cache WHERE agent_id = ? AND question_hash = ?', [agentId, qHash]); } catch { }
        try {
            await execute(
                'INSERT INTO response_cache (id, agent_id, question_hash, question, response) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), agentId, qHash, message, responseText]
            );
        } catch { /* ignore duplicate key errors */ }
    }

    // Complaint detection
    let isComplaint = false;
    if (responseText.startsWith('[COMPLAINT]')) {
        isComplaint = true;
        responseText = responseText.replace('[COMPLAINT]', '').trim();
    }

    // Extract Suggestions
    let suggestions: string[] = [];
    const sugMatch = responseText.match(/\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i);
    if (sugMatch) {
        suggestions = sugMatch[1].split('|').map(s => s.trim()).filter(s => s);
        responseText = responseText.replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/i, '').trim();
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

    // Update conversation if complaint
    if (isComplaint) {
        await execute("UPDATE conversations SET is_complaint = 1, status = 'complaint' WHERE id = ?", [convId]);
    }

    return { responseText, isComplaint, suggestions };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { agentId, message, conversationId, sessionType = 'chat', imageBase64, userLang } = body;

        if (!agentId || !message) return new Response(JSON.stringify({ error: 'agentId and message required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        if (!GROQ_API_KEY) return new Response(JSON.stringify({ error: 'GROQ_API_KEY belum dikonfigurasi.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

        const agent = await queryOne('SELECT id, admin_id, name, role, tone, language, instructions, goal, industry, topic FROM agents WHERE id = ?', [agentId]);
        if (!agent) return new Response(JSON.stringify({ error: 'Agent not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

        // Get or create conversation
        let convId = conversationId;
        if (!convId) {
            convId = uuidv4();
            await execute('INSERT INTO conversations (id, agent_id, session_type) VALUES (?, ?, ?)', [convId, agentId, sessionType]);
        }

        // Save user message
        await execute('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)', [uuidv4(), convId, 'user', message]);

        // ── Check response cache with TTL ──
        const qHash = hashQuestion(agentId, message);
        const cached = await queryOne(
            `SELECT id, response, created_at FROM response_cache 
             WHERE agent_id = ? AND question_hash = ? 
             AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`,
            [agentId, qHash, CACHE_TTL_HOURS]
        );

        // ── CACHED: return non-streaming JSON (instant) ──
        if (cached) {
            await execute('UPDATE response_cache SET hit_count = hit_count + 1 WHERE id = ?', [cached.id]);
            const { responseText, isComplaint, suggestions } = await postStreamProcess(
                cached.response, agent, agentId, message, convId, 0, true, sessionType
            );
            return new Response(JSON.stringify({
                conversationId: convId, response: responseText, tokensUsed: 0,
                isComplaint, fromCache: true, suggestions
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Delete stale cache entry if exists
        try { await execute('DELETE FROM response_cache WHERE agent_id = ? AND question_hash = ?', [agentId, qHash]); } catch { }

        // Build system prompt
        const sys = await buildSystemPrompt(agent, message, userLang);

        // History
        const history = await query(
            `SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 5`,
            [convId]
        );
        const chronoHistory = history.reverse().slice(0, -1);

        // Use Gemini for non-Latin languages (better multilingual support)
        const nonLatinLangs = ['Japanese', 'Korean', 'Mandarin', 'Arabic', 'Russian'];
        const effectiveLang = userLang || agent.language || 'Indonesian';
        const useGemini = nonLatinLangs.includes(effectiveLang);

        // ── Non-streaming path: Gemini text / Gemini vision ──
        if (imageBase64 || useGemini) {
            let result;
            if (imageBase64) {
                result = await callGeminiVision(sys, message, imageBase64, chronoHistory);
            } else {
                result = await callGeminiText(sys, message, chronoHistory);
            }
            const { responseText, isComplaint, suggestions } = await postStreamProcess(
                result.content, agent, agentId, message, convId, result.usage.total_tokens, false, sessionType
            );
            return new Response(JSON.stringify({
                conversationId: convId, response: responseText, tokensUsed: result.usage.total_tokens,
                isComplaint, fromCache: false, suggestions
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ── STREAMING path: Groq with SSE ──
        const msgs: { role: string; content: string }[] = [{ role: 'system', content: sys }];
        for (const m of chronoHistory) msgs.push({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content });
        msgs.push({ role: 'user', content: message });

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                let fullText = '';
                let tokensUsed = 0;

                try {
                    // Send conversationId immediately
                    controller.enqueue(encoder.encode(sseEvent({ type: 'meta', conversationId: convId })));

                    for await (const event of streamGroq(msgs)) {
                        if (event.chunk) {
                            fullText += event.chunk;
                            controller.enqueue(encoder.encode(sseEvent({ type: 'chunk', content: event.chunk })));
                        }
                        if (event.usage) {
                            tokensUsed = event.usage.total_tokens || 0;
                        }
                    }

                    // Post-process: save to DB, detect markers
                    const { responseText, isComplaint, suggestions } = await postStreamProcess(
                        fullText, agent, agentId, message, convId, tokensUsed, false, sessionType
                    );

                    // Send final event with metadata
                    controller.enqueue(encoder.encode(sseEvent({
                        type: 'done', conversationId: convId, isComplaint, fromCache: false,
                        suggestions, tokensUsed, responseText
                    })));
                } catch (error: any) {
                    controller.enqueue(encoder.encode(sseEvent({
                        type: 'error', message: error.message || 'Streaming error'
                    })));
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('Chat error:', error);
        const userMsg = error.message?.includes('Groq') || error.message?.includes('Gemini')
            ? 'AI service is temporarily unavailable. Please try again.'
            : error.message?.includes('ECONNREFUSED') || error.message?.includes('database')
            ? 'Service is temporarily unavailable. Please try again later.'
            : 'Something went wrong. Please try again.';
        return new Response(JSON.stringify({ error: userMsg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
