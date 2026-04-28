import { NextRequest, NextResponse } from 'next/server';
import { query, execute, uuidv4 } from '@/lib/db';
import { scrapeSinglePage, crawlSite } from '@/lib/scraper';
import { parseFileContent } from '@/lib/file-parser';

function getAdminFromCookie(req: NextRequest) {
    const session = req.cookies.get('vero_session');
    if (!session) return null;
    try { return JSON.parse(session.value); } catch { return null; }
}

// ─── API Routes ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sources = await query('SELECT * FROM general_knowledge_sources WHERE admin_id = ? ORDER BY date_added DESC', [admin.id]);
    return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const id = uuidv4();
    let finalContent = body.content || '';
    let finalName = body.name || 'URL Source';

    if (body.type === 'url') {
        try {
            const crawlMode = body.crawlMode || 'single';
            
            const urlObj = new URL(body.content);
            const keysToRemove = [];
            for (const key of urlObj.searchParams.keys()) {
                if (key.startsWith('_gl') || key.startsWith('_ga') || key.startsWith('_gcl') || key === 'fbclid' || key.startsWith('utm_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => urlObj.searchParams.delete(k));
            const cleanUrl = urlObj.toString();

            console.log(`[Knowledge] URL "${cleanUrl}" — mode: ${crawlMode === 'full' ? 'FULL SITE CRAWL' : 'SINGLE PAGE'}`);

            if (crawlMode === 'full') {
                // ─── Deep Crawl Mode ───
                const result = await crawlSite(cleanUrl);
                if (result.pagesCrawled === 0) {
                    return NextResponse.json({
                        error: 'Website tidak memiliki konten yang cukup atau memblokir bot (perlindungan ketat). Coba masukkan informasi secara manual.'
                    }, { status: 400 });
                }
                finalName = `🌐 ${result.siteName} (${result.pagesCrawled} pages)`;
                finalContent = result.fullContent;
            } else {
                // ─── Single Page Mode ───
                const result = await scrapeSinglePage(cleanUrl);
                if (!result.markdown || result.markdown.length < 50) {
                    return NextResponse.json({
                        error: 'Website tidak memiliki konten yang cukup atau memblokir bot (perlindungan ketat). Coba URL lain.'
                    }, { status: 400 });
                }
                finalName = result.title || cleanUrl;
                finalContent = `# ${finalName}\nURL: ${cleanUrl}\n\n${result.markdown}`;
            }

        } catch (e: any) {
            console.error('URL Scrape Error:', e);
            return NextResponse.json({ error: 'Gagal mengekstrak URL: ' + e.message }, { status: 400 });
        }
    } else if (body.type === 'file') {
        // Parse file content (PDF, TXT, CSV)
        try {
            finalContent = await parseFileContent(body.content, body.mimeType || 'application/octet-stream', body.name);
            finalName = body.name;
        } catch (e: any) {
            console.error('File parse error:', e);
            finalContent = `[File: ${body.name} — parse failed]`;
        }
    } else {
        finalName = body.name;
    }

    await execute(`
    INSERT INTO general_knowledge_sources (id, admin_id, type, name, content, mime_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, admin.id, body.type, finalName, finalContent, body.mimeType || 'text/plain']);

    // ── Invalidate response cache for ALL agents of this admin ──
    try {
        await execute(
            'DELETE FROM response_cache WHERE agent_id IN (SELECT id FROM agents WHERE admin_id = ?)',
            [admin.id]
        );
    } catch { /* ignore */ }

    return NextResponse.json({ id, success: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await execute('DELETE FROM general_knowledge_sources WHERE id = ? AND admin_id = ?', [id, admin.id]);

    // ── Invalidate cache for all admin's agents ──
    try {
        await execute(
            'DELETE FROM response_cache WHERE agent_id IN (SELECT id FROM agents WHERE admin_id = ?)',
            [admin.id]
        );
    } catch { /* ignore */ }

    return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
    const admin = getAdminFromCookie(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { id, name, content } = body;
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const updates: string[] = [];
        const params: any[] = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (content !== undefined) { updates.push('content = ?'); params.push(content); }

        if (updates.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

        params.push(id, admin.id);
        await execute(`UPDATE general_knowledge_sources SET ${updates.join(', ')} WHERE id = ? AND admin_id = ?`, params);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PATCH Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
