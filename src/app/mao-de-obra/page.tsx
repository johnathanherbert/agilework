"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  Users,
  CalendarDays,
  Calendar,
  Plus,
  Shield,
  Star,
  WifiOff,
  FileSpreadsheet,
  ClipboardList,
  Sun,
  Sunset,
  Moon,
  BarChart3,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import ProtectedRoute from '@/components/auth/protected-route';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
import { useLaborRealtime } from '@/hooks/useLaborRealtime';
import {
  Operator,
  LaborOccurrence,
  ProductionTurno,
  LaborOccurrenceType,
} from '@/types';

// Componentes
import { QuadroDiario } from '@/components/mao-de-obra/quadro-diario';
import { OperadoresTable } from '@/components/mao-de-obra/operadores-table';
import { OcorrenciasTab } from '@/components/mao-de-obra/ocorrencias-tab';
import { TratativasTab } from '@/components/mao-de-obra/tratativas-tab';
import { EscalaCalendarioTab } from '@/components/mao-de-obra/escala-calendario-tab';
import { AbsenteismoDashboard } from '@/components/mao-de-obra/absenteismo-dashboard';
import { OperadorModal } from '@/components/mao-de-obra/operador-modal';
import { OcorrenciaModal } from '@/components/mao-de-obra/ocorrencia-modal';
import { SaldoFolgasModal } from '@/components/mao-de-obra/saldo-folgas-modal';
import { ImportarMassaModal } from '@/components/mao-de-obra/importar-massa-modal';
import { PinGuardModal } from '@/components/mao-de-obra/pin-guard-modal';
import { cn } from '@/lib/utils';

const TURNO_INFO: Record<number, { label: string; icon: React.ReactNode }> = {
  1: { label: 'Turno 1 · 07:20–15:50', icon: <Sun className="w-3.5 h-3.5" /> },
  2: { label: 'Turno 2 · 15:50–23:45', icon: <Sunset className="w-3.5 h-3.5" /> },
  3: { label: 'Turno 3 · 23:45–07:20', icon: <Moon className="w-3.5 h-3.5" /> },
};

