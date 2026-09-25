import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function ensureTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS solicitacoes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      codigo_mp TEXT NOT NULL,
      nome_mp TEXT NOT NULL,
      quantidade_solicitada NUMERIC NOT NULL,
      unidade TEXT NOT NULL DEFAULT 'kg',
      status TEXT NOT NULL DEFAULT 'pendente',
      prioridade TEXT NOT NULL DEFAULT 'media',
      solicitante TEXT NOT NULL,
      observacoes TEXT,
      data_necessidade TEXT NOT NULL,
      produto_destino TEXT
    )
  `);
  
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_solicitacoes_created_at ON solicitacoes(created_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes(status)
  `);
}

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    await ensureTable(client);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = 'SELECT * FROM solicitacoes';
    const params: string[] = [];

    if (status && status !== 'todos') {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await client.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[API /api/solicitacoes GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar solicitações' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    await ensureTable(client);

    const body = await request.json();
    const {
      codigo_mp,
      nome_mp,
      quantidade_solicitada,
      unidade = 'kg',
      prioridade = 'media',
      solicitante,
      data_necessidade,
      produto_destino,
      observacoes,
    } = body;

    if (!codigo_mp || !nome_mp || !quantidade_solicitada || !solicitante || !data_necessidade) {
      return NextResponse.json(
        { error: 'Campos obrigatórios não preenchidos' },
        { status: 400 }
      );
    }

    const result = await client.query(
      `INSERT INTO solicitacoes 
        (codigo_mp, nome_mp, quantidade_solicitada, unidade, prioridade, solicitante, data_necessidade, produto_destino, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        codigo_mp,
        nome_mp,
        quantidade_solicitada,
        unidade,
        prioridade,
        solicitante,
        data_necessidade,
        produto_destino || null,
        observacoes || null,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('[API /api/solicitacoes POST]', error);
    return NextResponse.json({ error: 'Erro ao criar solicitação' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(request: NextRequest) {
  const client = await pool.connect();
  try {
    await ensureTable(client);

    const body = await request.json();
    const { id, status, prioridade, observacoes } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (prioridade) {
      updates.push(`prioridade = $${paramIndex++}`);
      values.push(prioridade);
    }
    if (observacoes !== undefined) {
      updates.push(`observacoes = $${paramIndex++}`);
      values.push(observacoes);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE solicitacoes SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('[API /api/solicitacoes PUT]', error);
    return NextResponse.json({ error: 'Erro ao atualizar solicitação' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const result = await client.query(
      'DELETE FROM solicitacoes WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('[API /api/solicitacoes DELETE]', error);
    return NextResponse.json({ error: 'Erro ao excluir solicitação' }, { status: 500 });
  } finally {
    client.release();
  }
}
