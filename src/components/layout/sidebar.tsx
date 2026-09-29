"use client";

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Home,
  FileText,
  CheckSquare,
  Package,
  Factory,
  TrendingUp,
  Users,
  Settings,
  Shield,
  Moon,
  Sun,
  LogOut,
  User,
  Info
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
import { useTheme } from 'next-themes';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  requiredRole?: 'all' | 'leader' | 'supervisor' | 'admin' | 'maoDeObra';
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, requiredRole: 'all' },
  { label: 'Notas Técnicas', href: '/almoxarifado/nts', icon: FileText, requiredRole: 'all' },
  { label: 'NTs Concluídas', href: '/almoxarifado/nts?status=concluida', icon: CheckSquare, requiredRole: 'all' },
  { label: 'Solicitações', href: '/solicitacoes', icon: Package, requiredRole: 'all' },
  { label: 'Painel de Produção', href: '/producao', icon: Factory, requiredRole: 'leader' },
  { label: 'Heijunka', href: '/heijunka', icon: TrendingUp, requiredRole: 'leader' },
  { label: 'Mão de Obra', href: '/mao-de-obra', icon: Users, requiredRole: 'maoDeObra' },
  { label: 'Configurações', href: '/settings', icon: Settings, requiredRole: 'all' },
  { label: 'Gestão de Usuários', href: '/settings/users', icon: Shield, requiredRole: 'admin' },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, userData, signOut } = useFirebase();
  const { theme, setTheme } = useTheme();
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    const status = searchParams?.get('status') || null;
    let fullPath = pathname || '';
    if (status) {
      fullPath += `?status=${status}`;
    }
    setCurrentPath(fullPath);
  }, [pathname, searchParams]);

  const isNavActive = (href: string) => {
    if (href.includes('?')) {
      return currentPath === href;
    }
    return pathname === href && !searchParams?.get('status');
  };

  const isItemVisible = (item: NavItem) => {
    if (item.requiredRole === 'all') return true;
    if (!userData) return false;
    if (userData.email === ADMIN_EMAIL) return true;

    if (item.requiredRole === 'admin') {
      return userData.email === ADMIN_EMAIL;
    }

    if (item.requiredRole === 'leader') {
      return userData.role === 'leader' || userData.role === 'supervisor';
    }

    if (item.requiredRole === 'maoDeObra') {
      return (
        userData.role === 'supervisor' ||
        (userData.role === 'leader' && Boolean(userData.allowedMaoDeObra))
      );
    }

    return false;
  };

  const visibleItems = navItems.filter(isItemVisible);

  return (
    <TooltipProvider delayDuration={150}>
      <aside className="w-[52px] h-screen fixed left-0 top-0 z-50 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col items-center py-2.5 select-none transition-colors">
        {/* Brand Icon / Logo */}
        <div 
          onClick={() => router.push('/dashboard')}
          className="w-7 h-7 rounded-[6px] bg-[var(--text)] text-[var(--bg)] grid place-items-center font-bold text-xs mb-3 cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
          title="AgileWork"
        >
          A
        </div>

        {/* Navigation Item Rail */}
        <nav className="flex-1 w-full flex flex-col items-center gap-1 overflow-y-auto no-scrollbar">
          {visibleItems.map((item) => {
            const active = isNavActive(item.href);
            const Icon = item.icon;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => router.push(item.href)}
                    className={cn(
                      "relative w-9 h-9 rounded-[6px] grid place-items-center transition-colors cursor-pointer",
                      active
                        ? "text-[var(--text)] bg-[var(--hover)] font-semibold"
                        : "text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)]"
                    )}
                  >
                    {/* Active Accent Strip */}
                    {active && (
                      <span className="absolute left-0 top-2 bottom-2 w-[2.5px] bg-[var(--accent)] rounded-r-[2px]" />
                    )}
                    <Icon size={16} className="shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} className="text-xs font-medium py-1 px-2.5 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border-strong)]">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom Actions: Theme Toggle & User Avatar */}
        <div className="flex flex-col items-center gap-2 pt-2 border-t border-[var(--border)] w-full">
          {/* Quick Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-8 h-8 rounded-[6px] grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10} className="text-xs bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border-strong)]">
              Alternar tema ({theme === 'dark' ? 'Claro' : 'Escuro'})
            </TooltipContent>
          </Tooltip>

          {/* User Menu Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] grid place-items-center font-bold text-[11px] cursor-pointer hover:border-[var(--accent)] transition-colors"
                title={userData?.name || user?.email || 'Usuário'}
              >
                {userData?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" sideOffset={12} className="w-56 p-1.5 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-xl rounded-[6px]">
              <div className="px-2.5 py-2 border-b border-[var(--border)] mb-1">
                <p className="text-xs font-semibold text-[var(--text)] truncate">
                  {userData?.name || 'Usuário'}
                </p>
                <p className="text-[11px] text-[var(--text-3)] font-mono truncate mt-0.5">
                  {user?.email}
                </p>
                <div className="mt-1.5 flex items-center gap-1">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--accent-weak)] text-[var(--accent)] uppercase font-mono">
                    {userData?.role || 'operador'} {userData?.turno ? `· T${userData.turno}` : ''}
                  </span>
                </div>
              </div>

              <DropdownMenuItem 
                onClick={() => router.push('/dashboard')}
                className="text-xs py-1.5 px-2 rounded-[4px] cursor-pointer hover:bg-[var(--hover)] focus:bg-[var(--hover)]"
              >
                <User size={14} className="mr-2 text-[var(--text-3)]" />
                Painel Geral
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => router.push('/settings')}
                className="text-xs py-1.5 px-2 rounded-[4px] cursor-pointer hover:bg-[var(--hover)] focus:bg-[var(--hover)]"
              >
                <Settings size={14} className="mr-2 text-[var(--text-3)]" />
                Configurações
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-[var(--border)] my-1" />

              <div className="px-2.5 py-1 text-[10px] text-[var(--text-3)] font-mono">
                AgileWork v2.0 · ID: 75710
              </div>

              <DropdownMenuSeparator className="bg-[var(--border)] my-1" />

              <DropdownMenuItem 
                onClick={async () => {
                  await signOut();
                  router.push('/login');
                }}
                className="text-xs py-1.5 px-2 rounded-[4px] cursor-pointer text-[var(--red)] hover:bg-[var(--hover)] focus:bg-[var(--hover)]"
              >
                <LogOut size={14} className="mr-2" />
                Encerrar Sessão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
};