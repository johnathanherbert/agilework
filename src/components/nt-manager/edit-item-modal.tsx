"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { updateNTItem } from '@/lib/firestore-helpers';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FileText, Loader2, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { NTItem, ItemStatus } from '@/types';

const editItemSchema = z.object({
  code: z.string().min(1, { message: 'Código é obrigatório' }),
  description: z.string().min(1, { message: 'Descrição é obrigatória' }),
  quantity: z.string().min(1, { message: 'Quantidade é obrigatória' }),
  batch: z.string().optional(),
  status: z.enum(['Ag. Pagamento', 'Pago', 'Pago Parcial']),
  payment_time: z.string().optional(),
  priority: z.boolean().default(false),
});

type EditItemFormData = z.infer<typeof editItemSchema>;

interface EditItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  item: NTItem | null;
}

export function EditItemModal({
  open,
  onOpenChange,
  onSuccess,
  item,
}: EditItemModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<EditItemFormData>({
    resolver: zodResolver(editItemSchema),
    defaultValues: {
      code: '',
      description: '',
      quantity: '',
      batch: '',
      status: 'Ag. Pagamento',
      payment_time: '',
      priority: false,
    },
  });

  const { ref: quantityRegisterRef, ...quantityRegisterRest } = form.register('quantity');

  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = '';
    };
  }, []);

  useEffect(() => {
    if (open && item) {
      form.reset({
        code: item.code || '',
        description: item.description || '',
        quantity: item.quantity ? String(item.quantity) : '',
        batch: item.batch || '',
        status: item.status || 'Ag. Pagamento',
        payment_time: item.payment_time || '',
        priority: Boolean(item.priority),
      });

      setTimeout(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }, 50);
    }
  }, [open, item, form]);

  const watchedStatus = form.watch('status');

  async function onSubmit(data: EditItemFormData) {
    if (!item) return;
    setIsSubmitting(true);

    try {
      const updateData: Partial<NTItem> = {
        code: data.code.trim(),
        description: data.description.trim(),
        quantity: data.quantity.trim(),
        batch: data.batch ? data.batch.trim() : null,
        status: data.status as ItemStatus,
        priority: data.priority,
      };

      if (data.status === 'Pago') {
        if (data.payment_time && data.payment_time.trim()) {
          updateData.payment_time = data.payment_time.trim();
        } else if (!item.payment_time) {
          const now = new Date();
          updateData.payment_time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
      } else if (data.status === 'Ag. Pagamento') {
        updateData.payment_time = null;
      }

      await updateNTItem(item.id, updateData);
      toast.success('Material atualizado com sucesso!');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Erro ao atualizar dados do material');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          document.body.style.pointerEvents = '';
        }
        onOpenChange(val);
      }}
    >
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          quantityInputRef.current?.focus();
          quantityInputRef.current?.select();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document.body.style.pointerEvents = '';
        }}
        className="sm:max-w-[560px] max-h-[88vh] p-0 overflow-hidden flex flex-col bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl text-[var(--text)]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            form.handleSubmit(onSubmit)();
          }
        }}
      >
        {/* Cabeçalho do Modal no mesmo padrão do AddNTModal */}
        <DialogHeader className="px-5 py-4 border-b border-[var(--border)] flex flex-row items-start justify-between bg-[var(--surface)] shrink-0">
          <div>
            <DialogTitle className="text-[15px] font-semibold text-[var(--text)] tracking-tight flex items-center gap-2">
              <span>Editar Material</span>
              {item?.code && (
                <span className="font-mono text-xs text-[var(--text-3)] font-normal">
                  ({item.code})
                </span>
              )}
            </DialogTitle>
            <p className="text-xs text-[var(--text-3)] mt-1">
              Almoxarifado · Pesagem · Alteração completa de dados do insumo
            </p>
          </div>
        </DialogHeader>

        {/* Formulário com o mesmo estilo e estrutura do AddNTModal */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto px-5 py-2 space-y-4">
            {/* 1. SEÇÃO IDENTIFICAÇÃO DO MATERIAL */}
            <div className="pt-2 pb-3 border-b border-[var(--border)]">
              <div className="flex justify-between items-baseline mb-2.5">
                <span className="text-xs font-semibold text-[var(--text-2)]">Identificação & Especificação</span>
                <span className="text-[11.5px] text-[var(--text-3)]">código, lote e quantidade</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Código */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-3)] block font-medium">Código do Material</label>
                  <input
                    {...form.register('code')}
                    placeholder="Ex: 010056"
                    disabled={isSubmitting}
                    className={cn(
                      "h-[34px] w-full px-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors",
                      form.formState.errors.code && "border-[var(--red)]"
                    )}
                  />
                  {form.formState.errors.code && (
                    <span className="text-[11px] text-[var(--red)]">
                      {form.formState.errors.code.message}
                    </span>
                  )}
                </div>

                {/* Lote */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-3)] block font-medium">Lote</label>
                  <input
                    {...form.register('batch')}
                    placeholder="Ex: M4Q1234"
                    disabled={isSubmitting}
                    className="h-[34px] w-full px-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors"
                  />
                </div>

                {/* Quantidade */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-3)] block font-medium">Quantidade (kg)</label>
                  <input
                    {...quantityRegisterRest}
                    ref={(el) => {
                      quantityRegisterRef(el);
                      quantityInputRef.current = el;
                    }}
                    placeholder="Ex: 120"
                    disabled={isSubmitting}
                    className={cn(
                      "h-[34px] w-full px-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors",
                      form.formState.errors.quantity && "border-[var(--red)]"
                    )}
                  />
                  {form.formState.errors.quantity && (
                    <span className="text-[11px] text-[var(--red)]">
                      {form.formState.errors.quantity.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-1.5 mt-3">
                <label className="text-xs text-[var(--text-3)] block font-medium">Descrição do Material</label>
                <input
                  {...form.register('description')}
                  placeholder="Nome do insumo ou matéria-prima"
                  disabled={isSubmitting}
                  className={cn(
                    "h-[34px] w-full px-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors",
                    form.formState.errors.description && "border-[var(--red)]"
                  )}
                />
                {form.formState.errors.description && (
                  <span className="text-[11px] text-[var(--red)]">
                    {form.formState.errors.description.message}
                  </span>
                )}
              </div>
            </div>

            {/* 2. SEÇÃO STATUS & PESAGEM */}
            <div className="pt-1 pb-3 border-b border-[var(--border)]">
              <div className="flex justify-between items-baseline mb-2.5">
                <span className="text-xs font-semibold text-[var(--text-2)]">Status & Pesagem</span>
                <span className="text-[11.5px] text-[var(--text-3)]">controle da baixa do item</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-3)] block font-medium">Status da Pesagem</label>
                  <select
                    {...form.register('status')}
                    disabled={isSubmitting}
                    className="h-[34px] w-full px-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-xs text-[var(--text)] focus:border-[var(--accent)] outline-none transition-colors cursor-pointer"
                  >
                    <option value="Ag. Pagamento">🟡 Aguardando Pagamento</option>
                    <option value="Pago Parcial">🟣 Pago Parcial</option>
                    <option value="Pago">🟢 Pago</option>
                  </select>
                </div>

                {/* Horário de Pagamento */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-3)] block font-medium">Horário de Pagamento</label>
                  <input
                    {...form.register('payment_time')}
                    disabled={watchedStatus !== 'Pago' || isSubmitting}
                    placeholder={watchedStatus === 'Pago' ? 'Ex: 14:35' : '—'}
                    className="h-[34px] w-full px-3 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] outline-none transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* 3. SEÇÃO PRIORIDADE / URGÊNCIA */}
            <div className="pt-1 pb-2">
              <div className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--border)] p-3 bg-[var(--bg)]">
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] cursor-pointer block">
                    Item Prioritário / Urgente
                  </label>
                  <span className="text-[11.5px] text-[var(--text-3)]">
                    Destaca o material com bandeira de urgência na fila da pesagem
                  </span>
                </div>
                <Switch
                  checked={form.watch('priority')}
                  onCheckedChange={(val) => form.setValue('priority', val)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Rodapé idêntico ao AddNTModal */}
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
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}