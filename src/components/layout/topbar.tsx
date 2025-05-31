   "use client";

import { useSupabase } from '../providers/supabase-provider';
import { Button } from '../ui/button';
import { HeaderClock } from '../clock/header-clock';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { LogOut, Moon, Settings, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NotificationBell } from '../notifications/notification-bell';

export const Topbar = () => {
  const { user, signOut } = useSupabase();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="w-full h-16 border-b flex items-center justify-between px-4 bg-white dark:bg-gray-900 shadow-sm z-40 transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="hidden sm:block">
          <HeaderClock />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Notifications */}
        <NotificationBell />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px] p-0 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <p className="font-medium text-gray-900 dark:text-gray-100">{user?.user_metadata?.name || 'Usuário'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            </div>
            <div className="py-1">
              <DropdownMenuItem 
                className="flex items-center gap-2 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={() => router.push('/dashboard')}
              >
                <User size={16} className="text-gray-500 dark:text-gray-400" />
                <span>Meu Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={() => router.push('/settings')}
              >
                <Settings size={16} className="text-gray-500 dark:text-gray-400" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={handleSignOut}
              >
                <LogOut size={16} />
                <span>Sair</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};