'use client';

import React, { useState } from 'react';
import { EnrichedRow } from './aging-table';
import { triggerSapAutomation, checkSapAutomationStatus } from '@/lib/dashpesagem-api';
import { generateMoverLt10Vbs, MoverItemParam } from '@/components/pesagem/residuais-view';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Play, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
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

  return (
    <Dialog open={open} onOpenChange={(val) => !isRunning && onOpenChange(val)}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90dvh] flex flex-col p-0 overflow-hidden bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] rounded-xl shadow-2xl">
        <DialogHeader className="p-4 border-b border-[var(--border)]">
          <DialogTitle className="text-base font-bold text-[var(--text)] uppercase tracking-wider">
            Mover estoque no SAP
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--text-3)] font-mono">
            Transfere os lotes pela quantidade exata (LT10) ou ajusta em massa itens com saldo zero.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
          {/* Alternador de Modo */}
          <div className="flex rounded-lg border border-[var(--border-strong)] p-1 bg-[var(--surface-2)]">
            <button
              type="button"
              onClick={() => setMode('rota')}
              className={`flex-1 py-1.5 rounded text-xs font-bold font-mono transition-all cursor-pointer ${
                mode === 'rota' ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--accent)] shadow-xs' : 'text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)]'
              }`}
            >
              Mover por rota (LT10)
            </button>
            <button
              type="button"
              onClick={() => setMode('massa')}
              className={`flex-1 py-1.5 rounded text-xs font-bold font-mono transition-all cursor-pointer ${
                mode === 'massa' ? 'bg-[var(--surface)] text-purple-300 border border-purple-500/50 shadow-xs' : 'text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)]'
              }`}
            >
              Mover / ajuste em massa (saldo 0)
            </button>
          </div>

          {/* Rotas de Destino */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">Rota de destino</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PREDEFINED_ROUTES.map((r) => {
                const countInSame = items.filter((i) => (i.posicao_deposito || '').toUpperCase() === r.pos).length;
                const isSelected = selectedRouteKey === r.k;

                return (
                  <button
                    key={r.k}
                    type="button"
                    onClick={() => setSelectedRouteKey(r.k)}
                    className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--surface-2)] text-[var(--text)] ring-1 ring-[var(--accent)]/40 shadow-xs'
                        : 'border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)]'
                    }`}
                  >
                    <div>
                      <b className={`block font-mono text-xs font-bold ${isSelected ? 'text-[var(--text)]' : 'text-[var(--text-2)]'}`}>{r.code}</b>
                      <small className="block text-[11px] text-[var(--text-3)] mt-0.5 leading-tight font-mono">
                        {r.desc}
                      </small>
                    </div>
                    {countInSame > 0 && (
                      <span className="text-[10px] font-mono text-[var(--amber)] font-medium mt-1.5 block">
                        {countInSame} já nesta posição
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Itens Selecionados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text)]">
                Itens a mover ({items.length} lotes ·{' '}
                <span className="font-mono text-[var(--green)]">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>)
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!isRunning) {
                    onOpenChange(false);
                    toast('Marque os lotes desejados na tabela e clique em Mover…');
                  }
                }}
                className="text-[var(--accent)] hover:underline font-mono text-xs cursor-pointer"
              >
                Selecionar na tabela
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto border border-[var(--border-strong)] rounded-lg divide-y divide-[var(--border)] bg-[var(--surface)]">
              {items.length === 0 ? (
                <div className="p-4 text-center text-[var(--text-3)] text-xs font-mono">
                  Nenhum lote selecionado. Marque os itens na tabela antes de mover.
                </div>
              ) : (
                items.map((item, idx) => {
                  const isSame = (item.posicao_deposito || '').toUpperCase() === selectedRoute.pos;

                  return (
                    <div
                      key={item.id_row || idx}
                      className={`grid grid-cols-12 gap-2 items-center px-3 py-1.5 text-xs font-mono ${
                        isSame ? 'bg-[var(--amber)]/10 text-[var(--amber)]' : 'text-[var(--text)]'
                      }`}
                    >
                      <b className="col-span-2 font-mono text-[var(--accent)]">{item.material}</b>
                      <span className="col-span-4 truncate text-[var(--text-2)]" title={item.texto_breve_material}>
                        {item.texto_breve_material}
                      </span>
                      <span className="col-span-2 font-mono text-[var(--amber)] font-bold">{item.lote}</span>
                      <span className="col-span-2 font-mono text-[var(--text-3)] text-[11px]">
                        {item.tipo_deposito} · {item.posicao_deposito}
                      </span>
                      <span className="col-span-1 font-mono text-right font-medium text-[var(--text)]">
                        {item.estoque_disponivel.toFixed(3)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveItem?.(idx)}
                        className="col-span-1 text-right text-[var(--text-3)] hover:text-[var(--red)] flex justify-end cursor-pointer"
                        title="Remover item da lista"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Instruções de Execução */}
          <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] text-[11.5px] text-[var(--text-3)] space-y-1 font-mono">
            {mode === 'rota' ? (
              <p>
                <b className="text-[var(--text)]">LT10</b> · Centro <code>600</code> · Localiza por lote e quantidade exata → Transfere para{' '}
                <code className="text-[var(--accent)] font-semibold">{selectedRoute.code}</code> com confirmação automática.
              </p>
            ) : (
              <p>
                <b className="text-purple-300">Ajuste em massa</b> · Somente lotes com <b>saldo 0</b>. Atualiza a posição de registro sem transferência de peso.
              </p>
            )}

            {samePositionCount > 0 && (
              <p className="text-[var(--amber)] font-medium">
                ⚠️ {samePositionCount} lote(s) já estão na posição {selectedRoute.pos} e serão ignorados.
              </p>
            )}
            {mode === 'massa' && nonZeroCount > 0 && (
              <p className="text-[var(--amber)] font-medium">
                ⚠️ {nonZeroCount} lote(s) com saldo diferente de zero serão ignorados no modo em massa.
              </p>
            )}
          </div>

          {/* Terminal / Logs em tempo real */}
          {logs.length > 0 && (
            <div className="max-h-28 overflow-y-auto p-2 bg-black/90 text-green-400 font-mono text-[11px] rounded border border-[var(--border-strong)] leading-relaxed">
              {logs.map((log, i) => (
                <div key={i} className={log.type === 'err' ? 'text-[var(--red)]' : ''}>
                  <span className="text-[var(--text-3)] mr-2">{log.time}</span>
                  {log.msg}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="p-3 border-t border-[var(--border)] flex items-center justify-between">
          <div className="text-xs text-[var(--text-3)] font-mono">
            {eligibleItems.length > 0 ? (
              <span>
                Pronto: <b className="text-[var(--text)]">{eligibleItems.length}</b> lote(s) elegíveis
              </span>
            ) : (
              <span className="text-[var(--amber)]">Nenhum lote elegível selecionado</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isRunning}
              className="px-3.5 py-1.5 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--hover)] border border-[var(--border-strong)] text-[var(--text)] font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRunTransfer}
              disabled={eligibleItems.length === 0 || isRunning}
              className="px-4 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--bg)] font-bold text-xs shadow-xs transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Executar transferência ({eligibleItems.length})
                </>
              )}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
