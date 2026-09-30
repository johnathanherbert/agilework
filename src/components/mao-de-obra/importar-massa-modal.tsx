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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)] flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[var(--text-2)]" />
              Cadastro de Colaboradores em Massa
            </h2>
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              Cole os dados tabulados ou use o preset do <span className="font-mono font-medium text-[var(--text)]">temporario.txt</span> para importar a equipe.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Botões de Ação Rápida */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadTemporarioPreset}
                className="h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-[11px] font-medium text-[var(--text)] hover:bg-[var(--bg)] transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                Carregar temporario.txt (41 colaboradores)
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-3)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            </div>

            <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)]">
              {operators.length} detectados
            </span>
          </div>

          {/* Área de Texto */}
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--text-3)] flex items-center justify-between">
              <span>Texto / Tabela de Entrada (ID | NOME | FUNÇÃO | LETRA | TURNO)</span>
              <span className="text-[10px] text-[var(--text-3)]">Separado por tabulação (\t) ou vírgula</span>
            </label>
            <textarea
              rows={6}
              placeholder="Cole aqui as linhas com ID, NOME, FUNÇÃO, LETRA, TURNO..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full p-2.5 font-mono text-xs leading-relaxed resize-y bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Avisos de Parsing se houver */}
          {errors.length > 0 && (
            <div className="p-3 rounded-[var(--radius)] bg-[var(--amber)]/10 border border-[var(--amber)]/30 text-xs text-[var(--amber)] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-3)]">Pré-visualização dos Colaboradores</span>
              <span className="text-[var(--text-3)] font-mono text-[11px]">
                Total: <strong className="text-[var(--text)]">{operators.length}</strong> prontos
              </span>
            </div>

            <div className="border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden max-h-52 overflow-y-auto bg-[var(--bg)]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--surface-2)] text-[var(--text-3)] text-[10px] uppercase font-mono tracking-wider sticky top-0 border-b border-[var(--border)]">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Matrícula</th>
                    <th className="px-3 py-1.5 font-medium">Nome</th>
                    <th className="px-3 py-1.5 font-medium">Cargo / Função</th>
                    <th className="px-3 py-1.5 font-medium text-center">Turma</th>
                    <th className="px-3 py-1.5 font-medium text-center">Turno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono text-[11px]">
                  {operators.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-3)] text-xs font-sans">
                        Nenhum colaborador detectado. Cole os dados na caixa acima.
                      </td>
                    </tr>
                  ) : (
                    operators.map((op, idx) => {
                      const turmaInfo = TURMAS_INFO[op.letra];
                      return (
                        <tr key={idx} className="hover:bg-[var(--surface)]">
                          <td className="px-3 py-1.5 font-bold text-[var(--text)]">
                            {op.matricula}
                          </td>
                          <td className="px-3 py-1.5 font-sans font-medium text-[var(--text)]">
                            {op.nome}
                          </td>
                          <td className="px-3 py-1.5 font-sans text-[var(--text-2)]">
                            {op.cargo}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded font-bold text-[10px] border"
                              style={{
                                backgroundColor: turmaInfo ? `${turmaInfo.cor}22` : 'var(--surface)',
                                color: turmaInfo?.cor || 'var(--text)',
                                borderColor: turmaInfo ? `${turmaInfo.cor}55` : 'var(--border)',
                              }}
                            >
                              {op.letra}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-center text-[var(--text-2)]">
                            T{op.turno}
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
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border)] bg-[var(--surface-2)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={importing}
            className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={importing || operators.length === 0}
            className="h-8 px-3.5 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
          >
            {importing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirmar Cadastro ({operators.length})
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
