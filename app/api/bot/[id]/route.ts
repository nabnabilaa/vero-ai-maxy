import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

// Public endpoint - get agent config for bot page (no auth needed)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const agent = await queryOne(`
    SELECT id, name, role, tone, language, voice_type, quick_actions, instructions, goal, industry, is_active, admin_id
    FROM agents WHERE id = ? AND is_active = 1
  `, [id]);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found or inactive' }, { status: 404 });
  }

  // Get business info for the admin who owns this agent
  const businessInfo = await queryOne(`
    SELECT business_name, address, city, maps_link, phone, website, extra_data 
    FROM general_info WHERE admin_id = ?
  `, [agent.admin_id]);

  return NextResponse.json({ agent, business: businessInfo || null });
}
