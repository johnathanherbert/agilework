import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const material = searchParams.get('material');
  const deposito = searchParams.get('deposito');

  const client = await pool.connect();
  try {
    if (material) {
      const normalized = material.trim().padStart(6, '0');
      const unpadded = material.trim().replace(/^0+/, '');
      let query = `
        SELECT * FROM aging_estoque 
        WHERE material = $1 OR material = $2 OR material = $3
      `;
      const params = [material.trim(), normalized, unpadded];
      if (deposito) {
        query += ` AND deposito = $4`;
        params.push(deposito);
      }
      query += ` ORDER BY data_vencimento ASC NULLS LAST`;

      const result = await client.query(query, params);
      return NextResponse.json(result.rows);
    }

    const result = await client.query(
      'SELECT * FROM aging_estoque ORDER BY created_at DESC'
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[API /api/aging GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar dados de aging' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const data: any[] = await request.json();

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Nenhum dado enviado' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM aging_estoque');

    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      for (const row of batch) {
        await client.query(
          `INSERT INTO aging_estoque (
            material, texto_breve_material, unidade_medida, lote, centro,
            deposito, tipo_deposito, posicao_deposito, estoque_disponivel,
            data_vencimento, ultimo_movimento, tipo_estoque,
            ultima_entrada_deposito, dias_aging
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            row.material,
            row.texto_breve_material,
            row.unidade_medida || 'KG',
            row.lote || 'N/A',
            row.centro || '600',
            row.deposito || 'PES',
            row.tipo_deposito || 'PES',
            row.posicao_deposito || 'PESAGEM',
            row.estoque_disponivel || 0,
            row.data_vencimento ?? null,
            row.ultimo_movimento ?? null,
            row.tipo_estoque ?? null,
            row.ultima_entrada_deposito ?? null,
            row.dias_aging ?? null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, count: data.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[API /api/aging POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar dados de aging' }, { status: 500 });
  } finally {
    client.release();
  }
}
