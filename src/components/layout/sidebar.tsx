"use client";

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ClipboardCheck, ClipboardList,
  Home, Settings, Shield, Factory,
  ChevronLeft, ChevronRight, Menu, Github, ExternalLink, TrendingUp, Users
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  section?: 'principal' | 'operacoes' | 'gestao';
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <Home size={19} />, section: 'principal' },
  { label: 'Gerenciar NTs', href: '/almoxarifado/nts', icon: <ClipboardList size={19} />, section: 'principal' },
  { label: 'NTs Concluídas', href: '/almoxarifado/nts?status=concluida', icon: <ClipboardCheck size={19} />, section: 'principal' },
  { label: 'Configurações', href: '/settings', icon: <Settings size={19} />, section: 'principal' },
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userData } = useFirebase();
  const [currentPath, setCurrentPath] = useState('');

  // Update active item when pathname or search params change
  useEffect(() => {
    const status = searchParams?.get('status') || null;
    let fullPath = pathname || '';
    if (status) {
      fullPath += `?status=${status}`;
    }
    setCurrentPath(fullPath);
  }, [pathname, searchParams]);

  // Auto-collapse fallback timeout
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (!collapsed) {
      timeoutId = setTimeout(() => {
        setCollapsed(true);
      }, 6000);
    }
    return () => clearTimeout(timeoutId);
  }, [collapsed]);

  const isNavActive = (href: string) => currentPath === href;

  return (
    <div
      className={cn(
        "h-screen fixed left-0 top-0 z-50 bg-white dark:bg-slate-950 border-r border-slate-200/80 dark:border-slate-800 flex flex-col transition-all duration-300 select-none",
        collapsed ? "w-[64px] shadow-sm" : "w-[260px] shadow-2xl"
      )}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
    >
      {/* Header do Logo AgileWork */}
      <div className="h-16 flex items-center justify-center border-b border-white/10 bg-gradient-to-r from-[#003760] via-[#00477a] to-[#003760] relative overflow-hidden shrink-0">
        <div className={cn(
          "relative flex items-center transition-all duration-300 overflow-hidden",
          collapsed ? "justify-center w-12" : "justify-start w-full px-5"
        )}>
          <div className="p-2 rounded-xl bg-white/15 border border-white/20 shadow-xs flex items-center justify-center shrink-0">
            <ClipboardList className="h-5 w-5 text-white drop-shadow-md" />
          </div>
          {!collapsed && (
            <div className="ml-3 flex flex-col items-start leading-tight">
              <span className="font-black text-base text-white tracking-tight drop-shadow-md">AgileWork</span>
              <div className="text-[11px] text-blue-200 font-medium">Gestão de NTs & Produção</div>
            </div>
          )}
        </div>
      </div>

      {/* Navegação Principal */}
      <div className="flex-1 py-4 overflow-y-auto overscroll-contain no-scrollbar">
        <nav className="flex flex-col gap-1 px-2.5">
          {!collapsed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1">
              Menu Principal
            </span>
          )}

          {navItems.map((item) => {
            const active = isNavActive(item.href);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                  collapsed ? "justify-center" : "justify-start",
                  active
                    ? "bg-blue-50 dark:bg-blue-950/50 text-primary font-bold shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100"
                )}
                title={collapsed ? item.label : ""}
              >
                {/* Pilar de indicação ativa no lado esquerdo */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full shadow-xs" />
                )}

                <div className={cn(
                  "shrink-0 transition-transform duration-200 group-hover:scale-110",
                  active ? "text-primary" : "text-slate-500 dark:text-slate-400"
                )}>
                  {item.icon}
                </div>

                {!collapsed && (
                  <span className="text-xs font-semibold whitespace-nowrap truncate">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}

          {/* Seção Operações */}
          {(userData?.email === ADMIN_EMAIL || userData?.role === 'leader' || userData?.role === 'supervisor') && (
            <>
              {!collapsed && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-4 pb-1">
                  Operações & Fábrica
                </span>
              )}

              {/* Mão de Obra (Gestão de Pessoas & Escala) - Apenas Admin, Supervisor ou Líderes Autorizados */}
              {(userData?.email === ADMIN_EMAIL || userData?.role === 'admin' || userData?.role === 'supervisor' || (userData?.role === 'leader' && userData?.allowedMaoDeObra)) && (
                <button
                  type="button"
                  onClick={() => router.push('/mao-de-obra')}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                    collapsed ? "justify-center" : "justify-start",
                    isNavActive('/mao-de-obra')
                      ? "bg-blue-50 dark:bg-blue-950/50 text-primary font-bold shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100"
                  )}
                  title={collapsed ? "Mão de Obra" : ""}
                >
                  {isNavActive('/mao-de-obra') && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full shadow-xs" />
                  )}
                  <div className="shrink-0 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform">
                    <Users size={19} />
                  </div>
                  {!collapsed && (
                    <span className="text-xs font-semibold whitespace-nowrap truncate">
                      Mão de Obra
                    </span>
                  )}
                </button>
              )}

              {/* Painel de Produção */}
              <button
                type="button"
                onClick={() => router.push('/producao')}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                  collapsed ? "justify-center" : "justify-start",
                  isNavActive('/producao')
                    ? "bg-blue-50 dark:bg-blue-950/50 text-primary font-bold shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100"
                )}
                title={collapsed ? "Painel de Produção" : ""}
              >
                {isNavActive('/producao') && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full shadow-xs" />
                )}
                <div className="shrink-0 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform">
                  <Factory size={19} />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold whitespace-nowrap truncate">
                    Painel de Produção
                  </span>
                )}
              </button>

              {/* Dashboard Heijunka */}
              <button
                type="button"
                onClick={() => router.push('/heijunka')}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                  collapsed ? "justify-center" : "justify-start",
                  isNavActive('/heijunka')
                    ? "bg-blue-50 dark:bg-blue-950/50 text-primary font-bold shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100"
                )}
                title={collapsed ? "Dashboard Heijunka" : ""}
              >
                {isNavActive('/heijunka') && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full shadow-xs" />
                )}
                <div className="shrink-0 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform">
                  <TrendingUp size={19} />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold whitespace-nowrap truncate">
                    Heijunka
                  </span>
                )}
              </button>
            </>
          )}

          {/* Gestão Admin */}
          {userData?.email === ADMIN_EMAIL && (
            <>
              {!collapsed && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-4 pb-1">
                  Administração
                </span>
              )}

              <button
                type="button"
                onClick={() => router.push('/settings/users')}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                  collapsed ? "justify-center" : "justify-start",
                  isNavActive('/settings/users')
                    ? "bg-blue-50 dark:bg-blue-950/50 text-primary font-bold shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100"
                )}
                title={collapsed ? "Gestão de Usuários" : ""}
              >
                {isNavActive('/settings/users') && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full shadow-xs" />
                )}
                <div className="shrink-0 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform">
                  <Shield size={19} />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold whitespace-nowrap truncate">
                    Gestão de Usuários
                  </span>
                )}
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Cartão de Crédito ao Desenvolvedor */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 shrink-0">
          <div className="text-center p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Desenvolvido por
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Johnathan Herbert
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              ID: 75710
            </div>
            <a
              href="https://github.com/johnathanherbert"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-primary bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 rounded-lg transition-all hover:scale-105"
            >
              <Github size={12} />
              <span>GitHub</span>
              <ExternalLink size={9} />
            </a>
          </div>
        </div>
      )}

      {/* Toggle Expandir / Recolher */}
      <div className="border-t border-slate-200/80 dark:border-slate-800 p-2 shrink-0">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
        >
          {collapsed ? (
            <Menu size={18} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span className="text-xs font-semibold">Recolher Menu</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};