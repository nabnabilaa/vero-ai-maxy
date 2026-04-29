import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
    try {
        let { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
        }

        email = email.trim();
        password = password.trim();

        const admin = await queryOne('SELECT * FROM admins WHERE email = ?', [email]);
        if (!admin) {
            console.log('Login failed: user not found for email', email);
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const valid = bcrypt.compareSync(password, admin.password_hash);
        if (!valid) {
            console.log('Login failed: password mismatch for user', email);
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const { password_hash, ...adminData } = admin;

        const response = NextResponse.json({ success: true, admin: adminData });
        response.cookies.set('vero_session', JSON.stringify({ id: admin.id, email: admin.email, industry: admin.industry }), {
            httpOnly: false,
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error: any) {
        console.error('Auth error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('vero_session');
    return response;
}
