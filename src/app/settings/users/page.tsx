"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFirebase, ADMIN_EMAIL } from "@/components/providers/firebase-provider";
import { getAllUsers, deleteUserDb, editUserDb, wipeDataByCategory, resetUserMaoDeObraPin } from "@/lib/firestore-helpers";
import {
  Shield, ShieldCheck, ShieldAlert, Trash2, X, UserCheck,
  Database, AlertTriangle, AlertCircle, RefreshCcw, Star, Users, Loader2, Search, Key, Lock, SlidersHorizontal,
} from "lucide-react";
import { UserManageModal } from "@/components/users/user-manage-modal";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import ProtectedRoute from "@/components/auth/protected-route";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { ProductionTurno, UserRole } from "@/types";

interface UserItem {
  uid: string;
  email: string;
  name?: string;
  isApproved?: boolean;
  role?: UserRole;
  turno?: ProductionTurno | null;
  allowedMaoDeObra?: boolean;
  pinMaoDeObra?: string | null;
  pinMaoDeObraUpdatedAt?: string;
  created_at?: string;
  lastActive?: any;
}

const INACTIVE_DAYS_THRESHOLD = 15;

function parseLastActiveDate(lastActive: any): Date | null {
  if (!lastActive) return null;

  if (typeof lastActive?.toDate === 'function') {
    const dt = lastActive.toDate();
    return dt instanceof Date && !Number.isNaN(dt.getTime()) ? dt : null;
  }

  if (typeof lastActive?.seconds === 'number') {
    return new Date(lastActive.seconds * 1000);
  }

  if (typeof lastActive?._seconds === 'number') {
    return new Date(lastActive._seconds * 1000);
  }

  if (typeof lastActive === 'string' || typeof lastActive === 'number') {
    const dt = new Date(lastActive);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

function getLastActiveInfo(lastActive: any) {
  const date = parseLastActiveDate(lastActive);

  if (!date) {
    return {
      hasData: false,
      text: 'Sem registro de atividade',
      inactiveDays: null as number | null,
      isInactive: true,
    };
  }

  const diffMs = Date.now() - date.getTime();
  const inactiveDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  return {
    hasData: true,
    text: date.toLocaleString('pt-BR'),
    inactiveDays,
    isInactive: inactiveDays >= INACTIVE_DAYS_THRESHOLD,
  };
}

function StatCard({ icon, label, value, tone = 'primary' }: { icon: React.ReactNode; label: string; value: string | number; tone?: 'primary' | 'green' | 'amber' | 'accent' }) {
  const toneClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    accent: 'bg-accent/10 text-accent',
  };
  return (
    <Card>
      <CardContent className="p-3.5 flex items-center gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", toneClasses[tone])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground truncate leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminControlPanelPage() {
  const { userData, loading } = useFirebase();
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Tabs & Navigation
  const [activeTab, setActiveTab] = useState<'users' | 'maintenance'>('users');

  // Manage User Modal State
  const [selectedUserForManage, setSelectedUserForManage] = useState<UserItem | null>(null);

  // Delete User State
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Reset PIN State
  const [userToResetPin, setUserToResetPin] = useState<UserItem | null>(null);
  const [resettingPin, setResettingPin] = useState(false);

  // Maintenance State
  const [wiping, setWiping] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [showWipeDialog, setShowWipeDialog] = useState(false);
  const [wipeCategories, setWipeCategories] = useState({
    nts: false,
    items: false,
    users: false
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'supervisor' | 'leader' | 'user'>('all');
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);

  const stats = useMemo(() => {
    const total = users.length;
    const ativos = users.filter((u) => u.isApproved || u.email === ADMIN_EMAIL).length;
    const pendentes = users.filter((u) => !u.isApproved && u.email !== ADMIN_EMAIL).length;
    const lideres = users.filter((u) => u.role === 'leader').length;
    const supervisores = users.filter((u) => u.role === 'supervisor').length;
    const inativos = users.filter((u) => getLastActiveInfo(u.lastActive).isInactive).length;
    return { total, ativos, pendentes, lideres, supervisores, inativos };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users
      .filter((user) => {
        const isAdmin = user.email === ADMIN_EMAIL;
        const name = (user.name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const role = (user.role || 'user').toLowerCase();
        const approved = !!user.isApproved || isAdmin;

        if (query && !name.includes(query) && !email.includes(query) && !role.includes(query)) {
          return false;
        }

        if (statusFilter === 'active' && !approved) {
          return false;
        }

        if (statusFilter === 'revoked' && approved) {
          return false;
        }

        if (statusFilter === 'inactive' && !getLastActiveInfo(user.lastActive).isInactive) {
          return false;
        }

        if (roleFilter === 'admin' && !isAdmin) {
          return false;
        }

        if (roleFilter === 'supervisor' && (isAdmin || user.role !== 'supervisor')) {
          return false;
        }

        if (roleFilter === 'leader' && (isAdmin || user.role !== 'leader')) {
          return false;
        }

        if (roleFilter === 'user' && (isAdmin || user.role === 'leader' || user.role === 'supervisor')) {
          return false;
        }

        if (showInactiveOnly && !getLastActiveInfo(user.lastActive).isInactive) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aIsAdmin = a.email === ADMIN_EMAIL;
        const bIsAdmin = b.email === ADMIN_EMAIL;

        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;

        const aName = (a.name || a.email || '').toLowerCase();
        const bName = (b.name || b.email || '').toLowerCase();
        return aName.localeCompare(bName, 'pt-BR');
      });
  }, [users, searchQuery, statusFilter, roleFilter, showInactiveOnly]);

  // Protection: only admin can access
  useEffect(() => {
    if (!loading) {
      if (!userData || userData.email !== ADMIN_EMAIL) {
        toast.error("Acesso negado. Apenas administradores podem ver esta página.");
        router.push("/dashboard");
      } else {
        fetchUsers();
      }
    }
  }, [userData, loading, router]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersData = await getAllUsers();
      setUsers(usersData as UserItem[]);
    } catch (error) {
      toast.error("Erro ao carregar usuários.");
      console.error(error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const requestDeleteUser = (user: UserItem) => {
    if (user.email === ADMIN_EMAIL) {
      toast.error("Não é possível deletar o admin principal.");
      return;
    }
    setUserToDelete(user);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await deleteUserDb(userToDelete.uid);
      toast.success("Usuário removido da base de dados.");
      setUsers(prev => prev.filter(u => u.uid !== userToDelete.uid));
      setUserToDelete(null);
    } catch (error) {
      toast.error("Erro ao deletar usuário.");
    } finally {
      setDeletingUser(false);
    }
  };

  const handleSaveUserFromModal = async (
    uid: string,
    data: {
      name: string;
      isApproved: boolean;
      role: UserRole;
      turno: ProductionTurno | null;
      allowedMaoDeObra: boolean;
    }
  ) => {
    await editUserDb(uid, data);
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, ...data } : u)));
    if (selectedUserForManage?.uid === uid) {
      setSelectedUserForManage((prev) => (prev ? { ...prev, ...data } : null));
    }
  };

  const confirmResetPin = async () => {
    if (!userToResetPin) return;
    setResettingPin(true);
    try {
      await resetUserMaoDeObraPin(userToResetPin.uid);
      toast.success(`PIN de ${userToResetPin.name || userToResetPin.email} foi resetado. No próximo acesso a Mão de Obra, o usuário criará um novo PIN.`);
      setUsers(prev => prev.map(u => u.uid === userToResetPin.uid ? { ...u, pinMaoDeObra: null } : u));
      setUserToResetPin(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao resetar PIN do usuário.");
    } finally {
      setResettingPin(false);
    }
  };

  const handleWipeDatabase = async () => {
    if (wipeConfirmText !== 'WIPE') {
      toast.error("Texto de confirmação incorreto.");
      return;
    }
    if (!wipeCategories.nts && !wipeCategories.items && !wipeCategories.users) {
      toast.error("Nenhuma categoria selecionada para o Wipe.");
      return;
    }

    setWiping(true);
    try {
      const stats = await wipeDataByCategory(wipeCategories);
      toast.success(`Base Limpa! ${stats.nts} NTs, ${stats.items} Itens e ${stats.users} Usuários removidos.`);
      setShowWipeDialog(false);
      setWipeConfirmText("");
      setWipeCategories({ nts: false, items: false, users: false });
    } catch (error) {
      toast.error("Erro ao realizar Wipe da Base de Dados.");
    } finally {
      setWiping(false);
    }
  };

  if (loading || loadingUsers) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      </div>
    );
  }

  if (!userData || userData.email !== ADMIN_EMAIL) return null;

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-[64px] transition-all duration-300">
          <Topbar />
          <main className="flex-1 p-4 sm:p-5 overflow-y-auto">
            <div className="mb-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-md">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Painel de Controle Admin</h1>
                <p className="text-sm text-muted-foreground font-medium">Gestão de usuários e manutenção do sistema</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard icon={<Users className="h-5 w-5" />} label="Total de Usuários" value={stats.total} tone="primary" />
              <StatCard icon={<UserCheck className="h-5 w-5" />} label="Ativos" value={stats.ativos} tone="green" />
              <StatCard icon={<ShieldAlert className="h-5 w-5" />} label="Pendentes" value={stats.pendentes} tone="amber" />
              <StatCard icon={<Star className="h-5 w-5" />} label="Inativos" value={stats.inativos} tone="accent" />
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'users' | 'maintenance')}>
              <TabsList className="mb-4 h-9">
                <TabsTrigger value="users" className="gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Usuários
                </TabsTrigger>
                <TabsTrigger value="maintenance" className="gap-2">
                  <Database className="w-4 h-4" />
                  Manutenção
                </TabsTrigger>
              </TabsList>

              <TabsContent value="users">
                <Card>
                  <CardContent className="p-0">
                    <div className="px-4 py-3.5 border-b border-border/80 bg-gradient-to-r from-slate-50 to-blue-50/60 dark:from-slate-900 dark:to-slate-800">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-bold text-foreground">Gestão de Usuários</h2>
                          <p className="text-sm text-muted-foreground mt-1">
                            Gerencie cadastro, perfil e permissões com pesquisa rápida.
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs font-bold px-3 py-1.5 w-fit">
                          Exibindo: {filteredUsers.length} de {users.length}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                        <div className="lg:col-span-6 relative">
                          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                          <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nome, e-mail ou função..."
                            className="pl-9 h-9 bg-white/90 dark:bg-slate-900"
                          />
                        </div>

                        <div className="lg:col-span-3">
                          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'revoked' | 'inactive')}>
                            <SelectTrigger className="h-9 bg-white/90 dark:bg-slate-900">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos status</SelectItem>
                              <SelectItem value="active">Apenas ativos</SelectItem>
                              <SelectItem value="revoked">Apenas revogados</SelectItem>
                              <SelectItem value="inactive">Apenas inativos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="lg:col-span-3 flex items-center gap-2">
                          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'all' | 'admin' | 'supervisor' | 'leader' | 'user')}>
                            <SelectTrigger className="h-9 bg-white/90 dark:bg-slate-900">
                              <SelectValue placeholder="Função" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todas funções</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                              <SelectItem value="leader">Líder</SelectItem>
                              <SelectItem value="user">Usuário</SelectItem>
                            </SelectContent>
                          </Select>

                          {(searchQuery || statusFilter !== 'all' || roleFilter !== 'all' || showInactiveOnly) && (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-9 px-3"
                              onClick={() => {
                                setSearchQuery('');
                                setStatusFilter('all');
                                setRoleFilter('all');
                                setShowInactiveOnly(false);
                              }}
                              title="Limpar filtros"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="lg:col-span-12 flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={showInactiveOnly ? 'default' : 'outline'}
                            className="h-8 text-xs"
                            onClick={() => setShowInactiveOnly((v) => !v)}
                          >
                            {showInactiveOnly ? 'Mostrando somente inativos' : 'Mostrar somente inativos'}
                          </Button>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            Critério: sem atividade há {INACTIVE_DAYS_THRESHOLD}+ dias.
                          </span>
                        </div>
                      </div>
                    </div>

                    <ul className="divide-y divide-border/80">
                      {filteredUsers.length === 0 ? (
                        <li className="px-6 py-12 text-center text-muted-foreground font-medium">
                          Nenhum usuário encontrado com os filtros atuais.
                        </li>
                      ) : (
                        filteredUsers.map((user) => {
                          const isAdmin = user.email === ADMIN_EMAIL;
                          const isApproved = user.isApproved;
                          const displayName = user.name || "Sem Nome Definido";
                          const lastActiveInfo = getLastActiveInfo(user.lastActive);
                          const initials = displayName
                            .split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p) => p[0]?.toUpperCase())
                            .join('') || 'U';

                          return (
                            <li
                              key={user.uid}
                              onClick={() => setSelectedUserForManage(user)}
                              className="px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                {/* Informações e Badges do Usuário */}
                                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-800 dark:text-slate-100 shrink-0 shadow-2xs">
                                    {initials}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-sm font-black text-foreground truncate">
                                        {displayName}
                                      </p>

                                      {/* Badge de Cargo */}
                                      {isAdmin ? (
                                        <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-primary/30 text-[10px] font-black">
                                          <ShieldCheck className="w-3 h-3 mr-1" />
                                          Admin Global
                                        </Badge>
                                      ) : user.role === 'supervisor' ? (
                                        <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] font-black">
                                          <Shield className="w-3 h-3 mr-1 text-purple-500" />
                                          Supervisor {user.turno ? `(T${user.turno})` : ''}
                                        </Badge>
                                      ) : user.role === 'leader' ? (
                                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-black">
                                          <Star className="w-3 h-3 mr-1 text-amber-500" />
                                          Líder {user.turno ? `(T${user.turno})` : ''}
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">
                                          Usuário
                                        </Badge>
                                      )}

                                      {/* Badge de Mão de Obra */}
                                      {!isAdmin && user.role === 'leader' && (
                                        user.allowedMaoDeObra ? (
                                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-black gap-1">
                                            <Users className="w-3 h-3 text-emerald-500" /> Mão de Obra
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800 text-[10px] font-bold">
                                            M.O. Bloqueado
                                          </Badge>
                                        )
                                      )}

                                      {/* Badge de PIN */}
                                      {user.pinMaoDeObra ? (
                                        <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30 text-[10px] font-black gap-1">
                                          <Key className="w-3 h-3 text-violet-500" /> PIN Ativo
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800 text-[10px] font-bold gap-1">
                                          <Key className="w-3 h-3 text-slate-400" /> Sem PIN
                                        </Badge>
                                      )}

                                      {/* Badge de Status Ativo/Bloqueado/Inativo */}
                                      {!isAdmin && !isApproved ? (
                                        <Badge variant="destructive" className="text-[10px] font-black gap-1">
                                          <ShieldAlert className="w-3 h-3" /> Bloqueado
                                        </Badge>
                                      ) : !isAdmin && lastActiveInfo.isInactive ? (
                                        <Badge variant="outline" className="text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-[10px] font-bold">
                                          Inativo {lastActiveInfo.inactiveDays !== null ? `(${lastActiveInfo.inactiveDays}d)` : ''}
                                        </Badge>
                                      ) : !isAdmin ? (
                                        <Badge variant="success" className="text-[10px] font-bold">
                                          Ativo
                                        </Badge>
                                      ) : null}
                                    </div>

                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                                      <span className="truncate">{user.email}</span>
                                      <span className="text-slate-300 dark:text-slate-700">•</span>
                                      <span className="text-[11px]">Online: {lastActiveInfo.text}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Botão de Ação para Abrir o Modal */}
                                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedUserForManage(user);
                                    }}
                                    className="h-8 px-3 text-xs font-bold gap-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-xl shadow-xs"
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                    <span>Gerenciar Acesso</span>
                                  </Button>
                                </div>
                              </div>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="maintenance">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-2 border-red-200 dark:border-red-900/50 flex flex-col">
                    <div className="p-5 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 flex items-center gap-3 rounded-t-lg">
                      <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                      <h3 className="text-lg font-bold text-red-800 dark:text-red-400">Zona de Risco: Limpeza da Base</h3>
                    </div>
                    <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Selecione as categorias que deseja remover permanentemente do Firestore. Cuidado: excluir Itens sem excluir NTs vai invalidar os números do painel.
                        </p>

                        <div className="flex flex-col gap-2 mt-4 mb-2">
                          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-red-100/50 dark:bg-red-900/30 border border-red-200 dark:border-red-900/50 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                            <Checkbox checked={wipeCategories.nts} onCheckedChange={(c) => setWipeCategories(p => ({ ...p, nts: c === true }))} />
                            <span className="text-sm font-bold text-red-900 dark:text-red-300">Tabela Mestre (NTs Registradas)</span>
                          </label>
                          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-red-100/50 dark:bg-red-900/30 border border-red-200 dark:border-red-900/50 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                            <Checkbox checked={wipeCategories.items} onCheckedChange={(c) => setWipeCategories(p => ({ ...p, items: c === true }))} />
                            <span className="text-sm font-bold text-red-900 dark:text-red-300">Tabela Operacional (Sub-Itens / Cálculos KPIs)</span>
                          </label>
                          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-red-100/50 dark:bg-red-900/30 border border-red-200 dark:border-red-900/50 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                            <Checkbox checked={wipeCategories.users} onCheckedChange={(c) => setWipeCategories(p => ({ ...p, users: c === true }))} />
                            <span className="text-sm font-bold text-red-900 dark:text-red-300">Usuários Comuns (Protege Admin)</span>
                          </label>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full gap-2"
                        onClick={() => setShowWipeDialog(true)}
                        disabled={!wipeCategories.nts && !wipeCategories.items && !wipeCategories.users}
                      >
                        <Trash2 className="w-5 h-5" /> Iniciar Limpeza da Base
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="flex flex-col">
                    <div className="p-5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-3 rounded-t-lg">
                      <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-lg font-bold text-blue-800 dark:text-blue-400">Guia: Status do Servidor</h3>
                    </div>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/40 border border-border/60">
                        <Database className="w-6 h-6 text-emerald-500 shrink-0" />
                        <div>
                          <h4 className="font-bold text-foreground">Backups de Rotina</h4>
                          <p className="text-sm text-muted-foreground mt-1">O Firestore é redundante, mas limpezas executadas manualmente nesta interface ignoram lixeiras temporárias. Muito cuidado.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/40 border border-border/60">
                        <RefreshCcw className="w-6 h-6 text-amber-500 shrink-0" />
                        <div>
                          <h4 className="font-bold text-foreground">Ciclo de Vida da Autenticação</h4>
                          <p className="text-sm text-muted-foreground mt-1">A exclusão do usuário remove o acesso do banco de dados. O e-mail da pessoa continuará na Base do Google até ela ser descadastrada do IAM principal.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      <AlertDialog open={showWipeDialog} onOpenChange={(open) => { if (!wiping) { setShowWipeDialog(open); if (!open) setWipeConfirmText(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Limpeza da Base
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <span className="font-semibold text-foreground">irreversível</span>. Digite <span className="font-mono font-bold">WIPE</span> abaixo para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            placeholder="WIPE"
            value={wipeConfirmText}
            onChange={(e) => setWipeConfirmText(e.target.value)}
            className="text-center uppercase font-black tracking-widest"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wiping} onClick={() => setWipeConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleWipeDatabase();
              }}
              disabled={wipeConfirmText !== 'WIPE' || wiping}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {wiping && <Loader2 className="h-4 w-4 animate-spin" />}
              Limpar Base
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && !deletingUser && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir definitivamente <span className="font-semibold text-foreground">{userToDelete?.name || userToDelete?.email}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteUser();
              }}
              disabled={deletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deletingUser && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!userToResetPin} onOpenChange={(open) => !open && !resettingPin && setUserToResetPin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-400">
              <Key className="h-5 w-5" />
              Resetar PIN de Mão de Obra
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja resetar o PIN de segurança de <span className="font-semibold text-foreground">{userToResetPin?.name || userToResetPin?.email}</span>?
              <br /><br />
              No próximo acesso ao módulo de Mão de Obra, o sistema solicitará automaticamente que o usuário cadastre um novo PIN de 4 a 6 dígitos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resettingPin}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmResetPin();
              }}
              disabled={resettingPin}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
            >
              {resettingPin && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Reset de PIN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Gerenciamento Unificado de Acessos do Usuário */}
      <UserManageModal
        open={!!selectedUserForManage}
        onOpenChange={(open) => !open && setSelectedUserForManage(null)}
        user={selectedUserForManage}
        onSave={handleSaveUserFromModal}
        onResetPin={(u) => setUserToResetPin(u as UserItem)}
        onDeleteUser={(u) => requestDeleteUser(u as UserItem)}
      />
    </ProtectedRoute>
  );
}
