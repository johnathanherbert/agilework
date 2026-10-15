'use client';

import React, { useState } from 'react';
import { EnrichedRow } from './aging-table';
import { triggerSapAutomation, checkSapAutomationStatus } from '@/lib/dashpesagem-api';
import { generateMoverLt10Vbs, MoverItemParam } from '@/components/pesagem/residuais-view';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, Play, Loader2, ArrowRightLeft, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface RouteOption {
  k: string;
  code: string;
  tdep: string;
  pos: string;
  desc: string;
}

const PREDEFINED_ROUTES: RouteOption[] = [
  { k: 'PES', code: 'PES PESAGEM', tdep: 'pes', pos: 'pesagem', desc: 'Depósito PES · posição PESAGEM' },
  { k: 'AJU', code: '999 AJUSTE', tdep: '999', pos: 'ajuste', desc: 'Depósito 999 · posição AJUSTE' },
  { k: 'SAI', code: '999 AJU-SAÍDA', tdep: '999', pos: 'aju-saida', desc: 'Depósito 999 · posição AJU-SAÍDA' },
  { k: 'TRZ', code: '922 TR-ZONE', tdep: '922', pos: 'tr-zone', desc: 'Área 922 · posição TR-ZONE' },
];

interface MoverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: EnrichedRow[];
  onRemoveItem?: (index: number) => void;
  onSuccess?: () => void;
  currentUserEmail?: string;
}

/* ---------------------------- Helpers de UI ---------------------------- */

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtdFmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <h3 className="text-[13px] font-medium text-[var(--text)]">{children}</h3>
      {right && <div className="text-[11px] text-[var(--text-3)]">{right}</div>}
    </div>
  );
}

