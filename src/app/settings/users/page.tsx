"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFirebase } from "@/components/providers/firebase-provider";
import { getAllUsers, updateUserStatus, deleteUserDb, editUserDb, wipeDataByCategory } from "@/lib/firestore-helpers";
import { Shield, ShieldCheck, ShieldAlert, UserX, UserCheck, Trash2, ArrowLeft, Edit, Save, X, Database, AlertTriangle, AlertCircle, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = 'johnathan.herbert47@gmail.com';

interface UserItem {
  uid: string;
  email: string;
  name?: string;
  isApproved?: boolean;
  created_at?: string;
  lastActive?: any;
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
  const [editForm, setEditForm] = useState({ name: '', isApproved: false });

  // Maintenance State
  const [wiping, setWiping] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [showWipeDialog, setShowWipeDialog] = useState(false);
  const [wipeCategories, setWipeCategories] = useState({
    nts: false,
    items: false,
    users: false
  });

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

  const handleDeleteUser = async (user: UserItem) => {
    if (user.email === ADMIN_EMAIL) {
      toast.error("Não é possível deletar o admin principal.");
      return;
    }
    
    if (window.confirm(`Tem certeza que deseja DELETAR DEFINITIVAMENTE o usuário ${user.name || user.email}? (Ação irreversível no Banco)`)) {
      try {
        await deleteUserDb(user.uid);
        toast.success("Usuário limado da base de dados.");
        setUsers(prev => prev.filter(u => u.uid !== user.uid));
      } catch (error) {
        toast.error("Erro ao deletar usuário.");
      }
    }
  };

  const handleEditInitiate = (user: UserItem) => {
    if (user.email === ADMIN_EMAIL) {
      toast.error("O admin global não pode ser editado nesta tela.");
      return;
    }
    setEditingUser(user);
    setEditForm({ name: user.name || '', isApproved: user.isApproved || false });
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    try {
      await editUserDb(editingUser.uid, { name: editForm.name, isApproved: editForm.isApproved });
      toast.success("Dados do usuário atualizados.");
      
      setUsers(prev => prev.map(u => 
        u.uid === editingUser.uid ? { ...u, name: editForm.name, isApproved: editForm.isApproved } : u
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
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    );
  }

  if (!userData || userData.email !== ADMIN_EMAIL) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-12">
      {/* App Topbar Linkage Spacer */}
      <div className="bg-primary shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center">
              <Link href="/dashboard" className="mr-5 p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-bold text-white flex items-center gap-3">
                <Shield className="h-6 w-6 text-blue-300" />
                Painel de Controle Admin
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Modern Tabs Navigation */}
        <div className="flex space-x-1 p-1 bg-gray-200 dark:bg-slate-800/80 rounded-xl max-w-sm mb-6 shadow-sm">
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300",
              activeTab === 'users' 
                ? "bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            Usuários
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300",
              activeTab === 'maintenance' 
                ? "bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Database className="w-4 h-4" />
            Manutenção
          </button>
        </div>

        {/* Tab 1: Gestão de Usuários */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/60">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">CMS de Usuários</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Gerencie todo o cadastro e acessos da equipe (CRUD).
                </p>
              </div>
              <div className="bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50 text-xs py-1.5 px-3 rounded-md font-bold shadow-sm">
                Total: {users.length}
              </div>
            </div>
            
            <ul className="divide-y divide-slate-200 dark:divide-slate-700/60">
              {users.length === 0 ? (
                <li className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                  Nenhuma vida carbonada encontrada na base.
                </li>
              ) : (
                users.map((user) => {
                  const isAdmin = user.email === ADMIN_EMAIL;
                  const isApproved = user.isApproved;
                  const isEditing = editingUser?.uid === user.uid;
                  
                  return (
                    <li key={user.uid} className="px-6 py-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        
                        {/* Editor View */}
                        {isEditing ? (
                          <div className="flex-1 min-w-0 p-4 bg-slate-100 dark:bg-slate-900 rounded-xl space-y-4 shadow-inner ring-1 ring-slate-200 dark:ring-slate-700">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Editando Perfil: {user.email}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Nome de Exibição</label>
                                <input 
                                  autoFocus
                                  type="text" 
                                  value={editForm.name}
                                  onChange={(e) => setEditForm(prev => ({...prev, name: e.target.value}))}
                                  className="w-full text-sm p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                  placeholder="Digite o nome..."
                                />
                              </div>
                              <div className="space-y-1.5 flex flex-col justify-end">
                                <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm">
                                  <input 
                                    type="checkbox" 
                                    checked={editForm.isApproved}
                                    onChange={(e) => setEditForm(prev => ({...prev, isApproved: e.target.checked}))}
                                    className="w-4 h-4 text-primary rounded ring-0 focus:ring-0 checked:bg-primary"
                                  />
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Acesso Aprovado (Status Ativo)</span>
                                </label>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                              <button onClick={handleEditSave} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
                                <Save className="w-4 h-4" /> Salvar Alterações
                              </button>
                              <button onClick={() => setEditingUser(null)} className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-lg shadow-sm transition-colors">
                                <X className="w-4 h-4" /> Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Standard View */}
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                                  {user.name || "Sem Nome Definido"}
                                </p>
                                {isAdmin && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary ring-1 ring-inset ring-primary/20">
                                    <ShieldCheck className="h-3 w-3" />
                                    Admin Global
                                  </span>
                                )}
                                {!isAdmin && isApproved && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-green-50 dark:bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20">
                                    Status: Ativo
                                  </span>
                                )}
                                {!isAdmin && !isApproved && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/20">
                                    <ShieldAlert className="h-3 w-3" />
                                    Acesso Revogado
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                                {user.email}
                              </p>
                              {user.created_at && (
                                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-wide">
                                  Ingressou em: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {!isAdmin && (
                                <>
                                  {/* Quick Toggle Status */}
                                  <button
                                    onClick={() => handleToggleStatus(user)}
                                    className={cn(
                                      "inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 shadow-sm border",
                                      isApproved 
                                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-200' 
                                        : 'bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700 text-white'
                                    )}
                                    title={isApproved ? "Revogar Acesso" : "Aprovar Acesso"}
                                  >
                                    {isApproved ? <UserX className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
                                  </button>
                                  
                                  {/* Edit Mode */}
                                  <button
                                    onClick={() => handleEditInitiate(user)}
                                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 shadow-sm"
                                    title="Editar Dados e Acessos"
                                  >
                                    <Edit className="h-5 w-5" />
                                  </button>
                                  
                                  {/* Delete Hard */}
                                  <button
                                    onClick={() => handleDeleteUser(user)}
                                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-900/20 transition-all duration-200 shadow-sm"
                                    title="Expurgo (Deletar Conta DB)"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </button>
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
          </div>
        )}

        {/* Tab 2: Manutenção de Sistema */}
        {activeTab === 'maintenance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Danger Zone: Wipe Database */}
            <div className="bg-white dark:bg-slate-800 border-2 border-red-200 dark:border-red-900/50 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                <h3 className="text-lg font-bold text-red-800 dark:text-red-400">Danger Zone: Wipe DB</h3>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Selecione as categorias que deseja obliterar do Firestore. Cuidado: excluir Itens sem excluir NTs vai invalidar os números do painel.
                  </p>
                  
                  <div className="flex flex-col gap-2 mt-4 mb-2">
                    <label className="flex items-center gap-2 p-2.5 rounded-lg bg-red-100/50 dark:bg-red-900/30 border border-red-200 dark:border-red-900/50 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shadow-sm">
                      <input type="checkbox" checked={wipeCategories.nts} onChange={e => setWipeCategories(p => ({...p, nts: e.target.checked}))} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                      <span className="text-sm font-bold text-red-900 dark:text-red-300">Tabela Mestre (NTs Registradas)</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 rounded-lg bg-red-100/50 dark:bg-red-900/30 border border-red-200 dark:border-red-900/50 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shadow-sm">
                      <input type="checkbox" checked={wipeCategories.items} onChange={e => setWipeCategories(p => ({...p, items: e.target.checked}))} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                      <span className="text-sm font-bold text-red-900 dark:text-red-300">Tabela Operacional (Sub-Itens / Cálculos KPIs)</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 rounded-lg bg-red-100/50 dark:bg-red-900/30 border border-red-200 dark:border-red-900/50 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shadow-sm">
                      <input type="checkbox" checked={wipeCategories.users} onChange={e => setWipeCategories(p => ({...p, users: e.target.checked}))} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                      <span className="text-sm font-bold text-red-900 dark:text-red-300">Usuários Comuns (Protege Admin)</span>
                    </label>
                  </div>
                </div>

                {!showWipeDialog ? (
                  <button 
                    onClick={() => setShowWipeDialog(true)}
                    disabled={!wipeCategories.nts && !wipeCategories.items && !wipeCategories.users}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:border-red-800/50 dark:text-red-400"
                  >
                    <Trash2 className="w-5 h-5" /> Iniciar Protocolo de Wipe
                  </button>
                ) : (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg space-y-4">
                    <label className="text-sm font-bold text-red-800 dark:text-red-400 block">
                      Tem certeza absoluta? Digite "WIPE" abaixo para habilitar a ignição:
                    </label>
                    <input 
                      type="text"
                      autoFocus
                      placeholder="WIPE"
                      value={wipeConfirmText}
                      onChange={(e) => setWipeConfirmText(e.target.value)}
                      className="w-full p-2.5 rounded-md border-red-300 text-red-900 uppercase font-black text-center tracking-widest focus:ring-red-500 focus:border-red-500 dark:bg-slate-900 dark:border-red-800 dark:text-red-400 placeholder:text-red-300/50 shadow-inner"
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setShowWipeDialog(false); setWipeConfirmText(""); }}
                        className="flex-1 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
                      >
                        Abortar
                      </button>
                      <button 
                        onClick={handleWipeDatabase}
                        disabled={wipeConfirmText !== 'WIPE' || wiping}
                        className="flex-1 py-2 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        {wiping ? 'Excluindo...' : 'ANULAR BASE!'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Informational Panel */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-400">Guia: Status do Servidor</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
                  <Database className="w-6 h-6 text-emerald-500 shrink-0" />
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Backups de Rotina</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">O Firestore é redundante, mas Wipes executados manualmente nesta interface ignoram lixeiras temporárias. Muito cuidado.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
                  <RefreshCcw className="w-6 h-6 text-amber-500 shrink-0" />
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Ciclo de Vida Auth</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">O Módulo de expurgo do CMS deleta pontes de acesso do banco. O e-mail da pessoa continuará na Base do Google até ela ser descadastrada do IAM principal.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
