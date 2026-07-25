"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveHeijunkaSnapshot } from '@/lib/heijunka-helpers';
import { ProductionItem } from '@/types';
import { Loader2, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface HeijunkaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ProductionItem[];
  onSaved?: () => void;
}

export function HeijunkaDialog({ open, onOpenChange, items, onSaved }: HeijunkaDialogProps) {
  const [saving, setSaving] = useState(false);
  const [metaDiaria, setMetaDiaria] = useState<string>('');

  const ordensCount = items.filter((i) => i.tipo === 'ordem').length;

  async function handleConfirm() {
    const meta = Number(metaDiaria);
    if (!meta || meta <= 0) {
      toast.error('Por favor, informe uma meta diária válida maior que zero.');
      return;
    }

    setSaving(true);
    try {
      await saveHeijunkaSnapshot(meta, items);
      toast.success('Heijunka fechado com sucesso! O quadro de produção foi limpo.');
      onOpenChange(false);
      onSaved?.();
      setMetaDiaria(''); // reset para o próximo uso
    } catch (error: any) {
      console.error('Erro ao fechar Heijunka:', error);
      toast.error(error.message || 'Erro ao fechar Heijunka');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Lançar Heijunka
          </AlertDialogTitle>
          <AlertDialogDescription>
            AVISO ESSE PROCESSO DEVE SER EXECUTADO NO FINAL DO DIA DE PRODUÇÃO PELO <strong className="text-destructive">3º TURNO</strong>. <br />
            Você está prestes a fechar o dia de produção. Este processo irá salvar 
            os totais de <strong className="text-foreground">{ordensCount} ordens</strong> no histórico e 
            <strong className="text-destructive"> limpará todo o quadro</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaDiaria">Qual é a meta diária (Total Programado) de hoje?</Label>
            <Input
              id="metaDiaria"
              type="number"
              placeholder="Ex: 45"
              value={metaDiaria}
              onChange={(e) => setMetaDiaria(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={saving || !metaDiaria}
            className="gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar Fechamento
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
