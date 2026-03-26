"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFirebase } from "@/components/providers/firebase-provider";
import { getAllUsers, updateUserStatus, deleteUserDb } from "@/lib/firestore-helpers";
import { Shield, ShieldCheck, ShieldAlert, UserX, UserCheck, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";

const ADMIN_EMAIL = 'johnathan.herbert47@gmail.com';

interface UserItem {
  uid: string;
  email: string;
  name?: string;
  isApproved?: boolean;
  created_at?: string;
  lastActive?: any;
}

export default function UsersManagementPage() {
  const { userData, loading } = useFirebase();
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Proteção: apenas o admin pode acessar
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
    // Evita alterar o próprio admin acidentalmente
    if (user.email === ADMIN_EMAIL) {
      toast.error("Não é possível alterar o status do administrador principal.");
      return;
    }

    const newStatus = !user.isApproved;
    try {
      await updateUserStatus(user.uid, newStatus);
      toast.success(`Usuário ${newStatus ? 'aprovado' : 'desabilitado'} com sucesso.`);
      
      // Atualiza estado local
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
    if (user.email === ADMIN_EMAIL) return;
    
    if (window.confirm(`Tem certeza que deseja DELETAR o usuário ${user.name || user.email}? Esta ação removerá apenas o documento de acesso no banco.`)) {
      try {
        await deleteUserDb(user.uid);
        toast.success("Usuário deletado do banco de dados.");
        setUsers(prev => prev.filter(u => u.uid !== user.uid));
      } catch (error) {
        toast.error("Erro ao deletar usuário.");
      }
    }
  };

  if (loading || loadingUsers) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  // Double check preventivo
  if (!userData || userData.email !== ADMIN_EMAIL) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-12">
      {/* Header simples (imitando outros layouts ou independente) */}
      <div className="bg-white dark:bg-slate-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center">
              <Link href="/dashboard" className="mr-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Gerenciamento de Usuários
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-slate-900 dark:text-white">Usuários Cadastrados</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Aprove novos usuários ou desabilite acessos existentes.
              </p>
            </div>
            <div className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs py-1 px-3 rounded-full font-medium">
              Total: {users.length}
            </div>
          </div>
          
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {users.length === 0 ? (
              <li className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                Nenhum usuário encontrado.
              </li>
            ) : (
              users.map((user) => {
                const isAdmin = user.email === ADMIN_EMAIL;
                const isApproved = user.isApproved;
                
                return (
                  <li key={user.uid} className="px-6 py-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {user.name || "Sem nome"}
                        </p>
                        {isAdmin && (
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-700/10">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                          </span>
                        )}
                        {!isAdmin && isApproved && (
                          <span className="inline-flex items-center gap-1 rounded bg-green-50 dark:bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20">
                            Aprovado
                          </span>
                        )}
                        {!isAdmin && !isApproved && (
                          <span className="inline-flex items-center gap-1 rounded bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/10">
                            <ShieldAlert className="h-3 w-3" />
                            Bloqueado
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                      {user.created_at && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          Cadastrado em: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {!isAdmin && (
                        <>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                              isApproved 
                                ? 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-400' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                            }`}
                          >
                            {isApproved ? (
                              <>
                                <UserX className="h-4 w-4" />
                                Desabilitar
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4" />
                                Aprovar Acesso
                              </>
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                            title="Deletar registro (apenas DB)"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
