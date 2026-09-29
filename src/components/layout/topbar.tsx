"use client";

import { usePathname } from 'next/navigation';
import { useFirebase } from '../providers/firebase-provider';
import { HeaderClock } from '../clock/header-clock';
import { NotificationBell } from '../notifications/notification-bell';
import { OnlineUsers } from './online-users';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

export const Topbar = () => {
  const pathname = usePathname();
  const { userData, user } = useFirebase();
  const { theme, setTheme } = useTheme();

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
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Mini Badge do Usuário Logado */}
        <div 
          className="w-6 h-6 rounded-full bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] grid place-items-center font-bold text-[10px] uppercase font-mono shrink-0"
          title={`${userData?.name || user?.email || 'Usuário'} (${userData?.role || 'operador'})`}
        >
          {userData?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
        </div>
      </div>
    </header>
  );
};