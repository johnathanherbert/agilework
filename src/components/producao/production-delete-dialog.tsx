"use client";

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteProductionItem } from '@/lib/production-helpers';
import { ProductionItem } from '@/types';

interface ProductionDeleteDialogProps {
  item: ProductionItem | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function ProductionDeleteDialog({ item, onOpenChange, onDeleted }: ProductionDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    if (!item) return;
    setDeleting(true);
    try {
      await deleteProductionItem(item.id);
      toast.success('Item excluído com sucesso!');
      onOpenChange(false);
      onDeleted?.();
    } catch (error: any) {
      console.error('Erro ao excluir item de produção:', error);
      toast.error(error.message || 'Ocorreu um erro ao excluir o item');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={!!item} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir item de produção</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <span className="font-semibold">{item?.produto}</span>? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
