   "use client";

import { useState } from 'react';
import { deleteNT, deleteNTItem } from '@/lib/firestore-helpers';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
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

interface DeleteConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  description: string;
  isDeleting: boolean;
  entityType?: 'nt' | 'item';
  entityId?: string;
}

export function DeleteConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title,
  description,
  isDeleting,
  entityType,
  entityId,
}: DeleteConfirmationModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!entityType || !entityId) {
      onConfirm();
      return;
    }
    
    setLoading(true);
    
    try {
      if (entityType === 'nt') {
        await deleteNT(entityId);
      } else if (entityType === 'item') {
        await deleteNTItem(entityId);
      }
      
      toast.success(`${entityType === 'nt' ? 'NT' : 'Item'} excluído com sucesso!`);
      onConfirm();
    } catch (error: any) {
      console.error(`Erro ao excluir ${entityType}:`, error);
      toast.error(error.message || `Ocorreu um erro ao excluir o ${entityType === 'nt' ? 'NT' : 'item'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading || isDeleting} onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || isDeleting}
          >
            {loading || isDeleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}