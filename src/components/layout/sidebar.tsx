"use client";

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ClipboardCheck, ClipboardList,
  Home, Settings, Shield,
  ChevronLeft, ChevronRight, Menu, Github, ExternalLink
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <Home size={20} /> },
  { label: 'Gerenciar NTs', href: '/almoxarifado/nts', icon: <ClipboardList size={20} /> },
  { label: 'NTs Concluídas', href: '/almoxarifado/nts?status=concluida', icon: <ClipboardCheck size={20} /> },
  { label: 'Configurações', href: '/settings', icon: <Settings size={20} /> },
];

import { useFirebase } from '@/components/providers/firebase-provider';

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userData } = useFirebase();
  const [currentPath, setCurrentPath] = useState('');  // Update active item when pathname or search params change
  useEffect(() => {
    const status = searchParams?.get('status') || null;

    // Construct full path including query params
    let fullPath = pathname || '';
    if (status) {
      fullPath += `?status=${status}`;
    }

    setCurrentPath(fullPath);
  }, [pathname, searchParams]);

  // Auto-collapse fallback timeout to keep it cleanly retracted if left alone
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (!collapsed) {
      timeoutId = setTimeout(() => {
        setCollapsed(true);
      }, 5000);
    }
    return () => clearTimeout(timeoutId);
  }, [collapsed]);

  return (<div
    className={cn(
      "h-screen fixed left-0 top-0 z-50 bg-background border-r border-border/80 flex flex-col transition-all duration-300",
      collapsed ? "w-[64px] shadow-sm" : "w-[260px] shadow-2xl"
    )}
    onMouseEnter={() => setCollapsed(false)}
    onMouseLeave={() => setCollapsed(true)}
  >
    <div className="h-16 flex items-center justify-center border-b border-white/10 bg-[#003d6b] relative overflow-hidden">
      <div className={cn(
        "relative flex items-center transition-all duration-300 overflow-hidden",
        collapsed ? "justify-center w-12" : "justify-start w-full px-5"
      )}>
        <div className="p-1.5 rounded-xl bg-white/20">
          <ClipboardList className="h-6 w-6 text-white drop-shadow-lg" />
        </div>
        {!collapsed && (
          <div className="ml-3 flex flex-col items-start leading-tight">
            <span className="font-black text-lg text-white drop-shadow-lg tracking-tight">AgileWork</span>
            <div className="text-xs text-white/80 font-medium">Gerenciamento de NTs</div>
          </div>
        )}
      </div>
    </div>

    <div className="flex-1 py-5 overflow-y-auto scrollbar-thin">
      <nav className="flex flex-col gap-2 px-3">
        {navItems.map((item, index) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={cn(
              "relative flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200",
              collapsed ? "justify-center" : "justify-start",
              currentPath === item.href
                ? "bg-blue-50 dark:bg-blue-900/40 text-primary font-bold shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
            )}
            title={collapsed ? item.label : ""}
          >
            <div className={cn(
              "relative z-10",
              collapsed ? "w-6 h-6 flex items-center justify-center" : ""
            )}>
              {item.icon}
            </div>
            {!collapsed && (
              <span className="relative z-10 text-sm whitespace-nowrap">
                {item.label}
              </span>
            )}
          </button>
        ))}

        {/* Admin Items */}
        {userData?.email === 'johnathan.herbert47@gmail.com' && (
          <button
            onClick={() => router.push('/settings/users')}
            className={cn(
              "relative flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 mt-2",
              collapsed ? "justify-center" : "justify-start",
              currentPath === '/settings/users'
                ? "bg-blue-50 dark:bg-blue-900/40 text-primary font-bold shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
            )}
            title={collapsed ? "Gerenciar Usuários" : ""}
          >
            <div className={cn(
              "relative z-10",
              collapsed ? "w-6 h-6 flex items-center justify-center" : ""
            )}>
              <Shield className="h-5 w-5" />
            </div>
            {!collapsed && (
              <span className="relative z-10 text-sm font-semibold whitespace-nowrap">
                Gestão Úsuarios
              </span>
            )}
          </button>
        )}
      </nav>
    </div>

    {/* Informações do Desenvolvedor */}
    {!collapsed && (
      <div className="border-t border-border/80 p-4 bg-muted/30">
        <div className="text-center space-y-2.5 p-3 rounded-2xl bg-card border border-border/60 shadow-sm">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
            Desenvolvido por
          </div>
          <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
            Johnathan Herbert
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            ID: 75710
          </div>
          <a
            href="https://github.com/johnathanherbert"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/90 bg-primary/10 hover:bg-primary/15 rounded-lg transition-all duration-200 hover:scale-105"
          >
            <Github size={13} />
            <span>GitHub</span>
            <ExternalLink size={10} />
          </a>
        </div>
      </div>
    )}

    <div className="border-t border-border/80 p-2.5">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-all duration-200"
      >
        {collapsed ? (
          <Menu size={20} />
        ) : (
          <>
            <ChevronLeft size={18} />
            <span className="text-sm font-medium">Recolher</span>
          </>
        )}
      </button>
    </div>
  </div>
  );
};