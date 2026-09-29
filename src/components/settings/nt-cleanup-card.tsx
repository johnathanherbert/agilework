"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Trash2, Clock, CheckCircle2, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getNTCleanupConfig, 
  saveNTCleanupConfig, 
  cleanOldCompletedNTs,
  NTCleanupConfig 
} from '@/lib/firestore-helpers';

export const NTCleanupCard = () => {
  const [config, setConfig] = useState<NTCleanupConfig>({
    enabled: false,
    retentionDays: 30,
    lastRun: null,
    lastCleanedNTs: 0,
    lastCleanedItems: 0,
  });
  const [loading, setLoading] = useState(true);
  const [runningCleanup, setRunningCleanup] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getNTCleanupConfig();
      setConfig(data);
    } catch (error) {
      console.error('Erro ao carregar configurações de limpeza de NTs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      setConfig((prev) => ({ ...prev, enabled }));
      await saveNTCleanupConfig({ enabled });
      if (enabled) {
        toast.success('Limpeza automática de NTs ativada (mantendo últimos 30 dias)');
      } else {
        toast('Limpeza automática de NTs desativada', { icon: 'ℹ️' });
      }
    } catch (error) {
      console.error('Erro ao salvar configuração de limpeza:', error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  const handleRunManualCleanup = async () => {
    try {
      setRunningCleanup(true);
      toast.loading('Analisando e limpando NTs concluídas com mais de 30 dias...', { id: 'manual-cleanup' });
      
      const result = await cleanOldCompletedNTs(config.retentionDays || 30);
      
      if (result.deletedNTs > 0) {
        toast.success(
          `Limpeza concluída com sucesso! ${result.deletedNTs} NT(s) e ${result.deletedItems} item(ns) removidos.`,
          { id: 'manual-cleanup', duration: 5000 }
        );
      } else {
        toast.success(
          'Tudo em ordem! Nenhuma NT concluída com mais de 30 dias encontrada.',
          { id: 'manual-cleanup', duration: 4000 }
        );
      }

      await loadConfig();
    } catch (error: any) {
      console.error('Erro ao executar limpeza manual de NTs:', error);
      toast.error(error.message || 'Erro ao executar limpeza de NTs', { id: 'manual-cleanup' });
    } finally {
      setRunningCleanup(false);
    }
  };

  const formatLastRun = (isoString?: string | null) => {
    if (!isoString) return 'Nunca executada';
    try {
      const date = new Date(isoString);
      return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Data inválida';
    }
  };

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trash2 className="h-5 w-5 text-red-500" />
          Limpeza de NTs Concluídas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle principal */}
        <div className="flex items-center justify-between rounded-xl border border-border/70 p-3.5 bg-card">
          <div className="space-y-0.5 pr-3">
            <h4 className="font-semibold text-sm text-foreground">Limpeza Automática</h4>
            <p className="text-xs text-muted-foreground">
              Limpa automaticamente NTs concluídas deixando apenas os últimos 30 dias.
            </p>
          </div>
          <Switch
            checked={config.enabled}
            disabled={loading}
            onCheckedChange={handleToggle}
          />
        </div>

        {/* Informações de Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-border/70 p-3 bg-muted/20">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium mb-1">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              <span>Período de Retenção</span>
            </div>
            <p className="text-sm font-bold text-foreground">
              Últimos {config.retentionDays || 30} dias
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              NTs finalizadas mais antigas são expurgadas
            </p>
          </div>

          <div className="rounded-xl border border-border/70 p-3 bg-muted/20">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span>Última Execução</span>
            </div>
            <p className="text-sm font-bold text-foreground">
              {formatLastRun(config.lastRun)}
            </p>
            {config.lastCleanedNTs !== undefined && config.lastCleanedNTs > 0 && (
              <p className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">
                {config.lastCleanedNTs} NT(s) removida(s) na última vez
              </p>
            )}
          </div>
        </div>

        {/* Aviso Explicativo */}
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="leading-relaxed">
            A limpeza preserva todas as NTs abertas e em andamento. Apenas NTs onde <strong>todos os itens já foram pagos</strong> e com mais de 30 dias de criação são removidas para manter o sistema ágil.
          </p>
        </div>

        {/* Botão de Limpeza Manual */}
        <Button
          variant="outline"
          className="w-full justify-center border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-700 dark:text-red-300"
          disabled={runningCleanup || loading}
          onClick={handleRunManualCleanup}
        >
          {runningCleanup ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin text-red-600" />
              Limpando NTs antigas...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2 text-red-600" />
              Executar Limpeza Agora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
