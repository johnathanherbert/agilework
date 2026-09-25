"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Solicitacao, SaldoMP } from "@/types/solicitacao";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  TruckIcon,
  Package,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface SolicitacoesDashboardProps {
  solicitacoes: Solicitacao[];
  saldoMP: SaldoMP[];
}

const STATUS_COLORS: Record<string, string> = {
  pendente: "#f59e0b",
  aprovada: "#3b82f6",
  recusada: "#ef4444",
  entregue: "#22c55e",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: "#22c55e",
  media: "#f59e0b",
  alta: "#f97316",
  urgente: "#ef4444",
};

export function SolicitacoesDashboard({ solicitacoes, saldoMP }: SolicitacoesDashboardProps) {
  const statusCounts = {
    total: solicitacoes.length,
    pendente: solicitacoes.filter((s) => s.status === "pendente").length,
    aprovada: solicitacoes.filter((s) => s.status === "aprovada").length,
    recusada: solicitacoes.filter((s) => s.status === "recusada").length,
    entregue: solicitacoes.filter((s) => s.status === "entregue").length,
  };

  const statusData = [
    { name: "Pendente", value: statusCounts.pendente },
    { name: "Aprovada", value: statusCounts.aprovada },
    { name: "Recusada", value: statusCounts.recusada },
    { name: "Entregue", value: statusCounts.entregue },
  ].filter((d) => d.value > 0);

  const prioridadeCounts = {
    baixa: solicitacoes.filter((s) => s.prioridade === "baixa").length,
    media: solicitacoes.filter((s) => s.prioridade === "media").length,
    alta: solicitacoes.filter((s) => s.prioridade === "alta").length,
    urgente: solicitacoes.filter((s) => s.prioridade === "urgente").length,
  };

  const prioridadeData = [
    { name: "Baixa", value: prioridadeCounts.baixa, fill: PRIORIDADE_COLORS.baixa },
    { name: "Média", value: prioridadeCounts.media, fill: PRIORIDADE_COLORS.media },
    { name: "Alta", value: prioridadeCounts.alta, fill: PRIORIDADE_COLORS.alta },
    { name: "Urgente", value: prioridadeCounts.urgente, fill: PRIORIDADE_COLORS.urgente },
  ];

  // Top 10 materials with highest stock
  const topSaldoMP = [...saldoMP]
    .sort((a, b) => Number(b.saldo_total) - Number(a.saldo_total))
    .slice(0, 10)
    .map((item) => ({
      name: item.mp_nome?.substring(0, 20) || item.mp_codigo,
      saldo: Number(item.saldo_total),
    }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {statusCounts.pendente}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {statusCounts.aprovada}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recusadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {statusCounts.recusada}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregues</CardTitle>
            <TruckIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {statusCounts.entregue}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saldo na Área Summary */}
      {saldoMP.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Saldo na Área (Pesagem)
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {saldoMP.length} materiais em estoque
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-5">
              {saldoMP.slice(0, 10).map((item) => (
                <div
                  key={item.mp_codigo}
                  className="p-2 rounded-lg border bg-card text-card-foreground"
                >
                  <p className="text-xs font-mono text-muted-foreground">
                    {item.mp_codigo}
                  </p>
                  <p className="text-xs font-medium truncate" title={item.mp_nome}>
                    {item.mp_nome}
                  </p>
                  <p className="text-sm font-bold mt-1">
                    {Number(item.saldo_total).toFixed(3)} kg
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            STATUS_COLORS[entry.name.toLowerCase()] || "#8884d8"
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhuma solicitação para exibir
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prioridadeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="Quantidade">
                    {prioridadeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
