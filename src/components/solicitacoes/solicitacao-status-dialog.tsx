"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Solicitacao } from "@/types/solicitacao";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface SolicitacaoStatusDialogProps {
  solicitacao: Solicitacao;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: string) => void;
}

export function SolicitacaoStatusDialog({
  solicitacao,
  open,
  onOpenChange,
  onStatusChange,
}: SolicitacaoStatusDialogProps) {
  const [newStatus, setNewStatus] = useState<string>(solicitacao.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar Status da Solicitação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Código MP:</span>
            <span className="font-mono font-medium">{solicitacao.codigo_mp}</span>
            <span className="text-muted-foreground">Nome MP:</span>
            <span className="font-medium">{solicitacao.nome_mp}</span>
            <span className="text-muted-foreground">Quantidade:</span>
            <span className="font-medium">
              {Number(solicitacao.quantidade_solicitada).toFixed(3)} {solicitacao.unidade}
            </span>
            <span className="text-muted-foreground">Solicitante:</span>
            <span className="font-medium">{solicitacao.solicitante}</span>
            <span className="text-muted-foreground">Status Atual:</span>
            <Badge variant="secondary">{solicitacao.status}</Badge>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Novo Status</label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="recusada">Recusada</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onStatusChange(newStatus)}>
            Salvar Alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
