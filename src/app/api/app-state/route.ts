import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function ensureTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      state JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_state_user_id ON app_state(user_id)
  `);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id') || 'default_user';

  const client = await pool.connect();
  try {
    await ensureTable(client);
    const result = await client.query(
      `SELECT state FROM app_state WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ state: null });
    }
    return NextResponse.json({ state: result.rows[0].state });
  } catch (error) {
    console.error('[API /api/app-state GET]', error);
    return NextResponse.json({ error: 'Erro ao carregar app_state' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const body = await request.json();
    const { user_id = 'default_user', state } = body;

    const result = await client.query(
      `INSERT INTO app_state (user_id, state, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
       RETURNING *`,
      [user_id, JSON.stringify(state)]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[API /api/app-state POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar app_state' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  const client = await pool.connect();
  try {
    await ensureTable(client);
    if (userId) {
      await client.query(`DELETE FROM app_state WHERE user_id = $1`, [userId]);
    } else {
      await client.query(`DELETE FROM app_state`);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /api/app-state DELETE]', error);
    return NextResponse.json({ error: 'Erro ao limpar app_state' }, { status: 500 });
  } finally {
    client.release();
  }
}
