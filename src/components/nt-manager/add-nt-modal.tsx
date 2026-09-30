"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createNT, createNTItem } from '@/lib/firestore-helpers';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatTime, cn } from '@/lib/utils';
import { useNotifications } from '@/components/providers/notification-provider';
import { FileText, Loader2, Check, Copy } from 'lucide-react';

interface AddNTModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParsedItem {
  code: string;
  description: string;
  quantity: string;
}

const formSchema = z.object({
  nt_number: z
    .string()
    .min(1, { message: 'Número da NT é obrigatório' }),
  items_data: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function AddNTModal({ open, onOpenChange, onSuccess }: AddNTModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const { startBatchOperation, endBatchOperation } = useNotifications();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nt_number: '',
      items_data: '',
    },
  });

  // Parse tabulated data from SAP
  const parseItemsData = (text: string): ParsedItem[] => {
    if (!text.trim()) return [];

    return text.split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Split by tabs or multiple spaces
        const parts = line.trim().split(/\t+|\s{2,}/);
        
        if (parts.length >= 3) {
          return {
            code: parts[0].trim(),
            description: parts[1].trim(),
            quantity: parts[2].trim()
          };
        }
        return null;
      })
      .filter((item): item is ParsedItem => item !== null);
  };

  const handleItemsDataChange = (value: string) => {
    const items = parseItemsData(value);
    setParsedItems(items);
    return value;
  };

  async function onSubmit(data: FormData) {
    setIsSubmitting(true);
    
    try {
      const now = new Date();
      const brazilianDate = formatDate(now);
      const brazilianTime = formatTime(now);
      
      // Create the NT first
      const ntId = await createNT(data.nt_number);
      
      // Start batch operation to prevent redundant notifications
      const batchId = startBatchOperation('nt_creation', ntId, parsedItems.length);
      
      // Create items if we have parsed data
      if (parsedItems.length > 0) {
        const itemPromises = parsedItems.map((item, index) => 
          createNTItem(ntId, {
            item_number: index + 1,
            code: item.code,
            description: item.description,
            quantity: item.quantity,
            batch: null,
            created_date: brazilianDate,
            created_time: brazilianTime,
            payment_time: null,
            status: 'Ag. Pagamento',
            priority: false,
          })
        );
        
        try {
          await Promise.all(itemPromises);
        } catch (itemsError) {
          console.error('Erro ao adicionar itens:', itemsError);
        }
      }
      
      // End batch operation
      endBatchOperation(batchId);
      
      toast.success(`NT #${data.nt_number} criada com sucesso!`);
      form.reset();
      setParsedItems([]);
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Erro ao criar NT:', error);
      toast.error(error.message || 'Ocorreu um erro ao criar a NT');
    } finally {
      setIsSubmitting(false);
    }
  }

  const ntNumberValue = form.watch('nt_number');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[620px] max-h-[88vh] p-0 overflow-hidden flex flex-col bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl text-[var(--text)]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            form.handleSubmit(onSubmit)();
          }
        }}
      >
        {/* Cabeçalho do Modal */}
        <DialogHeader className="px-5 py-4 border-b border-[var(--border)] flex flex-row items-start justify-between bg-[var(--surface)] shrink-0">
          <div>
            <DialogTitle className="text-[15px] font-semibold text-[var(--text)] tracking-tight">
              Adicionar Nota Técnica
            </DialogTitle>
            <p className="text-xs text-[var(--text-3)] mt-1">
              Almoxarifado · Pesagem · Criação rápida com importação de itens
            </p>
          </div>
        </DialogHeader>

        {/* Formulário */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto px-5 py-2 space-y-4">
            {/* 1. SEÇÃO IDENTIFICAÇÃO DA NT */}
            <div className="pt-2 pb-3 border-b border-[var(--border)]">
              <div className="flex justify-between items-baseline mb-2.5">
                <span className="text-xs font-semibold text-[var(--text-2)]">Identificação</span>
                <span className="text-[11.5px] text-[var(--text-3)]">número único da NT</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)] block font-medium">Número da NT</label>
                <div className="relative">
                  <input
                    {...form.register('nt_number')}
                    placeholder="Ex.: 606349"
                    disabled={isSubmitting}
                    className={cn(
                      "h-[34px] w-full px-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors",
                      form.formState.errors.nt_number && "border-[var(--red)]"
                    )}
                  />
                  {ntNumberValue && (
                    <span className="absolute right-2.5 top-2 text-[11.5px] text-[var(--green)] font-medium flex items-center gap-1">
                      <Check size={12} strokeWidth={3} /> Válido
                    </span>
                  )}
                </div>
                {form.formState.errors.nt_number && (
                  <span className="text-[11.5px] text-[var(--red)]">
                    {form.formState.errors.nt_number.message}
                  </span>
                )}
              </div>
            </div>

            {/* 2. SEÇÃO DADOS DO SAP (ITENS) */}
            <div className="pt-1 pb-3 border-b border-[var(--border)]">
              <div className="flex justify-between items-baseline mb-2.5">
                <span className="text-xs font-semibold text-[var(--text-2)]">Itens do SAP</span>
                <span className="text-[11.5px] text-[var(--text-3)]">código, descrição e quantidade tabulados</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)] block font-medium">Dados tabulados do SAP</label>
                <textarea
                  placeholder={"Exemplo:\n011105\tSINVASTATINA (MICRONIZADA)\t30\n010071\tCELULOSE MIC (TIPO200)\t49"}
                  disabled={isSubmitting}
                  className="w-full min-h-[140px] p-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors resize-y leading-relaxed"
                  onChange={(e) => {
                    const value = handleItemsDataChange(e.target.value);
                    form.setValue('items_data', value);
                  }}
                  value={form.watch('items_data')}
                />
                <span className="text-[11.5px] text-[var(--text-3)] block">
                  Cole diretamente a tabela do SAP com Ctrl+V. Os lotes podem ser adicionados posteriormente.
                </span>
              </div>
            </div>

            {/* 3. SEÇÃO PRÉVIA DOS ITENS */}
            <div className="pt-1 pb-2">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-semibold text-[var(--text-2)]">
                  Prévia dos Itens
                </span>
                <span className="text-[11.5px] text-[var(--text-3)] font-mono">
                  {parsedItems.length} {parsedItems.length === 1 ? 'item detectado' : 'itens detectados'}
                </span>
              </div>

              <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)]">
                <div className="flex justify-between items-center px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)] text-[11.5px] text-[var(--text-3)]">
                  <span className="font-semibold text-[var(--text-2)]">Lista de Materiais</span>
                  <span>Status inicial: Aguardando Pagamento</span>
                </div>

                {parsedItems.length > 0 ? (
                  <div className="max-h-[160px] overflow-y-auto divide-y divide-[var(--border)]">
                    {parsedItems.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[30px_75px_1fr_60px] items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--hover)] transition-colors"
                      >
                        <span className="font-mono text-[11px] text-[var(--text-3)]">#{index + 1}</span>
                        <span className="font-mono font-medium text-[var(--text)]">{item.code}</span>
                        <span className="text-[var(--text-2)] truncate" title={item.description}>
                          {item.description}
                        </span>
                        <span className="text-right font-mono font-semibold text-[var(--text)]">
                          {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 px-4 text-center text-xs text-[var(--text-3)]">
                    Nenhum item colado ainda. Digite ou cole os dados acima para visualizar a prévia.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rodapé do Modal com Atalhos e Ações */}
          <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
            <span className="flex-1 text-[11.5px] text-[var(--text-3)]">
              <kbd className="font-mono text-[10.5px] border border-[var(--border-strong)] rounded px-1.5 py-0.5 text-[var(--text-2)]">Ctrl</kbd>+<kbd className="font-mono text-[10.5px] border border-[var(--border-strong)] rounded px-1.5 py-0.5 text-[var(--text-2)]">Enter</kbd> salva · <kbd className="font-mono text-[10.5px] border border-[var(--border-strong)] rounded px-1.5 py-0.5 text-[var(--text-2)]">Esc</kbd> fecha
            </span>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-8 px-4 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Criando NT...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  <span>Criar NT</span>
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}