'use client';

import React, { useMemo } from 'react';
import { AgingData, DashboardSnapshot, ConfiguracaoResiduais } from '@/types/aging';
import { Button } from '@/components/ui/button';

interface AgingFinancialProps {
  data: AgingData[];
  allData?: AgingData[];
  valores: Record<string, number>;
  selectedCriticality?: string | null;
  onCriticalityChange?: (crit: string | null) => void;
  selectedMaterial?: string;
  onMaterialChange?: (material: string | undefined) => void;
  configResiduais?: ConfiguracaoResiduais;
}

export function AgingFinancial({
  data,
  allData,
  valores,
  selectedCriticality = null,
  onCriticalityChange,
  selectedMaterial,
  onMaterialChange,
  configResiduais,
}: AgingFinancialProps) {
  const diasAlerta = configResiduais?.dias_alerta ?? 7;
  const diasCritico = configResiduais?.dias_critico ?? 15;

  const dataset = data;
  const fullData = allData || data;

  // Cálculos de valorização e métricas
  const stats = useMemo(() => {
    let totalValor = 0;
    const byPos: Record<string, { valor: number; count: number }> = {
      PESAGEM: { valor: 0, count: 0 },
      AJUSTE: { valor: 0, count: 0 },
      'AJU-SAIDA': { valor: 0, count: 0 },
    };

    const critStats = {
      ok: { valor: 0, count: 0, materiais: new Set<string>() },
      al: { valor: 0, count: 0, materiais: new Set<string>() },
      cr: { valor: 0, count: 0, materiais: new Set<string>() },
    };

    const materialBreakdown: Record<
      string,
      { mat: string; desc: string; valorTotal: number; ok: number; al: number; cr: number }
    > = {};

    for (const item of dataset) {
      const mat = item.material;
      const vu = valores[mat] || valores[mat.replace(/^0+/, '')] || 0;
      const qtd = Number(item.estoque_disponivel) || 0;
      const vt = Math.max(0, qtd) * vu;
      const dias = item.dias_aging || 0;

      totalValor += vt;

      const pos = item.posicao_deposito || 'PESAGEM';
      if (byPos[pos]) {
        byPos[pos].valor += vt;
        byPos[pos].count += 1;
      }

      let c: 'ok' | 'al' | 'cr' = 'ok';
      if (dias > diasCritico) c = 'cr';
      else if (dias >= diasAlerta) c = 'al';

      critStats[c].valor += vt;
      critStats[c].count += 1;
      critStats[c].materiais.add(mat);

      // Agrupamento por material para o Top 10
      if (!selectedCriticality || selectedCriticality === c) {
        if (!materialBreakdown[mat]) {
          materialBreakdown[mat] = {
            mat,
            desc: item.texto_breve_material || '',
            valorTotal: 0,
            ok: 0,
            al: 0,
            cr: 0,
          };
        }
        materialBreakdown[mat].valorTotal += vt;
        materialBreakdown[mat][c] += vt;
      }
    }

    const top10 = Object.values(materialBreakdown)
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .slice(0, 10);

    const maxTopVal = top10.length > 0 ? top10[0].valorTotal : 1;

    return {
      totalValor,
      byPos,
      critStats,
      top10,
      maxTopVal,
    };
  }, [dataset, valores, diasAlerta, diasCritico, selectedCriticality]);

  const formatBRL = (v: number) => {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPct = (val: number, tot: number) => {
    if (!tot) return '0%';
    return `${Math.round((val / tot) * 100)}%`;
  };

  const getBarWidth = (val: number, tot: number) => {
    if (!tot || val <= 0) return '0%';
    return `${Math.min(100, Math.max(2, (val / tot) * 100))}%`;
  };

  return (
    <div>
      {/* 6 Métricas de Valorização (.vals) */}
      <div className="vals">
        {/* 1. Valor Total */}
        <div>
          <label>Valor total</label>
          <strong>{formatBRL(stats.totalValor)}</strong>
          <small>{dataset.length} de {fullData.length} lotes</small>
          <div className="bar">
            <span style={{ width: getBarWidth(stats.totalValor, stats.totalValor) }} />
          </div>
        </div>

        {/* 2. Valorização Pesagem */}
        <div>
          <label>Valorização pesagem</label>
          <strong>{formatBRL(stats.byPos.PESAGEM.valor)}</strong>
          <small>{stats.byPos.PESAGEM.count} lotes · {formatPct(stats.byPos.PESAGEM.valor, stats.totalValor)}</small>
          <div className="bar">
            <span style={{ width: getBarWidth(stats.byPos.PESAGEM.valor, stats.totalValor) }} />
          </div>
        </div>

        {/* 3. Valorização Ajuste */}
        <div>
          <label>Valorização ajuste</label>
          <strong>{formatBRL(stats.byPos.AJUSTE.valor)}</strong>
          <small>{stats.byPos.AJUSTE.count} lotes · {formatPct(stats.byPos.AJUSTE.valor, stats.totalValor)}</small>
          <div className="bar">
            <span style={{ width: getBarWidth(stats.byPos.AJUSTE.valor, stats.totalValor) }} />
          </div>
        </div>

        {/* 4. Valorização AJU-SAÍDA */}
        <div>
          <label>Valorização AJU-SAÍDA</label>
          <strong>{formatBRL(stats.byPos['AJU-SAIDA'].valor)}</strong>
          <small>{stats.byPos['AJU-SAIDA'].count} lotes · {formatPct(stats.byPos['AJU-SAIDA'].valor, stats.totalValor)}</small>
          <div className="bar">
            <span style={{ width: getBarWidth(stats.byPos['AJU-SAIDA'].valor, stats.totalValor) }} />
          </div>
        </div>

        {/* 5. Valor em Alerta */}
        <div>
          <label>Valor em alerta</label>
          <strong className="c-al">{formatBRL(stats.critStats.al.valor)}</strong>
          <small>{stats.critStats.al.count} lotes · {diasAlerta}–{diasCritico} d</small>
          <div className="bar">
            <span style={{ width: getBarWidth(stats.critStats.al.valor, stats.totalValor), background: 'var(--amber)' }} />
          </div>
        </div>

        {/* 6. Valor Crítico */}
        <div>
          <label>Valor crítico</label>
          <strong className="c-cr">{formatBRL(stats.critStats.cr.valor)}</strong>
          <small>{stats.critStats.cr.count} lotes · &gt; {diasCritico} d</small>
          <div className="bar">
            <span style={{ width: getBarWidth(stats.critStats.cr.valor, stats.totalValor), background: 'var(--red)' }} />
          </div>
        </div>
      </div>

      {/* Painel Dividido (.ov) */}
      <div className="ov">
        {/* Coluna Esquerda: Valor por Criticidade */}
        <section>
          <div className="sec-h">
            <b>Valor por criticidade</b>
            {selectedCriticality ? (
              <button type="button" onClick={() => onCriticalityChange?.(null)}>
                limpar filtro
              </button>
            ) : (
              <span>clique para filtrar</span>
            )}
          </div>

          {/* Barra Proporcional Segmentada (.cbar) */}
          <div className={`cbar ${selectedCriticality ? 'sel' : ''}`}>
            <span
              onClick={() => onCriticalityChange?.(selectedCriticality === 'ok' ? null : 'ok')}
              title={`Normal: ${formatBRL(stats.critStats.ok.valor)}`}
              className={selectedCriticality === 'ok' ? 'on' : ''}
              style={{
                width: `${(stats.critStats.ok.valor / (stats.totalValor || 1)) * 100}%`,
                background: 'var(--green)',
              }}
            />
            <span
              onClick={() => onCriticalityChange?.(selectedCriticality === 'al' ? null : 'al')}
              title={`Alerta: ${formatBRL(stats.critStats.al.valor)}`}
              className={selectedCriticality === 'al' ? 'on' : ''}
              style={{
                width: `${(stats.critStats.al.valor / (stats.totalValor || 1)) * 100}%`,
                background: 'var(--amber)',
              }}
            />
            <span
              onClick={() => onCriticalityChange?.(selectedCriticality === 'cr' ? null : 'cr')}
              title={`Crítico: ${formatBRL(stats.critStats.cr.valor)}`}
              className={selectedCriticality === 'cr' ? 'on' : ''}
              style={{
                width: `${(stats.critStats.cr.valor / (stats.totalValor || 1)) * 100}%`,
                background: 'var(--red)',
              }}
            />
          </div>

          {/* Linhas de Faixas de Criticidade (.crow) */}
          <div id="crows">
            {/* Linha Normal */}
            <div
              onClick={() => onCriticalityChange?.(selectedCriticality === 'ok' ? null : 'ok')}
              className={`crow ${selectedCriticality === 'ok' ? 'on' : ''}`}
            >
              <span className="dot" style={{ background: 'var(--green)' }} />
              <b>
                Normal
                <small>&lt; {diasAlerta} d</small>
              </b>
              <span className="v">{formatBRL(stats.critStats.ok.valor)}</span>
              <span className="p">{formatPct(stats.critStats.ok.valor, stats.totalValor)}</span>
              <span className="m">
                {stats.critStats.ok.materiais.size} mat · {stats.critStats.ok.count} lotes
              </span>
            </div>

            {/* Linha Alerta */}
            <div
              onClick={() => onCriticalityChange?.(selectedCriticality === 'al' ? null : 'al')}
              className={`crow ${selectedCriticality === 'al' ? 'on' : ''}`}
            >
              <span className="dot" style={{ background: 'var(--amber)' }} />
              <b>
                Alerta
                <small>{diasAlerta}–{diasCritico} d</small>
              </b>
              <span className="v c-al">{formatBRL(stats.critStats.al.valor)}</span>
              <span className="p">{formatPct(stats.critStats.al.valor, stats.totalValor)}</span>
              <span className="m">
                {stats.critStats.al.materiais.size} mat · {stats.critStats.al.count} lotes
              </span>
            </div>

            {/* Linha Crítico */}
            <div
              onClick={() => onCriticalityChange?.(selectedCriticality === 'cr' ? null : 'cr')}
              className={`crow ${selectedCriticality === 'cr' ? 'on' : ''}`}
            >
              <span className="dot" style={{ background: 'var(--red)' }} />
              <b>
                Crítico
                <small>&gt; {diasCritico} d</small>
              </b>
              <span className="v c-cr">{formatBRL(stats.critStats.cr.valor)}</span>
              <span className="p">{formatPct(stats.critStats.cr.valor, stats.totalValor)}</span>
              <span className="m">
                {stats.critStats.cr.materiais.size} mat · {stats.critStats.cr.count} lotes
              </span>
            </div>
          </div>
        </section>

        {/* Coluna Direita: Top 10 Materiais por Valor Total */}
        <section>
          <div className="sec-h">
            <b>
              Top 10 materiais por valor total
              {selectedCriticality && (
                <span className="font-normal text-[var(--text-3)] ml-1">
                  · {selectedCriticality === 'ok' ? 'normal' : selectedCriticality === 'al' ? 'alerta' : 'crítico'}
                </span>
              )}
            </b>
            {selectedMaterial ? (
              <button type="button" onClick={() => onMaterialChange?.(undefined)}>
                limpar material ({selectedMaterial})
              </button>
            ) : (
              <span>clique para filtrar a tabela</span>
            )}
          </div>

          {/* Lista do Top 10 (.top) */}
          <div id="topList">
            {stats.top10.length === 0 ? (
              <div className="empty" style={{ border: 0 }}>
                Sem valores.
              </div>
            ) : (
              stats.top10.map((m, index) => {
                const isSelected = selectedMaterial === m.mat;
                const barWidth = `${Math.max(2, (m.valorTotal / stats.maxTopVal) * 100)}%`;

                return (
                  <div
                    key={m.mat}
                    onClick={() => onMaterialChange?.(isSelected ? undefined : m.mat)}
                    className={`top ${isSelected ? 'on' : ''}`}
                  >
                    <span className="r">{index + 1}</span>
                    <b>{m.mat}</b>
                    <em title={m.desc}>{m.desc.replace(/\*\*/g, '')}</em>
                    <div className="tb" style={{ width: barWidth }}>
                      {m.ok > 0 && (
                        <i
                          style={{
                            width: `${(m.ok / m.valorTotal) * 100}%`,
                            background: 'var(--green)',
                          }}
                        />
                      )}
                      {m.al > 0 && (
                        <i
                          style={{
                            width: `${(m.al / m.valorTotal) * 100}%`,
                            background: 'var(--amber)',
                          }}
                        />
                      )}
                      {m.cr > 0 && (
                        <i
                          style={{
                            width: `${(m.cr / m.valorTotal) * 100}%`,
                            background: 'var(--red)',
                          }}
                        />
                      )}
                    </div>
                    <span className="v">{formatBRL(m.valorTotal)}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
