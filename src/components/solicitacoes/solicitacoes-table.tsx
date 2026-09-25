"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Solicitacao } from "@/types/solicitacao";
import { SolicitacaoStatusDialog } from "./solicitacao-status-dialog";
import { Trash2, ArrowUpDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SolicitacoesTableProps {
  solicitacoes: Solicitacao[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pendente: { label: "Pendente", variant: "secondary" },
  aprovada: { label: "Aprovada", variant: "default" },
  recusada: { label: "Recusada", variant: "destructive" },
  entregue: { label: "Entregue", variant: "outline" },
};

const prioridadeConfig: Record<string, { label: string; className: string }> = {
  baixa: {
    label: "Baixa",
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  },
  media: {
    label: "Média",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  },
  alta: {
    label: "Alta",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  },
  urgente: {
    label: "Urgente",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  },
};

export function SolicitacoesTable({
  solicitacoes,
  onStatusChange,
  onDelete,
  isLoading,
}: SolicitacoesTableProps) {
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<Solicitacao | null>(null);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedSolicitacoes = [...solicitacoes].sort((a, b) => {
    const aVal = a[sortField as keyof Solicitacao];
    const bVal = b[sortField as keyof Solicitacao];

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    const comparison = String(aVal).localeCompare(String(bVal));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Carregando solicitações...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Lista de Solicitações ({solicitacoes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("codigo_mp")}
                    >
                      Código MP <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("nome_mp")}
                    >
                      Nome MP <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("quantidade_solicitada")}
                    >
                      Quantidade <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("status")}
                    >
                      Status <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("prioridade")}
                    >
                      Prioridade <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("solicitante")}
                    >
                      Solicitante <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("data_necessidade")}
                    >
                      Data Necessidade <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSolicitacoes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      Nenhuma solicitação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedSolicitacoes.map((solicitacao) => (
                    <TableRow key={solicitacao.id}>
                      <TableCell className="font-mono font-medium">
                        {solicitacao.codigo_mp}
                      </TableCell>
                      <TableCell>{solicitacao.nome_mp}</TableCell>
                      <TableCell>
                        {Number(solicitacao.quantidade_solicitada).toFixed(3)}{" "}
                        {solicitacao.unidade}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            statusConfig[solicitacao.status]?.variant || "secondary"
                          }
                        >
                          {statusConfig[solicitacao.status]?.label ||
                            solicitacao.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            prioridadeConfig[solicitacao.prioridade]?.className || ""
                          }`}
                        >
                          {prioridadeConfig[solicitacao.prioridade]?.label ||
                            solicitacao.prioridade}
                        </span>
                      </TableCell>
                      <TableCell>{solicitacao.solicitante}</TableCell>
                      <TableCell>
                        {solicitacao.data_necessidade
                          ? format(
                              new Date(solicitacao.data_necessidade + "T12:00:00"),
                              "dd/MM/yyyy",
                              { locale: ptBR }
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSolicitacao(solicitacao)}
                          >
                            Status
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (
                                confirm(
                                  "Tem certeza que deseja excluir esta solicitação?"
                                )
                              ) {
                                onDelete(solicitacao.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedSolicitacao && (
        <SolicitacaoStatusDialog
          solicitacao={selectedSolicitacao}
          open={!!selectedSolicitacao}
          onOpenChange={(open) => !open && setSelectedSolicitacao(null)}
          onStatusChange={(status) => {
            onStatusChange(selectedSolicitacao.id, status);
            setSelectedSolicitacao(null);
          }}
        />
      )}
    </>
  );
}
