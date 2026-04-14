import { NextRequest, NextResponse } from 'next/server';
import { query, execute, uuidv4 } from '@/lib/db';
import { isGeneralUrl, scrapeSinglePage, crawlSite } from '@/lib/scraper';
import { parseFileContent } from '@/lib/file-parser';

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
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });

    const sources = await query('SELECT * FROM knowledge_sources WHERE agent_id = ? ORDER BY date_added DESC', [agentId]);
    return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const id = uuidv4();
    let finalContent = body.content || '';
    let finalName = body.name || 'Source';

    // Handle URL scraping
    if (body.type === 'url') {
        try {
            const url = new URL(body.content);
            const general = isGeneralUrl(url);

            console.log(`[Agent Knowledge] URL "${body.content}" classified as: ${general ? 'GENERAL (deep crawl)' : 'SPECIFIC (single page)'}`);

            if (general) {
                const result = await crawlSite(body.content);
                finalName = `🌐 ${result.siteName} (${result.pagesCrawled} pages)`;
                finalContent = result.fullContent;
            } else {
                const result = await scrapeSinglePage(body.content);
                finalName = result.title || body.content;
                finalContent = `# ${finalName}\nURL: ${body.content}\n\n${result.markdown}`;
            }

            if (!finalContent || finalContent.length < 50) {
                return NextResponse.json({
                    error: 'Website tidak memiliki konten yang cukup atau memblokir bot. Coba URL lain.'
                }, { status: 400 });
            }

        } catch (e: any) {
            console.error('URL Scrape Error:', e);
            return NextResponse.json({ error: 'Gagal mengekstrak URL: ' + e.message }, { status: 400 });
        }
    }
    // Handle file upload — parse content from base64
    else if (body.type === 'file') {
        try {
            finalContent = await parseFileContent(body.content, body.mimeType || 'application/octet-stream', body.name);
            finalName = body.name;
        } catch (e: any) {
            console.error('File parse error:', e);
            finalContent = `[File: ${body.name} — parse failed]`;
        }
    }
    else {
        finalName = body.name;
    }

    await execute(`
    INSERT INTO knowledge_sources (id, agent_id, type, name, content, mime_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, body.agentId, body.type, finalName, finalContent, body.mimeType || 'text/plain']);

    // ── Invalidate response cache for this agent ──
    try {
        await execute('DELETE FROM response_cache WHERE agent_id = ?', [body.agentId]);
    } catch { /* ignore if table doesn't exist yet */ }

    return NextResponse.json({ id, name: finalName, success: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const agentId = searchParams.get('agentId');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await execute('DELETE FROM knowledge_sources WHERE id = ?', [id]);

    // ── Invalidate cache when knowledge is deleted ──
    if (agentId) {
        try { await execute('DELETE FROM response_cache WHERE agent_id = ?', [agentId]); } catch { }
    }

    return NextResponse.json({ success: true });
}
