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
    if (userData?.role === 'leader') return 'Líder de Produção';
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

        {/* Menu do Usuário */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative rounded-xl overflow-hidden border-2 border-white/20 hover:border-white/40 hover:bg-white/15 transition-all duration-200 h-9 w-9 sm:h-10 sm:w-10 bg-white/10 shadow-xs active:scale-95"
            >
              <div className="relative w-full h-full flex items-center justify-center text-white font-black text-xs sm:text-sm">
                {userData?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-[280px] p-0 shadow-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-2xl overflow-hidden">
            <div className="relative p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                  {userData?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-white text-sm truncate leading-tight">
                    {userData?.name || user?.displayName || 'Usuário'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {user?.email}
                  </p>
                  
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 mt-1.5">
                    <ShieldCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    {getUserRoleLabel()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-1.5 space-y-0.5">
              <DropdownMenuItem 
                className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-colors text-xs font-semibold text-slate-700 dark:text-slate-200"
                onClick={() => router.push('/dashboard')}
              >
                <User size={15} className="text-slate-500" />
                <span>Meu Perfil</span>
              </DropdownMenuItem>

              <DropdownMenuItem 
                className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-colors text-xs font-semibold text-slate-700 dark:text-slate-200"
                onClick={() => router.push('/settings')}
              >
                <Settings size={15} className="text-slate-500" />
                <span>Configurações</span>
              </DropdownMenuItem>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />

              <DropdownMenuItem 
                className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition-colors text-xs font-bold"
                onClick={handleSignOut}
              >
                <LogOut size={15} />
                <span>Sair da conta</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};