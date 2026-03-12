import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, uuidv4 } from '@/lib/db';

export const dynamic = 'force-dynamic';

function getAdminFromCookie(req: NextRequest) {
    const session = req.cookies.get('vero_session');
    if (!session) return null;
    try { return JSON.parse(session.value); } catch { return null; }
}

export async function GET(req: NextRequest) {
    try {
        const admin = getAdminFromCookie(req);
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let info = await queryOne('SELECT * FROM general_info WHERE admin_id = ?', [admin.id]);
        if (!info) {
            // Create default entry
            const id = uuidv4();
            await execute(`INSERT INTO general_info (id, admin_id) VALUES (?, ?)`, [id, admin.id]);
            info = await queryOne('SELECT * FROM general_info WHERE id = ?', [id]);
        }

        return NextResponse.json({ info });
    } catch (err: any) {
        console.error('API Error in GET /api/general-info:', err);
        return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const admin = getAdminFromCookie(req);
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();

        await execute(`
        UPDATE general_info SET 
          business_name=?, address=?, city=?, phone=?, email=?, website=?, maps_link=?, description=?, extra_data=?,
          updated_at=NOW()
        WHERE admin_id=?
      `, [
            body.business_name || '', body.address || '', body.city || '',
            body.phone || '', body.email || '', body.website || '',
            body.maps_link || '', body.description || '', JSON.stringify(body.extra_data || {}),
            admin.id
        ]);

        const info = await queryOne('SELECT * FROM general_info WHERE admin_id = ?', [admin.id]);
        return NextResponse.json({ info });
    } catch (err: any) {
        console.error('API Error in PUT /api/general-info:', err);
        return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
    }
}
