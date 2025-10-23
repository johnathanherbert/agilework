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
    <div className="w-full h-16 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between px-6 bg-gradient-to-r from-white via-gray-50/50 to-white dark:from-gray-900 dark:via-gray-900/95 dark:to-gray-900 backdrop-blur-xl shadow-lg shadow-gray-200/50 dark:shadow-gray-950/50 z-40 transition-all duration-300">
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
          className="relative text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 rounded-xl transition-all duration-300 h-10 w-10 shadow-sm hover:shadow-md hover:scale-105"
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
              className="relative rounded-full overflow-hidden border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 h-10 w-10 group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 dark:from-blue-600 dark:via-indigo-600 dark:to-purple-600 group-hover:scale-110 transition-transform duration-300" />
              <div className="relative w-full h-full flex items-center justify-center text-white font-bold text-sm">
                {userData?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[280px] p-0 shadow-2xl border border-gray-200/50 dark:border-gray-700/50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl overflow-hidden">
            <div className="relative p-5 border-b dark:border-gray-700/50 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-800/90 dark:to-gray-800/80">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 dark:bg-blue-400/5 rounded-full blur-3xl" />
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
                className="flex items-center gap-3 py-3 px-4 mx-2 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 cursor-pointer transition-all duration-200 group"
                onClick={() => router.push('/dashboard')}
              >
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-200">
                  <User size={16} />
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Meu Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-3 py-3 px-4 mx-2 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 cursor-pointer transition-all duration-200 group"
                onClick={() => router.push('/settings')}
              >
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform duration-200">
                  <Settings size={16} />
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Configurações</span>
              </DropdownMenuItem>
              <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent my-2 mx-4" />
              <DropdownMenuItem 
                className="flex items-center gap-3 py-3 px-4 mx-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 dark:hover:from-red-900/20 dark:hover:to-pink-900/20 cursor-pointer transition-all duration-200 group"
                onClick={handleSignOut}
              >
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 group-hover:scale-110 transition-transform duration-200">
                  <LogOut size={16} />
                </div>
                <span className="font-medium">Sair</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};