export function MoverModal({
  open,
  onOpenChange,
  items,
  onRemoveItem,
  onSuccess,
  currentUserEmail,
}: MoverModalProps) {
  const [mode, setMode] = useState<'rota' | 'massa'>('rota');
  const [selectedRouteKey, setSelectedRouteKey] = useState<string>('PES');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{ time: string; msg: string; type?: 'ok' | 'err' }[]>([]);

  const selectedRoute = PREDEFINED_ROUTES.find((r) => r.k === selectedRouteKey) || PREDEFINED_ROUTES[0];

  const totalValue = items.reduce((acc, i) => acc + i.valor_total, 0);

  const samePositionCount = items.filter((i) => (i.posicao_deposito || '').toUpperCase() === selectedRoute.pos.toUpperCase()).length;
  const nonZeroCount = items.filter((i) => i.estoque_disponivel !== 0).length;

  const eligibleItems = items.filter((i) => {
    const isSame = (i.posicao_deposito || '').toUpperCase() === selectedRoute.pos.toUpperCase();
    if (isSame) return false;
    if (mode === 'massa' && i.estoque_disponivel !== 0) return false;
    return true;
  });

  const handleRunTransfer = async () => {
    if (eligibleItems.length === 0 || isRunning) return;
    setIsRunning(true);
    setLogs([]);

    const addLog = (msg: string, type?: 'ok' | 'err') => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLogs((prev) => [...prev, { time: timeStr, msg, type }]);
    };

    addLog(`Iniciando ${mode === 'rota' ? 'LT10' : 'ajuste em massa (movermigo)'} · destino ${selectedRoute.code}`);

    try {
      let res: { success: boolean; job?: any; error?: string };

      if (mode === 'rota') {
        const moverItemsParam: MoverItemParam[] = eligibleItems.map((item) => ({
          material: item.material,
          lote: item.lote,
          quantidade: item.estoque_disponivel.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
            useGrouping: false,
          }),
          unidade: item.unidade_medida || 'KG',
          depositoOrigem: item.deposito || 'PES',
          descricao: item.texto_breve_material,
        }));

        const vbsCode = generateMoverLt10Vbs(moverItemsParam, {
          tipo: selectedRoute.tdep,
          posicao: selectedRoute.pos,
        });

        res = await triggerSapAutomation(
          'mover_lt10',
          currentUserEmail || 'Web Pesagem',
          vbsCode
        );
      } else {
        res = await triggerSapAutomation(
          'movermigo',
          currentUserEmail || 'Web Pesagem',
          undefined
        );
      }

      if (!res.success || !res.job) {
        addLog(`Erro ao registrar tarefa SAP: ${res.error || 'Erro desconhecido'}`, 'err');
        setIsRunning(false);
        return;
      }

      addLog(`Job #${res.job.id} registrado no Planilha Sync. Executando...`);

      // Polling de status do Job
      let attempts = 0;
      const maxAttempts = 30;
      const interval = setInterval(async () => {
        attempts++;
        const statusJob = await checkSapAutomationStatus(res.job!.id);

        if (statusJob?.status === 'completed') {
          clearInterval(interval);
          setIsRunning(false);
          addLog(`Transferência concluída com sucesso no SAP! (${eligibleItems.length} itens)`, 'ok');
          toast.success(`${eligibleItems.length} lotes movidos para ${selectedRoute.code}!`);
          onSuccess?.();
        } else if (statusJob?.status === 'failed') {
          clearInterval(interval);
          setIsRunning(false);
          addLog(`Falha na execução: ${statusJob.result_message || 'Erro'}`, 'err');
          toast.error(`Falha: ${statusJob.result_message || 'Erro no script'}`);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsRunning(false);
          addLog('Aguardando retorno do Planilha Sync em segundo plano.', 'ok');
          toast('Comando enviado ao robô SAP.');
        }
      }, 2000);
    } catch (err: any) {
      addLog(`Erro de conexão: ${err?.message || err}`, 'err');
      setIsRunning(false);
    }
  };

  /* ---------------------------- Derivados de UI ---------------------------- */

  const destPos = selectedRoute.pos.toUpperCase();
  const isSamePos = (i: EnrichedRow) => (i.posicao_deposito || '').toUpperCase() === destPos;
  const skipReason = (i: EnrichedRow): string | null => {
    if (isSamePos(i)) return `já em ${destPos}`;
    if (mode === 'massa' && i.estoque_disponivel !== 0) return 'saldo ≠ 0';
    return null;
  };

  const eligibleValue = eligibleItems.reduce((acc, i) => acc + i.valor_total, 0);
  const nonZeroIgnored = mode === 'massa'
    ? items.filter((i) => !isSamePos(i) && i.estoque_disponivel !== 0).length
    : 0;

  const origens = Array.from(new Set(items.map((i) => (i.deposito || 'PES').toUpperCase())));
  const origemLabel = origens.length <= 1 ? (origens[0] || 'PES') : `${origens.length} depósitos`;

  const lastLog = logs[logs.length - 1];
  const finishedErr = !isRunning && lastLog?.type === 'err';
  const finishedOk = !isRunning && lastLog?.type === 'ok';

  let footerStatus: { dot: string; text: string };
  if (isRunning) footerStatus = { dot: 'var(--accent)', text: 'Executando no SAP…' };
  else if (finishedErr) footerStatus = { dot: 'var(--red)', text: `Falhou às ${lastLog.time}` };
  else if (finishedOk) footerStatus = { dot: 'var(--green)', text: `Concluído às ${lastLog.time}` };
  else if (items.length === 0) footerStatus = { dot: 'var(--amber)', text: 'Nenhum lote selecionado' };
  else if (eligibleItems.length === 0) footerStatus = { dot: 'var(--amber)', text: 'Nenhum lote elegível para este destino' };
  else
    footerStatus = {
      dot: 'var(--text-3)',
      text: `${eligibleItems.length} de ${items.length} ${items.length === 1 ? 'lote' : 'lotes'} · ${brl(eligibleValue)}`,
    };

  const lotesLabel = `${eligibleItems.length} ${eligibleItems.length === 1 ? 'lote' : 'lotes'}`;

  return (
    <Dialog open={open} onOpenChange={(val: boolean) => !isRunning && onOpenChange(val)}>
      <DialogContent className="max-w-xl w-[calc(100vw-1rem)] sm:w-full p-0 gap-0 overflow-hidden bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] rounded-lg shadow-2xl flex flex-col max-h-[92dvh]">
        {/* ───────────── Cabeçalho ───────────── */}
        <DialogHeader className="px-5 pt-4 pb-3 pr-12 border-b border-[var(--border)] shrink-0 text-left space-y-0.5">
          <DialogTitle className="text-[15px] font-semibold tracking-tight text-[var(--text)] flex items-center gap-2">
            <ArrowRightLeft size={15} className="text-[var(--text-3)]" />
            Mover estoque
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--text-3)]">
            {items.length} {items.length === 1 ? 'lote' : 'lotes'} · {brl(totalValue)} · executa via Planilha Sync
          </DialogDescription>
        </DialogHeader>

        {/* ───────────── Corpo ───────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 text-[13px]">
          {/* Modo */}
          <section>
            <SectionTitle>Como mover</SectionTitle>
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)]">
              {([
                { m: 'rota' as const, label: 'Por rota', code: 'LT10' },
                { m: 'massa' as const, label: 'Ajuste em massa', code: 'saldo 0' },
              ]).map((opt) => {
                const active = mode === opt.m;
                return (
                  <button
                    key={opt.m}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setMode(opt.m)}
                    className={cx(
                      'h-10 sm:h-8 px-3 rounded-[calc(var(--radius)-2px)] text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50',
                      active
                        ? 'bg-[var(--surface)] text-[var(--text)] font-medium shadow-sm'
                        : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                    )}
                  >
                    {opt.label}
                    <span className="font-mono text-[11px] text-[var(--text-3)]">{opt.code}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-3)] leading-relaxed">
              {mode === 'rota'
                ? 'Localiza cada lote pela quantidade exata no /nlt10 e transfere para o destino com confirmação automática.'
                : 'Só lotes com saldo 0. Atualiza a posição de registro sem transferir peso (movermigo).'}
            </p>
          </section>

          {/* Destino */}
          <section>
            <SectionTitle
              right={
                <span className="inline-flex items-center gap-1 font-mono">
                  {origemLabel}
                  <ArrowRight size={11} />
                  <span className="text-[var(--text-2)]">{selectedRoute.tdep.toUpperCase()} · {destPos}</span>
                </span>
              }
            >
              Destino
            </SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PREDEFINED_ROUTES.map((r) => {
                const countInSame = items.filter((i) => (i.posicao_deposito || '').toUpperCase() === r.pos.toUpperCase()).length;
                const isSelected = selectedRouteKey === r.k;
                return (
                  <button
                    key={r.k}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setSelectedRouteKey(r.k)}
                    title={r.desc}
                    className={cx(
                      'min-h-[52px] px-2.5 py-2 rounded-[var(--radius)] border text-left transition-colors cursor-pointer disabled:opacity-50',
                      isSelected
                        ? 'border-[var(--text-3)] bg-[var(--hover)]'
                        : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--hover)]/50'
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: isSelected ? 'var(--accent)' : 'var(--border-strong)' }}
                      />
                      <span className={cx('font-mono text-xs font-medium', isSelected ? 'text-[var(--text)]' : 'text-[var(--text-2)]')}>
                        {r.code}
                      </span>
                    </span>
                    <span className="block mt-1 text-[11px] text-[var(--text-3)]">
                      {countInSame > 0 ? (
                        <span className="text-[var(--amber)]">{countInSame} já aqui</span>
                      ) : (
                        r.desc.split('·')[0].trim()
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Lotes */}
          <section>
            <SectionTitle
              right={
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    if (!isRunning) {
                      onOpenChange(false);
                      toast('Marque os lotes desejados na tabela e clique em Mover…');
                    }
                  }}
                  className="text-[11px] text-[var(--text-2)] hover:text-[var(--text)] underline-offset-2 hover:underline cursor-pointer disabled:opacity-40"
                >
                  Selecionar na tabela
                </button>
              }
            >
              Lotes ({items.length})
            </SectionTitle>

            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--text-3)] border border-dashed border-[var(--border)] rounded-[var(--radius)]">
                Nenhum lote selecionado. Marque os itens na tabela antes de mover.
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto border-y border-[var(--border)] divide-y divide-[var(--border)]">
                {items.map((item, idx) => {
                  const reason = skipReason(item);
                  return (
                    <li
                      key={item.id_row || idx}
                      className={cx('group flex items-center gap-3 py-2', reason && 'opacity-55')}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cx('font-mono text-xs font-medium text-[var(--text)]', reason && 'line-through decoration-[var(--text-3)]')}>
                            {item.lote}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--text-3)]">
                            {item.tipo_deposito} · {item.posicao_deposito}
                          </span>
                          {reason && (
                            <span className="text-[10.5px] px-1.5 rounded border border-[var(--amber)]/40 text-[var(--amber)]">
                              {reason}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-3)] truncate" title={item.texto_breve_material}>
                          <span className="font-mono text-[var(--text-2)]">{item.material}</span>
                          {item.texto_breve_material ? ` · ${item.texto_breve_material}` : ''}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="font-mono text-xs">
                          <span className={cx('font-medium', item.estoque_disponivel < 0 ? 'text-[var(--red)]' : 'text-[var(--text)]')}>
                            {qtdFmt(item.estoque_disponivel)}
                          </span>
                          <span className="ml-1 text-[var(--text-3)]">{item.unidade_medida || 'KG'}</span>
                        </div>
                        <div className="font-mono text-[11px] text-[var(--text-3)]">{brl(item.valor_total)}</div>
                      </div>

                      {onRemoveItem && (
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => onRemoveItem(idx)}
                          className="shrink-0 h-8 w-8 sm:h-6 sm:w-6 inline-flex items-center justify-center rounded text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--hover)] sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer disabled:opacity-25"
                          title="Remover da lista"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {(samePositionCount > 0 || nonZeroIgnored > 0) && (
              <div className="mt-2 space-y-0.5 text-[11px] text-[var(--amber)]">
                {samePositionCount > 0 && (
                  <p>
                    {samePositionCount} {samePositionCount === 1 ? 'lote já está' : 'lotes já estão'} em {destPos} e{' '}
                    {samePositionCount === 1 ? 'será ignorado' : 'serão ignorados'}.
                  </p>
                )}
                {nonZeroIgnored > 0 && (
                  <p>
                    {nonZeroIgnored} {nonZeroIgnored === 1 ? 'lote tem' : 'lotes têm'} saldo diferente de zero e{' '}
                    {nonZeroIgnored === 1 ? 'fica' : 'ficam'} fora do ajuste em massa.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Registro */}
          {logs.length > 0 && (
            <section>
              <SectionTitle right={isRunning ? 'ao vivo' : lastLog?.time}>Registro</SectionTitle>
              <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                {logs.map((log, i) => {
                  const isLastRunning = isRunning && i === logs.length - 1;
                  return (
                    <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
                      <span
                        className={cx('mt-[6px] w-1.5 h-1.5 rounded-full shrink-0', isLastRunning && 'animate-pulse')}
                        style={{
                          background:
                            log.type === 'ok' ? 'var(--green)' : log.type === 'err' ? 'var(--red)' : 'var(--accent)',
                        }}
                      />
                      <span className="font-mono text-[var(--text-3)] shrink-0">{log.time}</span>
                      <span className={cx('flex-1 min-w-0 break-words', log.type === 'err' ? 'text-[var(--red)]' : 'text-[var(--text-2)]')}>
                        {log.msg}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {/* ───────────── Rodapé ───────────── */}
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
          {isRunning && (
            <div className="h-0.5 w-full overflow-hidden bg-[var(--border)]">
              <div className="h-full w-1/3 bg-[var(--accent)] animate-pulse" />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-5 py-3">
            <div className="flex items-center gap-2 text-xs text-[var(--text-2)] min-w-0">
              <span
                className={cx('w-1.5 h-1.5 rounded-full shrink-0', isRunning && 'animate-pulse')}
                style={{ background: footerStatus.dot }}
              />
              <span className="truncate">{footerStatus.text}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isRunning}
                className="h-10 sm:h-8 px-3 flex-1 sm:flex-none rounded-[var(--radius)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer disabled:opacity-40"
              >
                {finishedOk ? 'Fechar' : 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={handleRunTransfer}
                disabled={eligibleItems.length === 0 || isRunning}
                className="h-10 sm:h-8 px-4 flex-[2] sm:flex-none rounded-[var(--radius)] bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Executando…</span>
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    <span>
                      {finishedErr ? 'Tentar de novo' : 'Mover'} · {lotesLabel} → {selectedRoute.code}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