export default function MaoDeObraPage() {
  const { userData, loading: authLoading } = useFirebase();
  const router = useRouter();
  const { operators, occurrences, loading, connected } = useLaborRealtime();

  // Permissões
  const isAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'admin';
  const isSupervisor = userData?.role === 'supervisor';
  const isAuthorizedLeader = userData?.role === 'leader' && Boolean(userData?.allowedMaoDeObra);
  const canAccess = isAdmin || isSupervisor || isAuthorizedLeader;

  // Pode selecionar e alternar entre todos os turnos (Admin e Supervisor)
  const canSelectTurno = isAdmin || isSupervisor;

  // Turno ativo (Admin e Supervisor vêem 'ALL' por padrão, demais ficam travados no seu turno)
  const initialTurno: ProductionTurno | 'ALL' = useMemo(() => {
    if (canSelectTurno) return 'ALL';
    if (userData?.turno) return userData.turno;
    return 1;
  }, [canSelectTurno, userData?.turno]);

  const [selectedTurno, setSelectedTurno] = useState<ProductionTurno | 'ALL'>(initialTurno);
  const [activeTab, setActiveTab] = useState<string>('quadro');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [isPinUnlocked, setIsPinUnlocked] = useState(false);

  // Sincroniza e trava o turno do líder (Supervisor e Admin podem navegar livremente)
  useEffect(() => {
    if (userData && !canSelectTurno) {
      setSelectedTurno(userData.turno || 1);
    }
  }, [userData, canSelectTurno]);

  // Modais
  const [operadorModalOpen, setOperadorModalOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [ocorrenciaModalOpen, setOcorrenciaModalOpen] = useState(false);
  const [selectedOperatorForOcc, setSelectedOperatorForOcc] = useState<Operator | null>(null);
  const [defaultOccType, setDefaultOccType] = useState<LaborOccurrenceType>('falta_injustificada');
  const [saldoFolgasModalOpen, setSaldoFolgasModalOpen] = useState(false);
  const [operatorForSaldo, setOperatorForSaldo] = useState<Operator | null>(null);
  const [importarMassaModalOpen, setImportarMassaModalOpen] = useState(false);

  const handleOpenNewOperator = () => { setEditingOperator(null); setOperadorModalOpen(true); };
  const handleOpenImportarMassa = () => setImportarMassaModalOpen(true);
  const handleEditOperator = (op: Operator) => { setEditingOperator(op); setOperadorModalOpen(true); };
  const handleOpenOcorrencia = (op?: Operator, type?: LaborOccurrenceType, date?: string) => {
    setSelectedOperatorForOcc(op || null);
    if (type) setDefaultOccType(type);
    if (date) setSelectedDate(date);
    setOcorrenciaModalOpen(true);
  };
  const handleOpenSaldoFolgas = (op: Operator) => { setOperatorForSaldo(op); setSaldoFolgasModalOpen(true); };
  const handleSelectDateFromCalendar = (dateStr: string) => { setSelectedDate(dateStr); setActiveTab('quadro'); };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      </div>
    );
  }

  // Acesso negado
  if (!canAccess) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen bg-slate-100 dark:bg-slate-950">
          <Sidebar />
          <div className="flex-1 flex flex-col ml-[64px] overflow-hidden">
            <Topbar />
            <main className="flex-1 p-6 flex items-center justify-center">
              <div className="max-w-md w-full p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-foreground">Acesso Restrito</h2>
                <p className="text-xs text-muted-foreground">
                  Este módulo está disponível apenas para Administradores e Líderes autorizados.
                </p>
                <Button onClick={() => router.push('/dashboard')} className="w-full font-bold rounded-xl">
                  Voltar ao Dashboard
                </Button>
              </div>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Operadores filtrados pelo turno
  const operadoresFiltrados = operators.filter((op) => selectedTurno === 'ALL' || op.turno === selectedTurno);

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col pl-[52px] min-w-0 h-screen overflow-hidden">
          <Topbar />

          <main className="flex-1 overflow-y-auto p-5 sm:p-6 min-w-0">
            {/* Header da Página */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">Mão de Obra & Escalas</h1>
                  {connected ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ao vivo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-mono">
                      <WifiOff className="w-3 h-3" /> Conectando
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-3)] mt-0.5">
                  Escala 4x1 · 4x2 · 5x1 2026 · Gestão diária e banco de folgas flexíveis
                </p>
              </div>

              {/* Seletor de Turno + Ações Rápidas */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Seletor de Turno */}
                {canSelectTurno ? (
                  <div className="flex items-center border border-[var(--border-strong)] rounded-md overflow-hidden bg-[var(--surface)] p-0.5">
                    {(['ALL', 1, 2, 3] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTurno(t)}
                        className={cn(
                          "h-7 px-2.5 text-xs font-medium rounded transition-colors font-mono",
                          selectedTurno === t
                            ? "bg-[var(--hover)] text-[var(--text)] font-semibold shadow-xs"
                            : "text-[var(--text-3)] hover:text-[var(--text)]"
                        )}
                      >
                        {t === 'ALL' ? 'Todos 3' : `T${t}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-md">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-amber-300 font-mono">
                      {TURNO_INFO[selectedTurno as number]?.label || `Turno ${selectedTurno}`}
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleOpenNewOperator}
                  className="h-8 px-3 text-xs gap-1.5 font-medium bg-[var(--text)] text-[var(--bg)] hover:opacity-90 rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Operador
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleOpenOcorrencia()}
                  className="h-8 px-3 text-xs gap-1.5 font-medium border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] rounded-md"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Ocorrência
                </Button>
              </div>
            </div>

            {/* Abas */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-5 h-auto p-0 bg-transparent border-b border-[var(--border)] rounded-none w-full justify-start gap-1">
                <TabsTrigger
                  value="quadro"
                  className="gap-2 px-3.5 py-2 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--text)] data-[state=active]:text-[var(--text)] text-[var(--text-3)] hover:text-[var(--text)] bg-transparent data-[state=active]:bg-transparent shadow-none"
                >
                  <Users className="w-3.5 h-3.5" />
                  Quadro do Dia
                </TabsTrigger>

                <TabsTrigger
                  value="escala"
                  className="gap-2 px-3.5 py-2 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--text)] data-[state=active]:text-[var(--text)] text-[var(--text-3)] hover:text-[var(--text)] bg-transparent data-[state=active]:bg-transparent shadow-none"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Calendário Escala
                </TabsTrigger>

                <TabsTrigger
                  value="operadores"
                  className="gap-2 px-3.5 py-2 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--text)] data-[state=active]:text-[var(--text)] text-[var(--text-3)] hover:text-[var(--text)] bg-transparent data-[state=active]:bg-transparent shadow-none"
                >
                  <Users className="w-3.5 h-3.5" />
                  Operadores <span className="font-mono text-[11px] text-[var(--text-3)]">({operadoresFiltrados.length})</span>
                </TabsTrigger>

                <TabsTrigger
                  value="ocorrencias"
                  className="gap-2 px-3.5 py-2 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--text)] data-[state=active]:text-[var(--text)] text-[var(--text-3)] hover:text-[var(--text)] bg-transparent data-[state=active]:bg-transparent shadow-none"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Ocorrências
                </TabsTrigger>

                {(isAdmin || isSupervisor) && (
                  <TabsTrigger
                    value="tratativas"
                    className="gap-2 px-3.5 py-2 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--text)] data-[state=active]:text-[var(--text)] text-[var(--text-3)] hover:text-[var(--text)] bg-transparent data-[state=active]:bg-transparent shadow-none"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                    Tratativas
                  </TabsTrigger>
                )}

                <TabsTrigger
                  value="absenteismo"
                  className="gap-2 px-3.5 py-2 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--text)] data-[state=active]:text-[var(--text)] text-[var(--text-3)] hover:text-[var(--text)] bg-transparent data-[state=active]:bg-transparent shadow-none"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Absenteísmo
                </TabsTrigger>
              </TabsList>

              {/* Aba 1: Quadro do Dia */}
              <TabsContent value="quadro" className="focus-visible:outline-none">
                <QuadroDiario
                  operators={operators}
                  occurrences={occurrences}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  selectedTurno={selectedTurno}
                  onOpenNewOperator={handleOpenNewOperator}
                  onOpenOcorrencia={handleOpenOcorrencia}
                  onOpenSaldoFolgas={handleOpenSaldoFolgas}
                  onEditOperator={handleEditOperator}
                />
              </TabsContent>

              {/* Aba 2: Calendário Escala */}
              <TabsContent value="escala" className="focus-visible:outline-none">
                <EscalaCalendarioTab
                  operators={operators}
                  occurrences={occurrences}
                  selectedTurno={selectedTurno}
                  onSelectDate={handleSelectDateFromCalendar}
                  onOpenOcorrencia={handleOpenOcorrencia}
                />
              </TabsContent>

              {/* Aba 3: Operadores */}
              <TabsContent value="operadores" className="focus-visible:outline-none">
                <OperadoresTable
                  operators={operators}
                  occurrences={occurrences}
                  selectedTurno={selectedTurno}
                  onOpenNewOperator={handleOpenNewOperator}
                  onOpenImportarMassa={handleOpenImportarMassa}
                  onEditOperator={handleEditOperator}
                  onOpenOcorrencia={handleOpenOcorrencia}
                  onOpenSaldoFolgas={handleOpenSaldoFolgas}
                />
              </TabsContent>

              {/* Aba 4: Ocorrências & Histórico */}
              <TabsContent value="ocorrencias" className="focus-visible:outline-none">
                <OcorrenciasTab
                  occurrences={occurrences}
                  operators={operators}
                  selectedTurno={selectedTurno}
                  onOpenOcorrencia={() => handleOpenOcorrencia()}
                />
              </TabsContent>

              {/* Aba 5: Tratativas da Supervisão (Apenas Adm/Supervisão) */}
              {(isAdmin || isSupervisor) && (
                <TabsContent value="tratativas" className="focus-visible:outline-none">
                  <TratativasTab
                    occurrences={occurrences}
                    operators={operators}
                    selectedTurno={selectedTurno}
                  />
                </TabsContent>
              )}

              {/* Aba 6: Absenteísmo */}
              <TabsContent value="absenteismo" className="focus-visible:outline-none">
                <AbsenteismoDashboard
                  operators={operators}
                  occurrences={occurrences}
                  selectedTurno={selectedTurno}
                />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      {/* Modais */}
      <OperadorModal
        open={operadorModalOpen}
        onOpenChange={setOperadorModalOpen}
        operator={editingOperator}
        defaultTurno={selectedTurno === 'ALL' ? 1 : selectedTurno}
      />

      <OcorrenciaModal
        open={ocorrenciaModalOpen}
        onOpenChange={setOcorrenciaModalOpen}
        operators={operators.filter((op) => (selectedTurno === 'ALL' || op.turno === selectedTurno) && op.status !== 'inativo')}
        selectedOperator={selectedOperatorForOcc}
        defaultDate={selectedDate}
        defaultType={defaultOccType}
        occurrences={occurrences}
      />

      <SaldoFolgasModal
        open={saldoFolgasModalOpen}
        onOpenChange={setSaldoFolgasModalOpen}
        operator={operatorForSaldo}
      />

      <ImportarMassaModal
        open={importarMassaModalOpen}
        onOpenChange={setImportarMassaModalOpen}
      />

      {/* Modal de Bloqueio por PIN de Segurança */}
      <PinGuardModal
        isUnlocked={isPinUnlocked}
        onUnlock={() => setIsPinUnlocked(true)}
      />
    </ProtectedRoute>
  );
}
