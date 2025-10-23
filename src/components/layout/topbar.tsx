   "use client";

import { useFirebase } from '../providers/firebase-provider';
import { Button } from '../ui/button';
import { HeaderClock } from '../clock/header-clock';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { LogOut, Moon, Settings, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NotificationBell } from '../notifications/notification-bell';

export const Topbar = () => {
  const { user, userData, signOut } = useFirebase();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="w-full h-16 border-b flex items-center justify-between px-6 bg-white dark:bg-gray-900 shadow-sm dark:shadow-lg dark:shadow-gray-900/30 z-40 transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="hidden sm:block">
          <HeaderClock />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <NotificationBell />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all h-9 w-9"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all shadow-sm hover:shadow h-10 w-10">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-inner">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[250px] p-0 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
              <p className="font-bold text-gray-900 dark:text-gray-100">
                {userData?.name || user?.displayName || 'Usuário'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">{user?.email}</p>
            </div>
            <div className="py-1.5">
              <DropdownMenuItem 
                className="flex items-center gap-3 py-2.5 mx-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                onClick={() => router.push('/dashboard')}
              >
                <User size={18} className="text-gray-500 dark:text-gray-400" />
                <span className="font-medium">Meu Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-3 py-2.5 mx-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                onClick={() => router.push('/settings')}
              >
                <Settings size={18} className="text-gray-500 dark:text-gray-400" />
                <span className="font-medium">Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-3 py-2.5 mx-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer mt-1 border-t dark:border-gray-700"
                onClick={handleSignOut}
              >
                <LogOut size={18} />
                <span className="font-medium">Sair</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};