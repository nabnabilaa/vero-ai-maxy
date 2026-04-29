import { NextRequest, NextResponse } from 'next/server';
import { query, execute, uuidv4 } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { agentId, conversationId, rating, feedback } = body;

        if (!agentId || !rating) {
            return NextResponse.json({ error: 'agentId and rating required' }, { status: 400 });
        }

        const id = uuidv4();
        await execute(
            'INSERT INTO conversation_ratings (id, conversation_id, agent_id, rating, feedback) VALUES (?, ?, ?, ?, ?)',
            [id, conversationId || null, agentId, rating, feedback || null]
        );

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: any) {
        console.error('Rating error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET — aggregate ratings for dashboard
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const agentId = searchParams.get('agentId');

        if (!agentId) {
            return NextResponse.json({ error: 'agentId required' }, { status: 400 });
        }

        const stats = await query(`
            SELECT 
                COUNT(*) as total_ratings,
                ROUND(AVG(rating), 1) as avg_rating,
                SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive,
                SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative
            FROM conversation_ratings WHERE agent_id = ?
        `, [agentId]);

        const recent = await query(`
            SELECT rating, feedback, created_at 
            FROM conversation_ratings 
            WHERE agent_id = ? 
            ORDER BY created_at DESC LIMIT 20
        `, [agentId]);

        return NextResponse.json({
            stats: stats[0] || {},
            recent,
        });
    } catch (error: any) {
        console.error('Ratings GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch ratings.' }, { status: 500 });
    }
}
