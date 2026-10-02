'use client';

import React, { useMemo } from 'react';
import { AgingData, LoteInvestigacao, ConfiguracaoResiduais } from '@/types/aging';

interface OnepageViewProps {
  agingData: AgingData[];
  valores: Record<string, number>;
  lotesInvestigacao?: LoteInvestigacao[];
  onInvestigacaoChange?: () => void;
  currentUserEmail?: string;
  lastUpdate?: string | Date | null;
  configResiduais?: ConfiguracaoResiduais;
  onFilterMaterial?: (material: string) => void;
  onFilterPosicao?: (posicao: string) => void;
}

export function OnepageView({
  agingData,
  valores,
  lotesInvestigacao = [],
  lastUpdate,
  configResiduais,
  onFilterMaterial,
  onFilterPosicao,
}: OnepageViewProps) {
  const diasAlerta = configResiduais?.dias_alerta ?? 7;
  const diasCritico = configResiduais?.dias_critico ?? 15;

  const lotesInvSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of lotesInvestigacao) {
      if (item.lote) set.add(item.lote.trim().toUpperCase());
    }
    return set;
  }, [lotesInvestigacao]);

  const stats = useMemo(() => {
    const positionsConfig = [
      { key: 'PESAGEM', name: 'Pesagem', color: 'var(--accent, #3b82f6)' },
      { key: 'AJUSTE', name: 'Ajuste', color: 'var(--amber, #f59e0b)' },
      { key: 'AJU-SAIDA', name: 'AJU-SAÍDA', color: 'var(--text-3, #8b5cf6)' },
    ];

    const posData: Record<
      string,
      {
        totalValor: number;
        lotesCount: number;
        materiaisSet: Set<string>;
        top3Antigos: { mat: string; desc: string; maxAging: number; lotes: number; valorTotal: number }[];
        statusBreakdown: { ok: number; al: number; cr: number; countOk: number; countAl: number; countCr: number };
        invCount: number;
        chamCount: number;
        invValor: number;
        chamValor: number;
      }
    > = {};

    positionsConfig.forEach((p) => {
      posData[p.key] = {
        totalValor: 0,
        lotesCount: 0,
        materiaisSet: new Set(),
        top3Antigos: [],
        statusBreakdown: { ok: 0, al: 0, cr: 0, countOk: 0, countAl: 0, countCr: 0 },
        invCount: 0,
        chamCount: 0,
        invValor: 0,
        chamValor: 0,
      };
    });

    const materialByPos: Record<string, Record<string, { mat: string; desc: string; maxAging: number; lotes: number; valorTotal: number }>> = {
      PESAGEM: {},
      AJUSTE: {},
      'AJU-SAIDA': {},
    };

    for (const item of agingData) {
      const pos = item.posicao_deposito || 'PESAGEM';
      const targetPos = posData[pos] ? pos : 'PESAGEM';
      const mat = item.material;
      const vu = valores[mat] || valores[mat.replace(/^0+/, '')] || 0;
      const qtd = Number(item.estoque_disponivel) || 0;
      const vt = Math.max(0, qtd) * vu;
      const dias = item.dias_aging || 0;

      const pObj = posData[targetPos];
      pObj.totalValor += vt;
      pObj.lotesCount += 1;
      pObj.materiaisSet.add(mat);

      let c: 'ok' | 'al' | 'cr' = 'ok';
      if (dias > diasCritico) {
        c = 'cr';
        pObj.statusBreakdown.cr += vt;
        pObj.statusBreakdown.countCr += 1;
      } else if (dias >= diasAlerta) {
        c = 'al';
        pObj.statusBreakdown.al += vt;
        pObj.statusBreakdown.countAl += 1;
      } else {
        pObj.statusBreakdown.ok += vt;
        pObj.statusBreakdown.countOk += 1;
      }

      if (targetPos === 'AJUSTE') {
        const isInv = lotesInvSet.has((item.lote || '').trim().toUpperCase());
        if (isInv) {
          pObj.invCount += 1;
          pObj.invValor += vt;
        } else {
          pObj.chamCount += 1;
          pObj.chamValor += vt;
        }
      }

      // Agrupamento de materiais por posição
      const mGroup = materialByPos[targetPos];
      if (!mGroup[mat]) {
        mGroup[mat] = {
          mat,
          desc: item.texto_breve_material || '',
          maxAging: dias,
          lotes: 0,
          valorTotal: 0,
        };
      }
      mGroup[mat].maxAging = Math.max(mGroup[mat].maxAging, dias);
      mGroup[mat].lotes += 1;
      mGroup[mat].valorTotal += vt;
    }

    // Top 3 mais antigos por posição
    positionsConfig.forEach((p) => {
      const mList = Object.values(materialByPos[p.key] || {});
      mList.sort((a, b) => b.maxAging - a.maxAging || b.valorTotal - a.valorTotal);
      posData[p.key].top3Antigos = mList.slice(0, 3);
    });

    // Top 5 materiais AJU-SAIDA
    const ajuSaidaList = Object.values(materialByPos['AJU-SAIDA'] || {}).sort((a, b) => b.valorTotal - a.valorTotal);
    const top5AjuSaida = ajuSaidaList.slice(0, 5);
    const maxAjuSaidaVal = top5AjuSaida.length > 0 ? top5AjuSaida[0].valorTotal : 1;

    return {
      positionsConfig,
      posData,
      top5AjuSaida,
      maxAjuSaidaVal,
    };
  }, [agingData, valores, lotesInvSet, diasAlerta, diasCritico]);

  const formatBRL = (v: number) => {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatBRLK = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
    if (a >= 1e4) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    return formatBRL(v);
  };

  const formatLastUpdate = (dt: string | Date | null | undefined) => {
    if (!dt) return '';
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return String(dt);
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return String(dt);
    }
  };

  const pesagemMaxVal = Math.max(
    stats.posData.PESAGEM.statusBreakdown.ok,
    stats.posData.PESAGEM.statusBreakdown.al,
    stats.posData.PESAGEM.statusBreakdown.cr,
    1
  );

  const ajusteMaxVal = Math.max(stats.posData.AJUSTE.invValor, stats.posData.AJUSTE.chamValor, 1);

  return (
    <div>
      {/* Header OnePage (.op-h) */}
      <div className="op-h">
        <div>
          <h1>Controle de estoque · Pesagem Manaus</h1>
          <p>Visão consolidada do estoque PES por posição</p>
        </div>
        {lastUpdate && (
          <span className="muted text-xs font-mono">
            Última atualização: {formatLastUpdate(lastUpdate)}
          </span>
        )}
      </div>

      {/* Grid das 3 Posições (.pos3) */}
      <div className="pos3">
        {stats.positionsConfig.map((p) => {
          const dataPos = stats.posData[p.key];

          return (
            <section key={p.key}>
              <div className="ph">
                <span className="dot" style={{ background: p.color }} />
                <b>POSIÇÃO {p.name.toUpperCase()}</b>
                <span className="grow" />
                {p.key === 'PESAGEM' && <span className="flag b">ativo</span>}
                {p.key === 'AJUSTE' && (
                  <>
                    <span className="flag">{dataPos.invCount} em investigação</span>
                    <span className="flag b">{dataPos.chamCount} aguard. chamado</span>
                  </>
                )}
                {p.key === 'AJU-SAIDA' && <span className="flag v">saída</span>}
              </div>

              <div className="pn">
                <div>
                  <label>Materiais</label>
                  <strong>{dataPos.materiaisSet.size}</strong>
                </div>
                <div>
                  <label>Lotes</label>
                  <strong>{dataPos.lotesCount}</strong>
                </div>
                <div>
                  <label>Valor avaliado</label>
                  <strong>{formatBRL(dataPos.totalValor)}</strong>
                </div>
              </div>

              <div className="old">Top 3 mais antigos</div>
              {dataPos.top3Antigos.length === 0 ? (
                <div className="muted text-xs py-1.5">Sem lotes.</div>
              ) : (
                dataPos.top3Antigos.map((m) => {
                  const c = m.maxAging > diasCritico ? 'cr' : m.maxAging >= diasAlerta ? 'al' : 'ok';
                  const colDot = c === 'cr' ? 'var(--red)' : c === 'al' ? 'var(--amber)' : 'var(--green)';

                  return (
                    <div
                      key={m.mat}
                      onClick={() => {
                        onFilterPosicao?.(p.key);
                        onFilterMaterial?.(m.mat);
                      }}
                      className="ol"
                    >
                      <span className="dot" style={{ background: colDot }} />
                      <b title={m.desc}>{m.desc.replace(/\*\*/g, '')}</b>
                      <span className={`ag c-${c}`}>{m.maxAging} d</span>
                      <span className="n">{m.lotes} lt</span>
                      <span className="v">{formatBRL(m.valorTotal)}</span>
                    </div>
                  );
                })
              )}
            </section>
          );
        })}
      </div>

      {/* Gráficos Proporcionais de Aging e Posição */}
      <div className="sec-h" style={{ marginBottom: 4 }}>
        <b>Valor total por status de aging e posição</b>
        <div className="legend">
          <span>
            <i style={{ background: 'var(--green)' }} />
            Normal
          </span>
          <span>
            <i style={{ background: 'var(--amber)' }} />
            Alerta
          </span>
          <span>
            <i style={{ background: 'var(--red)' }} />
            Crítico
          </span>
        </div>
      </div>

      <div className="pos3" style={{ borderTop: '1px solid var(--border)' }}>
        {/* Gráfico 1: Pesagem por Status (.vb / .vbx) */}
        <section>
          <div className="sec-h">
            <b>Pesagem</b>
            <span>valor por status · lotes na base</span>
          </div>

          <div className="vb">
            {/* Normal */}
            <div
              className="col"
              title={`Normal · ${formatBRL(stats.posData.PESAGEM.statusBreakdown.ok)}`}
              onClick={() => onFilterPosicao?.('PESAGEM')}
            >
              <span className="lbl" style={{ bottom: `calc(${(stats.posData.PESAGEM.statusBreakdown.ok / pesagemMaxVal) * 100}% + 4px)` }}>
                {stats.posData.PESAGEM.statusBreakdown.ok > 0 ? formatBRLK(stats.posData.PESAGEM.statusBreakdown.ok).replace('R$ ', '') : ''}
              </span>
              <div
                className="stk"
                style={{ height: `${(stats.posData.PESAGEM.statusBreakdown.ok / pesagemMaxVal) * 100}%` }}
              >
                <i style={{ flex: 1, background: 'var(--green)' }} />
              </div>
            </div>

            {/* Alerta */}
            <div
              className="col"
              title={`Alerta · ${formatBRL(stats.posData.PESAGEM.statusBreakdown.al)}`}
              onClick={() => onFilterPosicao?.('PESAGEM')}
            >
              <span className="lbl" style={{ bottom: `calc(${(stats.posData.PESAGEM.statusBreakdown.al / pesagemMaxVal) * 100}% + 4px)` }}>
                {stats.posData.PESAGEM.statusBreakdown.al > 0 ? formatBRLK(stats.posData.PESAGEM.statusBreakdown.al).replace('R$ ', '') : ''}
              </span>
              <div
                className="stk"
                style={{ height: `${(stats.posData.PESAGEM.statusBreakdown.al / pesagemMaxVal) * 100}%` }}
              >
                <i style={{ flex: 1, background: 'var(--amber)' }} />
              </div>
            </div>

            {/* Crítico */}
            <div
              className="col"
              title={`Crítico · ${formatBRL(stats.posData.PESAGEM.statusBreakdown.cr)}`}
              onClick={() => onFilterPosicao?.('PESAGEM')}
            >
              <span className="lbl" style={{ bottom: `calc(${(stats.posData.PESAGEM.statusBreakdown.cr / pesagemMaxVal) * 100}% + 4px)` }}>
                {stats.posData.PESAGEM.statusBreakdown.cr > 0 ? formatBRLK(stats.posData.PESAGEM.statusBreakdown.cr).replace('R$ ', '') : ''}
              </span>
              <div
                className="stk"
                style={{ height: `${(stats.posData.PESAGEM.statusBreakdown.cr / pesagemMaxVal) * 100}%` }}
              >
                <i style={{ flex: 1, background: 'var(--red)' }} />
              </div>
            </div>
          </div>

          <div className="vbx">
            <span>
              Normal<b>{stats.posData.PESAGEM.statusBreakdown.countOk} lotes</b>
            </span>
            <span>
              Alerta<b>{stats.posData.PESAGEM.statusBreakdown.countAl} lotes</b>
            </span>
            <span>
              Crítico<b>{stats.posData.PESAGEM.statusBreakdown.countCr} lotes</b>
            </span>
          </div>
        </section>

        {/* Gráfico 2: Ajuste Investigação x Chamado (.vb / .vbx) */}
        <section>
          <div className="sec-h">
            <b>Ajuste · investigação × chamado</b>
            <span>valor por situação</span>
          </div>

          <div className="vb">
            {/* Investigação */}
            <div
              className="col"
              title={`Em investigação · ${formatBRL(stats.posData.AJUSTE.invValor)}`}
              onClick={() => onFilterPosicao?.('AJUSTE')}
            >
              <span className="lbl" style={{ bottom: `calc(${(stats.posData.AJUSTE.invValor / ajusteMaxVal) * 100}% + 4px)` }}>
                {stats.posData.AJUSTE.invValor > 0 ? formatBRLK(stats.posData.AJUSTE.invValor).replace('R$ ', '') : ''}
              </span>
              <div
                className="stk"
                style={{ height: `${(stats.posData.AJUSTE.invValor / ajusteMaxVal) * 100}%` }}
              >
                <i style={{ flex: 1, background: 'var(--amber)' }} />
              </div>
            </div>

            {/* Chamado */}
            <div
              className="col"
              title={`Aguardando chamado · ${formatBRL(stats.posData.AJUSTE.chamValor)}`}
              onClick={() => onFilterPosicao?.('AJUSTE')}
            >
              <span className="lbl" style={{ bottom: `calc(${(stats.posData.AJUSTE.chamValor / ajusteMaxVal) * 100}% + 4px)` }}>
                {stats.posData.AJUSTE.chamValor > 0 ? formatBRLK(stats.posData.AJUSTE.chamValor).replace('R$ ', '') : ''}
              </span>
              <div
                className="stk"
                style={{ height: `${(stats.posData.AJUSTE.chamValor / ajusteMaxVal) * 100}%` }}
              >
                <i style={{ flex: 1, background: 'var(--accent)' }} />
              </div>
            </div>
          </div>

          <div className="vbx">
            <span>
              Em investigação<b>{stats.posData.AJUSTE.invCount} lotes</b>
            </span>
            <span>
              Aguardando chamado<b>{stats.posData.AJUSTE.chamCount} lotes</b>
            </span>
          </div>
        </section>

        {/* Gráfico 3: Top 5 Materiais AJU-SAIDA (.hb) */}
        <section>
          <div className="sec-h">
            <b>Top 5 materiais · AJU-SAÍDA</b>
            <span>maior valor: {stats.top5AjuSaida.length > 0 ? formatBRL(stats.top5AjuSaida[0].valorTotal) : '—'}</span>
          </div>

          {stats.top5AjuSaida.length === 0 ? (
            <div className="muted text-xs py-4">Sem lotes em AJU-SAÍDA.</div>
          ) : (
            stats.top5AjuSaida.map((m) => (
              <div
                key={m.mat}
                onClick={() => {
                  onFilterPosicao?.('AJU-SAIDA');
                  onFilterMaterial?.(m.mat);
                }}
                className="hb"
              >
                <b title={m.desc}>{m.desc.replace(/\*\*/g, '')}</b>
                <div className="t" style={{ width: `${Math.max(3, (m.valorTotal / stats.maxAjuSaidaVal) * 100)}%` }}>
                  <i style={{ width: '100%', background: 'var(--violet)' }} />
                </div>
                <span>{formatBRL(m.valorTotal)}</span>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
