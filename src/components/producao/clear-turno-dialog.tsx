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
import { clearAllProductionItems } from '@/lib/production-helpers';

interface ClearTurnoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleared?: () => void;
}

export function ClearTurnoDialog({ open, onOpenChange, onCleared }: ClearTurnoDialogProps) {
  const [clearing, setClearing] = useState(false);

  async function handleConfirm() {
    setClearing(true);
    try {
      const removed = await clearAllProductionItems();
      toast.success(`Turno limpo! ${removed} item(ns) removido(s).`);
      onOpenChange(false);
      onCleared?.();
    } catch (error: any) {
      console.error('Erro ao limpar turno:', error);
      toast.error(error.message || 'Ocorreu um erro ao limpar o turno');
    } finally {
      setClearing(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !clearing && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Limpar turno</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja limpar <span className="font-semibold">todos os itens</span> do quadro de produção? Você poderá começar o preenchimento do zero. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={clearing}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
          >
            {clearing && <Loader2 className="h-4 w-4 animate-spin" />}
            Limpar Turno
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
