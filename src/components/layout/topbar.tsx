"use client";

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useFirebase } from '../providers/firebase-provider';
import { HeaderClock } from '../clock/header-clock';
import { NotificationBell } from '../notifications/notification-bell';
import { OnlineUsers } from './online-users';
import { useTheme } from 'next-themes';
import { Sun, Moon, User, Settings, ShieldCheck, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Topbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { userData, user, signOut } = useFirebase();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getBreadcrumbs = () => {
    if (!pathname) return { section: 'AgileWork', page: 'Painel' };
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
    <header className="h-12 border-b border-[var(--border)] bg-[var(--surface)] px-4 md:px-6 flex items-center justify-between z-40 select-none transition-colors">
      {/* Breadcrumb da Seção / Página */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
        <span>{section}</span>
        <span className="text-[var(--border-strong)]">/</span>
        <b className="font-semibold text-[var(--text)]">{page}</b>
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