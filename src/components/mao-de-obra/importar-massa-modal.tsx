"use client";

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Users,
  Copy,
  Trash2,
} from 'lucide-react';
import {
  TEMPORARIO_TXT_DEFAULT,
  parseOperatorsFromText,
  importOperatorsBatch,
} from '@/lib/labor-helpers';
import { TURMAS_INFO } from '@/lib/escala-helpers';
import { cn } from '@/lib/utils';
import { CreateOperatorInput } from '@/lib/labor-helpers';

interface ImportarMassaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportarMassaModal({
  open,
  onOpenChange,
  onSuccess,
}: ImportarMassaModalProps) {
  const [rawText, setRawText] = useState('');
  const [importing, setImporting] = useState(false);

  // Inicializa com temporario.txt quando abre
  useEffect(() => {
    if (open && !rawText) {
      setRawText(TEMPORARIO_TXT_DEFAULT);
    }
  }, [open]);

  // Parsing reativo
  const { operators, errors } = useMemo(() => {
    if (!rawText.trim()) return { operators: [], errors: [] };
    return parseOperatorsFromText(rawText);
  }, [rawText]);

  const handleLoadTemporarioPreset = () => {
    setRawText(TEMPORARIO_TXT_DEFAULT);
    toast.success('Dados de temporario.txt carregados!');
  };

  const handleClear = () => {
    setRawText('');
  };

  const handleImport = async () => {
    if (operators.length === 0) {
      toast.error('Nenhum colaborador válido para importar.');
      return;
    }

    setImporting(true);
    try {
      const result = await importOperatorsBatch(operators);
      if (result.errors && result.errors.length > 0) {
        toast.error(`Importado parcialmente com avisos: ${result.errors[0]}`);
      } else {
        toast.success(`🎉 Sucesso! ${result.importedCount} colaboradores foram cadastrados em massa!`);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao importar colaboradores em lote.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl">
        {/* Header */}
        <div className="p-5 border-b border-border bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-t-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2.5 text-white">
              <div className="p-2 rounded-xl bg-white/20 border border-white/30">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              Cadastro de Colaboradores em Massa
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-emerald-100 mt-1">
            Cole os dados tabulados do Excel, bloco de notas ou use o arquivo <span className="font-mono font-bold text-white">temporario.txt</span> para importar toda a equipe de uma vez.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Botões de Ação Rápida */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleLoadTemporarioPreset}
                className="text-xs font-bold gap-1.5 border-emerald-300 text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Carregar temporario.txt (41 colaboradores)
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClear}
                className="text-xs text-muted-foreground hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Limpar Texto
              </Button>
            </div>

            <Badge variant="secondary" className="font-mono text-xs font-bold px-3 py-1">
              {operators.length} detectados
            </Badge>
          </div>

          {/* Área de Texto */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Texto / Tabela de Entrada (Colunas: ID | NOME | FUNÇÃO | LETRA | TURNO)</span>
              <span className="text-[10px] text-muted-foreground font-normal">Separado por Tabulação (\t) ou Vírgulas</span>
            </Label>
            <Textarea
              rows={7}
              placeholder="Cole aqui as linhas com ID, NOME, FUNÇÃO, LETRA, TURNO..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="font-mono text-xs leading-relaxed resize-y bg-white dark:bg-slate-950"
            />
          </div>

          {/* Avisos de Parsing se houver */}
          {errors.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{errors.length} linha(s) com aviso de formatação:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 opacity-90">
                {errors.slice(0, 3).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {errors.length > 3 && <li>... e mais {errors.length - 3} avisos.</li>}
              </ul>
            </div>
          )}

          {/* Pré-visualização da Tabela de Operadores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                Pré-visualização dos Colaboradores a Importar
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Total: <strong className="text-foreground">{operators.length}</strong> prontos para cadastro
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 text-muted-foreground uppercase font-bold text-[10px] tracking-wider sticky top-0 border-b border-border">
                  <tr>
                    <th className="px-3 py-2">Matrícula</th>
                    <th className="px-3 py-2">Nome do Colaborador</th>
                    <th className="px-3 py-2">Cargo / Função</th>
                    <th className="px-3 py-2 text-center">Turma</th>
                    <th className="px-3 py-2 text-center">Turno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {operators.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs font-medium">
                        Nenhum colaborador detectado. Cole os dados na caixa acima ou clique em "Carregar temporario.txt".
                      </td>
                    </tr>
                  ) : (
                    operators.map((op, idx) => {
                      const turmaInfo = TURMAS_INFO[op.letra];
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                          <td className="px-3 py-2 font-mono font-bold text-foreground">
                            {op.matricula}
                          </td>
                          <td className="px-3 py-2 font-bold text-foreground">
                            {op.nome}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400">
                            {op.cargo}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded-md text-white font-black text-[10px] shadow-2xs"
                              style={{ backgroundColor: turmaInfo.cor }}
                            >
                              {op.letra}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="outline" className="font-mono text-[10px] font-bold">
                              T{op.turno}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleImport}
            disabled={importing || operators.length === 0}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-5"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando no Firestore...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Cadastro de {operators.length} Colaboradores
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
