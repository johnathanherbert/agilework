"use client";

import { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFirebase, ADMIN_EMAIL } from '../providers/firebase-provider';
import { HeaderClock } from '../clock/header-clock';
import { NotificationBell } from '../notifications/notification-bell';
import { OnlineUsers } from './online-users';
import { useTheme } from 'next-themes';
import { Sun, Moon, User, Settings, ShieldCheck, LogOut, Menu } from 'lucide-react';
import { navItems, type NavItem } from './sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export const Topbar = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userData, user, signOut } = useFirebase();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

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

    if (item.requiredRole === 'pesagem') {
      return (
        userData.role === 'supervisor' ||
        Boolean(userData.allowedPesagem)
      );
    }

    return false;
  };

  const visibleItems = navItems.filter(isItemVisible);

  const getBreadcrumbs = () => {
    if (!pathname) return { section: 'AgileWork', page: 'Painel' };
    if (pathname.includes('/pesagem')) return { section: 'Pesagem & Estoque', page: 'DashPesagem' };
    if (pathname.includes('/almoxarifado')) return { section: 'Pesagem', page: 'Notas Técnicas' };
    if (pathname.includes('/solicitacoes')) return { section: 'Materiais', page: 'Solicitações' };
    if (pathname.includes('/producao')) return { section: 'Fábrica', page: 'Painel de Produção' };
    if (pathname.includes('/heijunka')) return { section: 'Nivelamento', page: 'Heijunka' };
    if (pathname.includes('/mao-de-obra')) return { section: 'Operações', page: 'Mão de Obra' };
    if (pathname.includes('/settings/users')) return { section: 'Administração', page: 'Usuários' };
    if (pathname.includes('/settings')) return { section: 'Sistema', page: 'Configurações' };
    if (pathname.includes('/analytics')) return { section: 'Analytics', page: 'Indicadores' };
    return { section: 'AgileWork', page: 'Dashboard' };
  };

  const { section, page } = getBreadcrumbs();

  return (
    <header className="h-12 border-b border-[var(--border)] bg-[var(--surface)] px-3 md:px-6 flex items-center justify-between z-40 select-none transition-colors">
      {/* Lado Esquerdo: Botão Mobile Hamburguer & Breadcrumb */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Botão Hamburguer Mobile */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="md:hidden w-8 h-8 rounded-[6px] grid place-items-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer shrink-0"
              aria-label="Abrir menu de navegação"
            >
              <Menu size={18} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 bg-[var(--surface)] border-r border-[var(--border)] text-[var(--text)] flex flex-col justify-between">
            <div>
              {/* Header do Menu Mobile */}
              <div className="p-4 border-b border-[var(--border)] flex items-center gap-3">
                <div className="w-7 h-7 rounded-[6px] bg-[var(--text)] text-[var(--bg)] grid place-items-center font-bold text-xs shadow-xs">
                  A
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-tight text-[var(--text)]">AgileWork</div>
                  <div className="text-[11px] text-[var(--text-3)] font-mono">Gestão Operacional</div>
                </div>
              </div>

              {/* Lista de Navegação Mobile */}
              <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)] no-scrollbar">
                {visibleItems.map((item) => {
                  const active = isNavActive(item.href);
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => {
                        router.push(item.href);
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer text-left",
                        active
                          ? "bg-[var(--hover)] text-[var(--text)] font-semibold border-l-2 border-[var(--accent)]"
                          : "text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                      )}
                    >
                      <Icon size={16} className={cn("shrink-0", active ? "text-[var(--accent)]" : "text-[var(--text-3)]")} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Footer do Menu Mobile com Perfil */}
            <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-2)]/40 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-weak)] border border-[var(--accent)]/30 text-[var(--accent)] grid place-items-center font-bold text-xs shrink-0">
                  {userData?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[var(--text)] truncate">{userData?.name || 'Usuário'}</div>
                  <div className="text-[10px] text-[var(--text-3)] font-mono truncate">{user?.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setTheme(theme === 'dark' ? 'light' : 'dark');
                  }}
                  className="flex-1 text-[11px] py-1.5 px-2 rounded-[5px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                  <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    router.push('/login');
                  }}
                  className="text-[11px] py-1.5 px-2 rounded-[5px] border border-[var(--red)]/30 bg-[var(--red)]/10 text-[var(--red)] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[var(--red)]/20"
                >
                  <LogOut size={13} />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Breadcrumb da Seção / Página */}
        <div className="flex items-center gap-1.5 md:gap-2 text-xs text-[var(--text-3)] truncate">
          <span className="hidden sm:inline truncate">{section}</span>
          <span className="text-[var(--border-strong)] hidden sm:inline">/</span>
          <b className="font-semibold text-[var(--text)] truncate">{page}</b>
        </div>
      </div>

      {/* Metadados Operacionais & Ações */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Relógio em Tempo Real e Turno */}
        <HeaderClock />

        <span className="w-px h-4 bg-[var(--border)] hidden sm:inline-block" />

        {/* Usuários Online / Chat da Equipe */}
        <div className="flex items-center">
          <OnlineUsers />
        </div>

        <span className="w-px h-4 bg-[var(--border)]" />

        {/* Notificações */}
        <div className="flex items-center">
          <NotificationBell />
        </div>

        {/* Toggle do Tema (Dark/Light) */}
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-7 h-7 rounded-[6px] grid place-items-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          {mounted ? (
            theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />
          ) : (
            <span className="w-3.5 h-3.5 block" />
          )}
        </button>

        {/* Mini Badge do Usuário Logado com Menu Contextual */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              type="button"
              className="w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] grid place-items-center font-bold text-[11px] uppercase font-mono shrink-0 cursor-pointer hover:border-[var(--accent)] hover:scale-105 active:scale-95 transition-all shadow-xs"
              title={`${userData?.name || user?.email || 'Usuário'} (${userData?.role || 'operador'})`}
            >
              {userData?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            sideOffset={8} 
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
    </header>
  );
};