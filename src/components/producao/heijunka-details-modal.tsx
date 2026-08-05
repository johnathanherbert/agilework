"use client";

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, Calendar, Zap, Hand, Layers, Lock, ShieldCheck, Save, BarChart2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { updateHeijunkaSnapshot } from '@/lib/heijunka-helpers';
import { HeijunkaSnapshot, HeijunkaTurnoStats } from '@/types';

interface HeijunkaDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: HeijunkaSnapshot | null;
  isAdmin: boolean;
  onSuccess?: (updatedSnapshot?: HeijunkaSnapshot) => void;
  onDeleteDay?: (snapshot: HeijunkaSnapshot) => void;
}

export function HeijunkaDetailsModal({
  open,
  onOpenChange,
  snapshot,
  isAdmin,
  onSuccess,
  onDeleteDay,
}: HeijunkaDetailsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metaDiaria, setMetaDiaria] = useState<number>(0);
  const [totalRealizado, setTotalRealizado] = useState<number>(0);
  const [volPA, setVolPA] = useState<number>(0);
  const [volPD, setVolPD] = useState<number>(0);
  const [volManual, setVolManual] = useState<number>(0);
  const [turnos, setTurnos] = useState<Record<string, HeijunkaTurnoStats>>({
    '1': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0, volPA: 0, volPD: 0, volManual: 0 },
    '2': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0, volPA: 0, volPD: 0, volManual: 0 },
    '3': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0, volPA: 0, volPD: 0, volManual: 0 },
  });
  const [familias, setFamilias] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!snapshot) return;

    const pa = snapshot.volPA ?? 0;
    const pd = snapshot.volPD ?? 0;
    const tot = snapshot.totalRealizado > 0 ? snapshot.totalRealizado : (snapshot.volManual ?? 0) + pa + pd;
    const man = snapshot.volManual ?? Math.max(0, tot - (pa + pd));

    setMetaDiaria(snapshot.metaDiaria || 0);
    setTotalRealizado(tot);
    setVolPA(pa);
    setVolPD(pd);
    setVolManual(man);
    setTurnos(snapshot.turnos || {
      '1': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0, volPA: 0, volPD: 0, volManual: 0 },
      '2': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0, volPA: 0, volPD: 0, volManual: 0 },
      '3': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0, volPA: 0, volPD: 0, volManual: 0 },
    });
    setFamilias(snapshot.familias || {});
  }, [snapshot, open]);

  if (!snapshot) return null;

  const dateFormatted = snapshot.date
    ? new Date(snapshot.date + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const volPDPA = volPA + volPD;
  const pdpaPercent = totalRealizado > 0 ? Math.min(100, Math.round((volPDPA / totalRealizado) * 100)) : 0;

  const handleTurnoChange = (tKey: string, field: keyof HeijunkaTurnoStats, val: number) => {
    setTurnos((prev) => {
      const current = { ...(prev[tKey] || {}) };
      current[field] = val;
      // Recalcula volManual se volPA ou volPD mudou
      if (field === 'volPA' || field === 'volPD' || field === 'realizado') {
        const p = current.volPA || 0;
        const d = current.volPD || 0;
        current.volManual = Math.max(0, (current.realizado || 0) - (p + d));
      }
      return { ...prev, [tKey]: current };
    });
  };

  const handleFamiliaChange = (famKey: string, val: number) => {
    setFamilias((prev) => ({
      ...prev,
      [famKey]: val,
    }));
  };

  async function handleSave() {
    if (!isAdmin || !snapshot) return;

    setIsSubmitting(true);
    try {
      const computedManual = Math.max(0, totalRealizado - (volPA + volPD));

      const updatedSnapshotData: Partial<HeijunkaSnapshot> = {
        metaDiaria,
        totalRealizado,
        volPA,
        volPD,
        volManual: computedManual,
        turnos,
        familias,
      };

      if (!snapshot.id.startsWith('mock-')) {
        await updateHeijunkaSnapshot(snapshot.id, updatedSnapshotData);
      }

      toast.success('Entregas do dia atualizadas com sucesso!');
      onOpenChange(false);
      onSuccess?.({
        ...snapshot,
        ...updatedSnapshotData,
        volManual: computedManual,
      } as HeijunkaSnapshot);
    } catch (error: any) {
      console.error('Erro ao atualizar snapshot:', error);
      toast.error(error.message || 'Erro ao atualizar dados');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] border border-border shadow-xl bg-card p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="relative p-6 pb-4 bg-slate-50 dark:bg-card border-b border-border/80 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md shrink-0">
                <Calendar className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground capitalize">
                  Entregas do Dia · {dateFormatted}
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  Detalhamento de ordens e pesagens realizadas
                </p>
              </div>
            </div>

            {isAdmin ? (
              <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                Edição Permitida (Admin)
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700">
                <Lock className="h-3.5 w-3.5" />
                Apenas Leitura
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── KPI Cards Resumo ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-card border rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Volume Total Realizado</span>
              {isAdmin ? (
                <Input
                  type="number"
                  min={0}
                  value={totalRealizado}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setTotalRealizado(val);
                    setVolManual(Math.max(0, val - (volPA + volPD)));
                  }}
                  className="h-8 font-extrabold text-base text-primary border-slate-300 dark:border-slate-700"
                />
              ) : (
                <p className="text-xl font-extrabold text-primary">{totalRealizado}</p>
              )}
              <span className="text-[10px] text-muted-foreground block">Meta Diária: {isAdmin ? (
                <input
                  type="number"
                  value={metaDiaria}
                  onChange={(e) => setMetaDiaria(Number(e.target.value) || 0)}
                  className="w-16 px-1 border rounded text-xs font-bold"
                />
              ) : metaDiaria}</span>
            </div>

            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Volume PD/PA</span>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{volPDPA}</p>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">
                {pdpaPercent}% do volume total
              </span>
            </div>

            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Volume Manual</span>
              <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{volManual}</p>
              <span className="text-[10px] text-muted-foreground block">
                {totalRealizado > 0 ? Math.round((volManual / totalRealizado) * 100) : 0}% do volume total
              </span>
            </div>
          </div>

          {/* ── Detalhamento do Volume PD vs PA ── */}
          <div className="p-4 border rounded-xl bg-card space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BarChart2 className="h-4 w-4 text-primary" />
              Detalhamento de Pesagens (PA / PD)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-violet-700 dark:text-violet-400 flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-violet-500" />
                  Pesagem Automática (PA)
                </label>
                {isAdmin ? (
                  <Input
                    type="number"
                    min={0}
                    value={volPA}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setVolPA(val);
                      setVolManual(Math.max(0, totalRealizado - (val + volPD)));
                    }}
                    className="h-9 font-bold text-sm border-violet-200 dark:border-violet-800"
                  />
                ) : (
                  <p className="text-base font-extrabold text-violet-600 dark:text-violet-400">{volPA}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Hand className="h-3.5 w-3.5 text-amber-500" />
                  Pesagem Direta (PD)
                </label>
                {isAdmin ? (
                  <Input
                    type="number"
                    min={0}
                    value={volPD}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setVolPD(val);
                      setVolManual(Math.max(0, totalRealizado - (volPA + val)));
                    }}
                    className="h-9 font-bold text-sm border-amber-200 dark:border-amber-800"
                  />
                ) : (
                  <p className="text-base font-extrabold text-amber-600 dark:text-amber-400">{volPD}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Entregas por Turno (1º, 2º, 3º Turno) ── */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              Entregas por Turno
            </h4>

            <div className="border rounded-xl overflow-hidden divide-y divide-border">
              {['1', '2', '3'].map((tKey) => {
                const tStats = turnos[tKey] || { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0, volPA: 0, volPD: 0, volManual: 0 };
                const tPA = tStats.volPA ?? 0;
                const tPD = tStats.volPD ?? 0;
                const tMan = tStats.volManual ?? Math.max(0, tStats.realizado - (tPA + tPD));

                return (
                  <div key={tKey} className="p-3 bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-primary uppercase tracking-wide">
                        {tKey}º Turno
                      </span>
                      <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-2">
                        <span>Realizado: {isAdmin ? (
                          <input
                            type="number"
                            value={tStats.realizado}
                            onChange={(e) => handleTurnoChange(tKey, 'realizado', Number(e.target.value) || 0)}
                            className="w-16 px-1 border rounded text-xs font-bold ml-1"
                          />
                        ) : tStats.realizado}</span>
                        <span>/ Programado: {isAdmin ? (
                          <input
                            type="number"
                            value={tStats.programado}
                            onChange={(e) => handleTurnoChange(tKey, 'programado', Number(e.target.value) || 0)}
                            className="w-16 px-1 border rounded text-xs font-bold ml-1"
                          />
                        ) : tStats.programado}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 dark:bg-muted/30 rounded-lg">
                        <span className="text-[10px] text-muted-foreground block font-medium">Vol. PA</span>
                        {isAdmin ? (
                          <input
                            type="number"
                            value={tPA}
                            onChange={(e) => handleTurnoChange(tKey, 'volPA', Number(e.target.value) || 0)}
                            className="w-full px-1 border rounded text-xs font-bold mt-0.5"
                          />
                        ) : (
                          <span className="font-extrabold text-violet-600 dark:text-violet-400">{tPA}</span>
                        )}
                      </div>

                      <div className="p-2 bg-slate-50 dark:bg-muted/30 rounded-lg">
                        <span className="text-[10px] text-muted-foreground block font-medium">Vol. PD</span>
                        {isAdmin ? (
                          <input
                            type="number"
                            value={tPD}
                            onChange={(e) => handleTurnoChange(tKey, 'volPD', Number(e.target.value) || 0)}
                            className="w-full px-1 border rounded text-xs font-bold mt-0.5"
                          />
                        ) : (
                          <span className="font-extrabold text-amber-600 dark:text-amber-400">{tPD}</span>
                        )}
                      </div>

                      <div className="p-2 bg-slate-50 dark:bg-muted/30 rounded-lg">
                        <span className="text-[10px] text-muted-foreground block font-medium">Vol. Manual</span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{tMan}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Famílias / Máquinas ── */}
          {Object.keys(familias).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground">Volume por Família / Máquina</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(familias).map(([famName, famVal]) => (
                  <div key={famName} className="p-2.5 bg-slate-50 dark:bg-muted/20 border rounded-lg flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground truncate max-w-[160px]" title={famName}>
                      {famName}
                    </span>
                    {isAdmin ? (
                      <input
                        type="number"
                        value={famVal}
                        onChange={(e) => handleFamiliaChange(famName, Number(e.target.value) || 0)}
                        className="w-20 px-1 border rounded text-xs font-bold text-right"
                      />
                    ) : (
                      <span className="text-xs font-black text-primary tabular-nums">{famVal}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <DialogFooter className="p-4 bg-slate-50 dark:bg-card border-t border-border/80 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Fechar
            </Button>

            {isAdmin && onDeleteDay && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDeleteDay(snapshot)}
                disabled={isSubmitting}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Dia
              </Button>
            )}
          </div>

          {isAdmin && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="gap-2 bg-primary text-primary-foreground"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Alterações
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
