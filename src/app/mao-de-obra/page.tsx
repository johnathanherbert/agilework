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
      <div className="flex h-screen bg-slate-100 dark:bg-slate-950">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-[64px] transition-all duration-300 overflow-hidden">
          <Topbar />

          <main className="flex-1 p-4 sm:p-5 overflow-y-auto">
            {/* Header */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black text-foreground tracking-tight">Mão de Obra</h1>
                    {connected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ao Vivo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-muted-foreground text-[10px]">
                        <WifiOff className="w-3 h-3" /> Conectando
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Escala 4x1,4x2,5x1 2026 · Folgas flexíveis
                  </p>
                </div>
              </div>

              {/* Seletor de Turno + Ações */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Seletor de Turno (Admin e Supervisor) */}
                {canSelectTurno ? (
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-xs">
                    <span className="text-[11px] font-bold text-muted-foreground px-1.5">Turno:</span>
                    {(['ALL', 1, 2, 3] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTurno(t)}
                        className={cn(
                          "h-7 px-2.5 rounded-lg text-[11px] font-bold transition-colors",
                          selectedTurno === t
                            ? "bg-primary text-white shadow-xs"
                            : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        {t === 'ALL' ? 'Geral' : `T${t}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Líder: Badge do Turno fixo */
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      {TURNO_INFO[selectedTurno as number]?.label || `Turno ${selectedTurno}`}
                    </span>
                  </div>
                )}


                
                {/* Ações Rápidas - não remover, mesmo que não usemos a importação de massa
                <Button
                  onClick={handleOpenImportarMassa}
                  variant="outline"
                  className="gap-1.5 font-bold h-9 rounded-xl text-xs border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Importar
                </Button> */}

                <Button
                  onClick={handleOpenNewOperator}
                  className="gap-1.5 font-bold h-9 rounded-xl text-xs bg-primary shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Operador
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleOpenOcorrencia()}
                  className="gap-1.5 font-bold h-9 rounded-xl text-xs shadow-xs"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-primary" />
                  Ocorrência
                </Button>

                {/* Bloquear com PIN */}
                <Button
                  type="button"
                  onClick={() => {
                    setIsPinUnlocked(false);
                    toast.success("Mão de Obra bloqueada.", { icon: "🔒" });
                  }}
                  variant="outline"
                  className="gap-1.5 font-bold h-9 rounded-xl text-xs text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs"
                  title="Bloquear acesso à Mão de Obra com PIN"
                >
                  <Lock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="hidden sm:inline">Bloquear</span>
                </Button>
              </div>
            </div>

            {/* Abas */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4 h-10 p-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs gap-0.5 flex-wrap w-auto">
                <TabsTrigger
                  value="quadro"
                  className="gap-1.5 text-xs font-bold rounded-lg px-3 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <Users className="w-3.5 h-3.5" />
                  Quadro do Dia
                </TabsTrigger>

                <TabsTrigger
                  value="escala"
                  className="gap-1.5 text-xs font-bold rounded-lg px-3 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Calendário Escala
                </TabsTrigger>

                <TabsTrigger
                  value="operadores"
                  className="gap-1.5 text-xs font-bold rounded-lg px-3 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <Users className="w-3.5 h-3.5" />
                  Operadores ({operadoresFiltrados.length})
                </TabsTrigger>

                <TabsTrigger
                  value="ocorrencias"
                  className="gap-1.5 text-xs font-bold rounded-lg px-3 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Ocorrências
                </TabsTrigger>

                {(isAdmin || isSupervisor) && (
                  <TabsTrigger
                    value="tratativas"
                    className="gap-1.5 text-xs font-bold rounded-lg px-3 data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Tratativas
                  </TabsTrigger>
                )}

                <TabsTrigger
                  value="absenteismo"
                  className="gap-1.5 text-xs font-bold rounded-lg px-3 data-[state=active]:bg-primary data-[state=active]:text-white"
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
