   "use client";

import { useFirebase } from '../providers/firebase-provider';
import { Button } from '../ui/button';
import { HeaderClock } from '../clock/header-clock';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { LogOut, Moon, Settings, Sun, User } from 'lucide-react';
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

  return (
    <div className="w-full h-16 border-b border-border/20 flex items-center justify-between px-6 bg-[#003d6b] text-white shadow-sm z-40 transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="hidden sm:block">
          <HeaderClock />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Online Users with integrated chat */}
        <div className="relative">
          <OnlineUsers />
        </div>

        {/* Notifications */}
        <div className="relative">
          <NotificationBell />
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="relative text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300 h-10 w-10"
        >
          {theme === 'dark' ? (
            <Sun size={20} className="transition-transform duration-300 rotate-0 hover:rotate-180" />
          ) : (
            <Moon size={20} className="transition-transform duration-300 rotate-0 hover:-rotate-180" />
          )}
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative rounded-full overflow-hidden border-2 border-white/30 hover:bg-white/20 transition-colors h-10 w-10 bg-white/10 font-bold"
            >
              <div className="relative w-full h-full flex items-center justify-center text-white font-bold text-sm">
                {userData?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[280px] p-0 shadow-sm border bg-card rounded-xl overflow-hidden">
            <div className="relative p-5 border-b bg-gray-50 dark:bg-gray-800/50">
              <div className="relative">
                <p className="font-bold text-gray-900 dark:text-white text-lg truncate">
                  {userData?.name || user?.displayName || 'Usuário'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="py-2">
              <DropdownMenuItem 
                className="flex items-center gap-3 py-3 px-4 mx-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => router.push('/dashboard')}
              >
                <User size={16} />
                <span className="font-medium text-gray-700 dark:text-gray-300">Meu Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-3 py-3 px-4 mx-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => router.push('/settings')}
              >
                <Settings size={16} />
                <span className="font-medium text-gray-700 dark:text-gray-300">Configurações</span>
              </DropdownMenuItem>
              <div className="h-px bg-border my-2 mx-4" />
              <DropdownMenuItem 
                className="flex items-center gap-3 py-3 px-4 mx-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer transition-colors"
                onClick={handleSignOut}
              >
                <LogOut size={16} />
                <span className="font-medium">Sair</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};