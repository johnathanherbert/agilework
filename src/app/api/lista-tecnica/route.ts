import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const materiaPrima = searchParams.get('materia_prima');
  const semiAcabado = searchParams.get('semi_acabado');
  const search = searchParams.get('search');
  const ativo = searchParams.get('ativo');
  const codigoReceita = searchParams.get('codigo_receita');
  const sugestoes = searchParams.get('sugestoes');

  const client = await pool.connect();
  try {
    // Autocomplete de sugestões de ativos/semi-acabados
    if (sugestoes) {
      const q = `%${sugestoes.trim().toLowerCase()}%`;
      const result = await client.query(
        `SELECT DISTINCT descricao_semi_acabado as ativo
         FROM lista_tecnica
         WHERE LOWER(descricao_semi_acabado) LIKE $1
         ORDER BY descricao_semi_acabado ASC
         LIMIT 15`,
        [q]
      );
      return NextResponse.json(result.rows.map(r => r.ativo));
    }

    // Busca por código da receita / semi-acabado (ex: 700013, 701171)
    if (codigoReceita) {
      const trimmed = codigoReceita.trim();
      const padded = trimmed.padStart(6, '0');
      const unpadded = trimmed.replace(/^0+/, '') || '0';
      const result = await client.query(
        `SELECT id,
                semi_acabado as "Codigo_Receita",
                descricao_semi_acabado as "Ativo",
                materia_prima as "codigo_materia_prima",
                descricao_materia_prima as "Excipiente",
                qtd_materia_prima,
                un_materia_prima,
                concatenar,
                status
         FROM lista_tecnica
         WHERE semi_acabado = $1 OR semi_acabado = $2 OR semi_acabado = $3
         ORDER BY descricao_materia_prima ASC`,
        [trimmed, padded, unpadded]
      );
      return NextResponse.json(result.rows);
    }

    // Busca por nome do ativo (ex: ACIDO ACETIL SALICILICO)
    if (ativo) {
      const trimmed = ativo.trim();
      const q = `%${trimmed.toLowerCase()}%`;
      const result = await client.query(
        `SELECT id,
                semi_acabado as "Codigo_Receita",
                descricao_semi_acabado as "Ativo",
                materia_prima as "codigo_materia_prima",
                descricao_materia_prima as "Excipiente",
                qtd_materia_prima,
                un_materia_prima,
                concatenar,
                status
         FROM lista_tecnica
         WHERE LOWER(descricao_semi_acabado) = LOWER($1) OR LOWER(descricao_semi_acabado) LIKE $2
         ORDER BY descricao_materia_prima ASC`,
        [trimmed, q]
      );
      return NextResponse.json(result.rows);
    }

    if (materiaPrima) {
      const normalized = materiaPrima.trim().padStart(6, '0');
      const result = await client.query(
        `SELECT id, concatenar, status, semi_acabado, descricao_semi_acabado,
                qtd_semi_acabado, centro_semi_acabado, materia_prima,
                descricao_materia_prima, qtd_materia_prima, un_materia_prima
         FROM lista_tecnica
         WHERE materia_prima = $1 OR materia_prima = $2
         ORDER BY descricao_semi_acabado ASC`,
        [normalized, materiaPrima.trim()]
      );
      return NextResponse.json(result.rows);
    }

    if (semiAcabado) {
      const normalized = semiAcabado.trim().padStart(6, '0');
      const result = await client.query(
        `SELECT id, concatenar, status, semi_acabado, descricao_semi_acabado,
                qtd_semi_acabado, centro_semi_acabado, materia_prima,
                descricao_materia_prima, qtd_materia_prima, un_materia_prima
         FROM lista_tecnica
         WHERE semi_acabado = $1 OR semi_acabado = $2
         ORDER BY materia_prima ASC`,
        [normalized, semiAcabado.trim()]
      );
      return NextResponse.json(result.rows);
    }

    if (search) {
      const q = `%${search.trim().toLowerCase()}%`;
      const result = await client.query(
        `SELECT id, concatenar, status, semi_acabado, descricao_semi_acabado,
                qtd_semi_acabado, centro_semi_acabado, materia_prima,
                descricao_materia_prima, qtd_materia_prima, un_materia_prima
         FROM lista_tecnica
         WHERE LOWER(materia_prima) LIKE $1
            OR LOWER(descricao_materia_prima) LIKE $1
            OR LOWER(semi_acabado) LIKE $1
            OR LOWER(descricao_semi_acabado) LIKE $1
         ORDER BY descricao_materia_prima ASC, descricao_semi_acabado ASC
         LIMIT 200`,
        [q]
      );
      return NextResponse.json(result.rows);
    }

    // Default: primeiros 100 registros
    const result = await client.query(
      `SELECT id, concatenar, status, semi_acabado, descricao_semi_acabado,
              qtd_semi_acabado, centro_semi_acabado, materia_prima,
              descricao_materia_prima, qtd_materia_prima, un_materia_prima
       FROM lista_tecnica
       ORDER BY materia_prima ASC, semi_acabado ASC
       LIMIT 100`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[API /api/lista-tecnica GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar lista técnica' }, { status: 500 });
  } finally {
    client.release();
  }
}
