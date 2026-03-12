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

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '7d'; // 7d, 30d, all

    let dateFilter = '';
    if (period === '7d') dateFilter = 'AND tl.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    else if (period === '30d') dateFilter = 'AND tl.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';

    // Summary totals
    const totals = await queryOne(`
        SELECT 
            COALESCE(SUM(tokens_used), 0) as total_tokens,
            COUNT(*) as total_requests,
            COALESCE(SUM(CASE WHEN from_cache = 1 THEN 1 ELSE 0 END), 0) as cached_requests,
            COALESCE(SUM(CASE WHEN from_cache = 0 THEN tokens_used ELSE 0 END), 0) as ai_tokens,
            COALESCE(SUM(CASE WHEN from_cache = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) as cache_hit_rate
        FROM token_logs tl WHERE tl.admin_id = ? ${dateFilter}
    `, [admin.id]);

    // By source (chat vs voice vs admin)
    const bySource = await query(`
        SELECT tl.source, 
            SUM(tl.tokens_used) as tokens,
            COUNT(*) as requests,
            SUM(CASE WHEN tl.from_cache = 1 THEN 1 ELSE 0 END) as cached
        FROM token_logs tl WHERE tl.admin_id = ? ${dateFilter}
        GROUP BY tl.source ORDER BY tokens DESC
    `, [admin.id]);

    // By agent
    const byAgent = await query(`
        SELECT tl.agent_id, a.name as agent_name,
            SUM(tl.tokens_used) as tokens,
            COUNT(*) as requests,
            SUM(CASE WHEN tl.from_cache = 1 THEN 1 ELSE 0 END) as cached
        FROM token_logs tl
        LEFT JOIN agents a ON tl.agent_id = a.id
        WHERE tl.admin_id = ? ${dateFilter}
        GROUP BY tl.agent_id, a.name ORDER BY tokens DESC
    `, [admin.id]);

    // By action type
    const byAction = await query(`
        SELECT tl.action,
            SUM(tl.tokens_used) as tokens,
            COUNT(*) as requests
        FROM token_logs tl WHERE tl.admin_id = ? ${dateFilter}
        GROUP BY tl.action ORDER BY tokens DESC
    `, [admin.id]);

    // Daily trend (last 7 or 30 days)
    const dailyTrend = await query(`
        SELECT DATE(tl.created_at) as date,
            SUM(tl.tokens_used) as tokens,
            COUNT(*) as requests,
            SUM(CASE WHEN tl.from_cache = 1 THEN 1 ELSE 0 END) as cached
        FROM token_logs tl WHERE tl.admin_id = ? ${dateFilter}
        GROUP BY DATE(tl.created_at) ORDER BY date ASC
    `, [admin.id]);

    // Recent logs (last 20)
    const recentLogs = await query(`
        SELECT tl.id, tl.source, tl.action, tl.tokens_used, tl.from_cache, tl.created_at,
            a.name as agent_name
        FROM token_logs tl
        LEFT JOIN agents a ON tl.agent_id = a.id
        WHERE tl.admin_id = ?
        ORDER BY tl.created_at DESC LIMIT 20
    `, [admin.id]);

    // Token savings estimate
    const savings = await queryOne(`
        SELECT 
            COALESCE(SUM(CASE WHEN tl.from_cache = 1 THEN 
                (SELECT AVG(tokens_used) FROM token_logs WHERE admin_id = ? AND from_cache = 0)
            ELSE 0 END), 0) as estimated_saved_tokens
        FROM token_logs tl WHERE tl.admin_id = ? AND tl.from_cache = 1 ${dateFilter}
    `, [admin.id, admin.id]);

    return NextResponse.json({
        period,
        totals: {
            totalTokens: totals?.total_tokens || 0,
            totalRequests: totals?.total_requests || 0,
            cachedRequests: totals?.cached_requests || 0,
            aiTokens: totals?.ai_tokens || 0,
            cacheHitRate: Math.round(totals?.cache_hit_rate || 0),
            estimatedSaved: Math.round(savings?.estimated_saved_tokens || 0),
        },
        bySource,
        byAgent,
        byAction,
        dailyTrend,
        recentLogs,
    });
}
