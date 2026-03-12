import { NextRequest, NextResponse } from 'next/server';
import { query, execute, uuidv4 } from '@/lib/db';

/**
 * Cron API for monthly viral/trending data refresh.
 * 
 * Call this endpoint monthly (via cron job, Vercel cron, or manual trigger)
 * to refresh viral/trending knowledge sources whose data is older than 30 days.
 * 
 * GET /api/cron/refresh-viral — check what needs refreshing
 * POST /api/cron/refresh-viral — perform the refresh
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

async function callGroq(prompt: string) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 1024,
        }),
    });
    if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`Groq API Error: ${res.status} ${err}`);
    }
    try {
        const data = await res.json();
        return data.choices[0]?.message?.content || '';
    } catch {
        return '';
    }
}

export async function GET() {
    // List sources that are stale (> 30 days or never refreshed) and marked for auto-refresh
    const stale = await query(`
        SELECT id, name, admin_id, last_refreshed, 
            DATEDIFF(NOW(), COALESCE(last_refreshed, created_at)) as days_old
        FROM general_knowledge_sources 
        WHERE auto_refresh = 1 
        AND (last_refreshed IS NULL OR last_refreshed < DATE_SUB(NOW(), INTERVAL 30 DAY))
        ORDER BY days_old DESC
    `, []);

    const allAutoRefresh = await query(`
        SELECT id, name, admin_id, last_refreshed, auto_refresh
        FROM general_knowledge_sources WHERE auto_refresh = 1
    `, []);

    return NextResponse.json({
        needsRefresh: stale.length,
        staleSources: stale,
        allAutoRefreshSources: allAutoRefresh,
        message: stale.length > 0
            ? `${stale.length} sumber perlu di-refresh (data > 30 hari)`
            : 'Semua data masih fresh (< 30 hari)',
    });
}

export async function POST(req: NextRequest) {
    if (!GROQ_API_KEY) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });

    // Find stale auto-refresh sources
    const stale = await query(`
        SELECT gks.*, gi.business_name, gi.city, gi.address
        FROM general_knowledge_sources gks
        LEFT JOIN general_info gi ON gks.admin_id = gi.admin_id
        WHERE gks.auto_refresh = 1 
        AND (gks.last_refreshed IS NULL OR gks.last_refreshed < DATE_SUB(NOW(), INTERVAL 30 DAY))
    `, []);

    if (stale.length === 0) {
        return NextResponse.json({ message: 'Tidak ada data yang perlu di-refresh', refreshed: 0 });
    }

    const results: { id: string; name: string; status: string; tokensEstimate: number }[] = [];

    for (const source of stale) {
        try {
            const city = source.city || 'Bandar Lampung';
            const bizName = source.business_name || '';
            const sourceName = source.name || '';

            // Determine what kind of viral/trending data to generate
            let prompt = '';
            if (sourceName.toLowerCase().includes('viral') || sourceName.toLowerCase().includes('trending')) {
                prompt = `Berikan daftar tempat, makanan, dan aktivitas yang sedang VIRAL dan TRENDING di ${city}${bizName ? ` (sekitar ${bizName})` : ''} per ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}.

Sertakan:
1. 5 tempat makan viral saat ini (nama, alamat singkat, kenapa viral, kisaran harga)
2. 3 tempat wisata/destinasi yang lagi hits
3. 3 aktivitas/event yang menarik bulan ini
4. 2 makanan/minuman yang lagi trend

Format dalam paragraf singkat dan informatif yang bisa langsung digunakan sebagai referensi chatbot. Tulis dalam Bahasa Indonesia.`;
            } else {
                prompt = `Update informasi terbaru tentang "${sourceName}" di ${city}${bizName ? ` (dekat ${bizName})` : ''} per ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}.

Berikan informasi terkini yang relevan, termasuk perubahan terbaru, tren, dan rekomendasi. Tulis dalam Bahasa Indonesia, format paragraf singkat yang informatif.`;
            }

            const newContent = await callGroq(prompt);

            if (newContent && newContent.length > 50) {
                // Update the source content
                await execute(
                    `UPDATE general_knowledge_sources SET content = ?, last_refreshed = NOW() WHERE id = ?`,
                    [newContent, source.id]
                );

                // Clear related response cache since knowledge changed
                await execute(
                    `DELETE FROM response_cache WHERE agent_id IN (SELECT id FROM agents WHERE admin_id = ?)`,
                    [source.admin_id]
                );

                results.push({ id: source.id, name: sourceName, status: 'refreshed', tokensEstimate: Math.ceil(newContent.length / 4) });
            } else {
                results.push({ id: source.id, name: sourceName, status: 'skipped (empty response)', tokensEstimate: 0 });
            }
        } catch (err: any) {
            results.push({ id: source.id, name: source.name, status: `error: ${err.message}`, tokensEstimate: 0 });
        }
    }

    return NextResponse.json({
        message: `Refresh selesai: ${results.filter(r => r.status === 'refreshed').length}/${stale.length} sumber berhasil di-update`,
        results,
        nextRefresh: '30 hari dari sekarang',
    });
}
