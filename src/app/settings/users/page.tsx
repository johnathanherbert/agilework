"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFirebase, ADMIN_EMAIL } from "@/components/providers/firebase-provider";
import { getAllUsers, updateUserStatus, deleteUserDb, editUserDb, wipeDataByCategory } from "@/lib/firestore-helpers";
import {
  Shield, ShieldCheck, ShieldAlert, UserX, UserCheck, Trash2, Edit, Save, X,
  Database, AlertTriangle, AlertCircle, RefreshCcw, Star, Users, Loader2,
} from "lucide-react";
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

interface UserItem {
  uid: string;
  email: string;
  name?: string;
  isApproved?: boolean;
  role?: 'user' | 'leader';
  created_at?: string;
  lastActive?: any;
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
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", toneClasses[tone])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground truncate">{value}</p>
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

  // Edit User State
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; isApproved: boolean; role: 'user' | 'leader' }>({ name: '', isApproved: false, role: 'user' });

  // Delete User State
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Maintenance State
  const [wiping, setWiping] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [showWipeDialog, setShowWipeDialog] = useState(false);
  const [wipeCategories, setWipeCategories] = useState({
    nts: false,
    items: false,
    users: false
  });

  const stats = useMemo(() => {
    const total = users.length;
    const ativos = users.filter((u) => u.isApproved || u.email === ADMIN_EMAIL).length;
    const pendentes = users.filter((u) => !u.isApproved && u.email !== ADMIN_EMAIL).length;
    const lideres = users.filter((u) => u.role === 'leader').length;
    return { total, ativos, pendentes, lideres };
  }, [users]);

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

  const handleToggleStatus = async (user: UserItem) => {
    if (user.email === ADMIN_EMAIL) {
      toast.error("Não é possível alterar o status do administrador principal.");
      return;
    }

    const newStatus = !user.isApproved;
    try {
      await updateUserStatus(user.uid, newStatus);
      toast.success(`Usuário ${newStatus ? 'aprovado' : 'desabilitado'} com sucesso.`);
      
      setUsers(prev => 
        prev.map(u => 
          u.uid === user.uid ? { ...u, isApproved: newStatus } : u
        )
      );
    } catch (error) {
      toast.error("Erro ao alterar status do usuário.");
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

  const handleEditInitiate = (user: UserItem) => {
    if (user.email === ADMIN_EMAIL) {
      toast.error("O admin global não pode ser editado nesta tela.");
      return;
    }
    setEditingUser(user);
    setEditForm({ name: user.name || '', isApproved: user.isApproved || false, role: user.role || 'user' });
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    try {
      await editUserDb(editingUser.uid, { name: editForm.name, isApproved: editForm.isApproved, role: editForm.role });
      toast.success("Dados do usuário atualizados.");
      
      setUsers(prev => prev.map(u => 
        u.uid === editingUser.uid ? { ...u, name: editForm.name, isApproved: editForm.isApproved, role: editForm.role } : u
      ));
      setEditingUser(null);
    } catch(err) {
      toast.error("Erro ao salvar os novos dados.");
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
          <main className="flex-1 p-6 overflow-y-auto">
            <div className="mb-6 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-md">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Painel de Controle Admin</h1>
                <p className="text-sm text-muted-foreground font-medium">Gestão de usuários e manutenção do sistema</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard icon={<Users className="h-5 w-5" />} label="Total de Usuários" value={stats.total} tone="primary" />
              <StatCard icon={<UserCheck className="h-5 w-5" />} label="Ativos" value={stats.ativos} tone="green" />
              <StatCard icon={<ShieldAlert className="h-5 w-5" />} label="Pendentes" value={stats.pendentes} tone="amber" />
              <StatCard icon={<Star className="h-5 w-5" />} label="Líderes" value={stats.lideres} tone="accent" />
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'users' | 'maintenance')}>
              <TabsList className="mb-6">
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
                    <div className="px-6 py-5 border-b border-border/80 flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold text-foreground">Gestão de Usuários</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Gerencie o cadastro e os acessos da equipe.
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs font-bold px-3 py-1.5">
                        Total: {users.length}
                      </Badge>
                    </div>

                    <ul className="divide-y divide-border/80">
                      {users.length === 0 ? (
                        <li className="px-6 py-12 text-center text-muted-foreground font-medium">
                          Nenhum usuário encontrado na base.
                        </li>
                      ) : (
                        users.map((user) => {
                          const isAdmin = user.email === ADMIN_EMAIL;
                          const isApproved = user.isApproved;
                          const isEditing = editingUser?.uid === user.uid;

                          return (
                            <li key={user.uid} className="px-6 py-5 hover:bg-muted/30 transition-colors">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                {isEditing ? (
                                  <div className="flex-1 min-w-0 p-4 bg-muted/40 rounded-xl space-y-4 border border-border/80">
                                    <h3 className="text-sm font-bold text-foreground">Editando Perfil: {user.email}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase">Nome de Exibição</label>
                                        <Input
                                          autoFocus
                                          value={editForm.name}
                                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                          placeholder="Digite o nome..."
                                        />
                                      </div>
                                      <div className="space-y-1.5 flex flex-col justify-end">
                                        <label className="flex items-center gap-2 p-2.5 rounded-lg bg-card border border-border/80 cursor-pointer">
                                          <Checkbox
                                            checked={editForm.isApproved}
                                            onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isApproved: checked === true }))}
                                          />
                                          <span className="text-sm font-medium text-foreground">Acesso Aprovado (Status Ativo)</span>
                                        </label>
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase">Função</label>
                                        <Select
                                          value={editForm.role}
                                          onValueChange={(value) => setEditForm(prev => ({ ...prev, role: value as 'user' | 'leader' }))}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="user">Usuário</SelectItem>
                                            <SelectItem value="leader">Líder (acessa Painel de Produção)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 pt-2">
                                      <Button onClick={handleEditSave} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                                        <Save className="w-4 h-4" /> Salvar Alterações
                                      </Button>
                                      <Button variant="secondary" onClick={() => setEditingUser(null)} className="gap-1.5">
                                        <X className="w-4 h-4" /> Cancelar
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex-1 min-w-0 pr-4">
                                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <p className="text-base font-bold text-foreground truncate">
                                          {user.name || "Sem Nome Definido"}
                                        </p>
                                        {isAdmin && (
                                          <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10 border border-primary/20">
                                            <ShieldCheck className="h-3 w-3" />
                                            Admin Global
                                          </Badge>
                                        )}
                                        {!isAdmin && user.role === 'leader' && (
                                          <Badge className="gap-1 bg-accent/10 text-accent hover:bg-accent/10 border border-accent/20">
                                            <Star className="h-3 w-3" />
                                            Líder
                                          </Badge>
                                        )}
                                        {!isAdmin && isApproved && (
                                          <Badge variant="success" className="gap-1">
                                            Status: Ativo
                                          </Badge>
                                        )}
                                        {!isAdmin && !isApproved && (
                                          <Badge variant="destructive" className="gap-1">
                                            <ShieldAlert className="h-3 w-3" />
                                            Acesso Revogado
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm font-medium text-muted-foreground truncate">
                                        {user.email}
                                      </p>
                                      {user.created_at && (
                                        <p className="text-[11px] font-semibold text-muted-foreground/70 mt-2 uppercase tracking-wide">
                                          Ingressou em: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {!isAdmin && (
                                        <>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className={cn(
                                              isApproved
                                                ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-500'
                                                : 'bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700'
                                            )}
                                            onClick={() => handleToggleStatus(user)}
                                            title={isApproved ? "Revogar Acesso" : "Aprovar Acesso"}
                                          >
                                            {isApproved ? <UserX className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
                                          </Button>

                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400"
                                            onClick={() => handleEditInitiate(user)}
                                            title="Editar Dados e Acessos"
                                          >
                                            <Edit className="h-5 w-5" />
                                          </Button>

                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="text-muted-foreground hover:text-red-600 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-900/20"
                                            onClick={() => requestDeleteUser(user)}
                                            title="Excluir Usuário (Ação Permanente)"
                                          >
                                            <Trash2 className="h-5 w-5" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </>
                                )}
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
    </ProtectedRoute>
  );
}
