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
  Info,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  Scale
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
  requiredRole?: 'all' | 'leader' | 'supervisor' | 'admin' | 'maoDeObra' | 'solicitacoes';
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, requiredRole: 'all' },
  { label: 'Notas Técnicas', href: '/almoxarifado/nts', icon: FileText, requiredRole: 'all' },
  // { label: 'NTs Concluídas', href: '/almoxarifado/nts?status=concluida', icon: CheckSquare, requiredRole: 'all' },
  { label: 'Solicitações', href: '/solicitacoes', icon: Package, requiredRole: 'solicitacoes' },
  { label: 'Pesagem & Estoque', href: '/pesagem', icon: Scale, requiredRole: 'all' },
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

    if (item.requiredRole === 'solicitacoes') {
      return (
        userData.role === 'supervisor' ||
        Boolean(userData.allowedSolicitacoes)
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
                className="w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] grid place-items-center font-bold text-[11px] cursor-pointer hover:border-[var(--accent)] hover:scale-105 active:scale-95 transition-all shadow-xs"
                title={userData?.name || user?.email || 'Usuário'}
              >
                {userData?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              side="right" 
              align="end" 
              sideOffset={12} 
              className="w-64 p-0 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-[0_16px_40px_rgba(0,0,0,0.35)] rounded-[8px] overflow-hidden animate-fade-in"
            >
              {/* Header do Usuário */}
              <div className="p-3 bg-[var(--surface-2)]/60 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[var(--accent-weak)] border border-[var(--accent)]/30 text-[var(--accent)] grid place-items-center font-bold text-xs shrink-0 shadow-inner">
                    {userData?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text)] truncate leading-tight">
                      {userData?.name || 'Usuário'}
                    </p>
                    <p className="text-[11px] text-[var(--text-3)] font-mono truncate mt-0.5" title={user?.email || ''}>
                      {user?.email}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-[4px] bg-[var(--accent-weak)] text-[var(--accent)] border border-[var(--accent)]/20 font-mono">
                    {userData?.role || 'operador'}
                  </span>
                  {userData?.turno && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-[4px] bg-[var(--surface)] text-[var(--text-2)] border border-[var(--border)] font-mono">
                      {userData.turno}º Turno
                    </span>
                  )}
                </div>
              </div>

              {/* Ações e Navegação */}
              <div className="p-1.5 space-y-0.5">
                <DropdownMenuItem 
                  onClick={() => router.push('/dashboard')}
                  className="text-xs py-2 px-2.5 rounded-[5px] cursor-pointer text-[var(--text)] hover:bg-[var(--hover)] hover:text-[var(--text)] focus:bg-[var(--hover)] focus:text-[var(--text)] transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
                    <span className="font-medium">Painel Geral</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={() => router.push('/settings')}
                  className="text-xs py-2 px-2.5 rounded-[5px] cursor-pointer text-[var(--text)] hover:bg-[var(--hover)] hover:text-[var(--text)] focus:bg-[var(--hover)] focus:text-[var(--text)] transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <Settings size={14} className="text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
                    <span className="font-medium">Configurações</span>
                  </div>
                </DropdownMenuItem>

                {userData?.role === 'admin' && (
                  <DropdownMenuItem 
                    onClick={() => router.push('/settings/users')}
                    className="text-xs py-2 px-2.5 rounded-[5px] cursor-pointer text-[var(--text)] hover:bg-[var(--hover)] hover:text-[var(--text)] focus:bg-[var(--hover)] focus:text-[var(--text)] transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
                      <span className="font-medium">Gestão de Usuários</span>
                    </div>
                  </DropdownMenuItem>
                )}
              </div>

              <div className="h-px bg-[var(--border)]" />

              {/* Botão de Logout */}
              <div className="p-1.5">
                <DropdownMenuItem 
                  onClick={async () => {
                    await signOut();
                    router.push('/login');
                  }}
                  className="text-xs py-2 px-2.5 rounded-[5px] cursor-pointer text-[var(--red)] hover:bg-[var(--red)]/10 hover:text-[var(--red)] focus:bg-[var(--red)]/10 focus:text-[var(--red)] transition-colors flex items-center justify-between font-medium group"
                >
                  <div className="flex items-center gap-2">
                    <LogOut size={14} className="transition-transform group-hover:translate-x-0.5" />
                    <span>Encerrar Sessão</span>
                  </div>
                </DropdownMenuItem>
              </div>

              {/* Rodapé de Status */}
              <div className="px-3 py-2 bg-[var(--surface-2)]/50 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-3)] font-mono">
                <span className="flex items-center gap-1.5 text-[var(--text-2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
                  Sessão Ativa
                </span>
                <span>AgileWork v3.0</span>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
};