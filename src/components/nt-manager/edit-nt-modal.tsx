"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { updateNT } from '@/lib/firestore-helpers';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NT } from '@/types';

interface EditNTModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  nt: NT | null;
}

const formSchema = z.object({
  nt_number: z
    .string()
    .min(1, { message: 'Número da NT é obrigatório' }),
});

type FormData = z.infer<typeof formSchema>;

export function EditNTModal({ open, onOpenChange, onSuccess, nt }: EditNTModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nt_number: '',
    },
  });

  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = '';
    };
  }, []);

  // Update form values when NT changes
  useEffect(() => {
    if (open && nt) {
      form.reset({
        nt_number: nt.nt_number,
      });
    }
  }, [open, nt, form]);

  const ntNumberValue = form.watch('nt_number');

  async function onSubmit(data: FormData) {
    if (!nt) return;

    setIsSubmitting(true);

    try {
      await updateNT(nt.id, data.nt_number.trim());

      toast.success('Nota Técnica atualizada com sucesso!');
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Erro ao atualizar NT:', error);
      toast.error(error.message || 'Ocorreu um erro ao atualizar a NT');
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
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document.body.style.pointerEvents = '';
        }}
        className="sm:max-w-[480px] p-0 overflow-hidden flex flex-col bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl text-[var(--text)]"
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
            <DialogTitle className="text-[15px] font-semibold text-[var(--text)] tracking-tight flex items-center gap-2">
              <span>Editar Nota Técnica</span>
              {nt?.nt_number && (
                <span className="font-mono text-xs text-[var(--text-3)] font-normal">
                  (#{nt.nt_number})
                </span>
              )}
            </DialogTitle>
            <p className="text-xs text-[var(--text-3)] mt-1">
              Almoxarifado · Pesagem · Alteração de identificação da NT
            </p>
          </div>
        </DialogHeader>

        {/* Formulário */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
          <div className="px-5 py-4 space-y-4">
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

          {/* Rodapé do Modal */}
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