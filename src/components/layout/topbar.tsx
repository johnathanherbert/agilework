"use client";

import { useFirebase, ADMIN_EMAIL } from '../providers/firebase-provider';
import { Button } from '../ui/button';
import { HeaderClock } from '../clock/header-clock';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { LogOut, Moon, Settings, Sun, User, ShieldCheck, UserCheck } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NotificationBell } from '../notifications/notification-bell';
import { OnlineUsers } from './online-users';

export const Topbar = () => {
  const { user, userData, signOut } = useFirebase();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const getUserRoleLabel = () => {
    if (userData?.email === ADMIN_EMAIL) return 'Administrador Global';
    if (userData?.role === 'supervisor') return `Supervisor Geral ${userData?.turno ? `(T${userData.turno})` : ''}`;
    if (userData?.role === 'leader') return `Líder de Produção ${userData?.turno ? `(Turno ${userData.turno})` : ''}`;
    return 'Colaborador';
  };

  return (
    <div className="w-full h-16 border-b border-white/10 flex items-center justify-between px-4 sm:px-6 bg-gradient-to-r from-[#003760] via-[#00477a] to-[#003760] text-white shadow-md z-40 backdrop-blur-md transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 shadow-2xs">
          <HeaderClock />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Chat com Usuários Online */}
        <div className="relative">
          <OnlineUsers />
        </div>

        {/* Central de Notificações */}
        <div className="relative">
          <NotificationBell />
        </div>

        {/* Toggle do Tema (Dark/Light) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="relative text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 h-9 w-9 sm:h-10 sm:w-10 active:scale-95"
        >
          {theme === 'dark' ? (
            <Sun size={19} className="transition-transform duration-300 rotate-0 hover:rotate-90 text-amber-300" />
          ) : (
            <Moon size={19} className="transition-transform duration-300 rotate-0 hover:-rotate-45 text-blue-200" />
          )}
        </Button>

        {/* Menu do Usuário Moderno */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative rounded-2xl overflow-visible border-2 border-white/20 hover:border-white/50 hover:bg-white/15 transition-all duration-200 h-9 w-9 sm:h-10 sm:w-10 bg-white/10 shadow-2xs active:scale-95 group"
            >
              <div className="relative w-full h-full rounded-xl flex items-center justify-center text-white font-mono font-black text-xs sm:text-sm">
                {userData?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#003760] shadow-2xs" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-[290px] p-0 shadow-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 rounded-2xl overflow-hidden backdrop-blur-md">
            {/* Header do Perfil em Estilo Card Corporativo */}
            <div className="relative p-4 bg-gradient-to-br from-[#002e52] via-[#003760] to-[#002848] text-white overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 text-white font-mono font-black text-base flex items-center justify-center shadow-md">
                    {userData?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#002e52]" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-sm truncate leading-tight tracking-tight">
                    {userData?.name || user?.displayName || 'Usuário'}
                  </p>
                  <p className="text-[11px] text-slate-300/80 truncate mt-0.5 font-medium font-mono">
                    {user?.email}
                  </p>
                  
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/15 text-white border border-white/20 tracking-wide uppercase">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      {getUserRoleLabel()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Itens do Menu */}
            <div className="p-2 space-y-1">
              <DropdownMenuItem 
                className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-all text-xs font-bold text-slate-700 dark:text-slate-200 group"
                onClick={() => router.push('/dashboard')}
              >
                <div className="flex items-center gap-2.5">
                  <User size={16} className="text-slate-400 group-hover:text-primary transition-colors" />
                  <span>Meu Perfil</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Geral</span>
              </DropdownMenuItem>

              <DropdownMenuItem 
                className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-all text-xs font-bold text-slate-700 dark:text-slate-200 group"
                onClick={() => router.push('/settings')}
              >
                <div className="flex items-center gap-2.5">
                  <Settings size={16} className="text-slate-400 group-hover:text-primary transition-colors" />
                  <span>Configurações</span>
                </div>
              </DropdownMenuItem>

              <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1 mx-2" />

              <DropdownMenuItem 
                className="flex items-center justify-between py-2.5 px-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-all text-xs font-extrabold group"
                onClick={handleSignOut}
              >
                <div className="flex items-center gap-2.5">
                  <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  <span>Sair da Conta</span>
                </div>
                <span className="text-[9px] font-mono uppercase font-bold text-rose-500 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">Encerrar</span>
              </DropdownMenuItem>
            </div>

            {/* Rodapé de Status de Sessão */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Sessão Ativa
              </span>
              
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};