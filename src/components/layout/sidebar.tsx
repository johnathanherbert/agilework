"use client";

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  ClipboardCheck, ClipboardList, 
  Home, Settings, Plus, Archive, History,
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

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
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
  
  // Auto-collapse sidebar when not in use
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCollapsed(true);
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [collapsed]);

  return (    <div 
      className={cn(
        "h-screen fixed left-0 top-0 z-50 bg-gradient-to-b from-white via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-900/95 dark:to-gray-900 border-r border-gray-200/50 dark:border-gray-800/50 flex flex-col transition-all duration-300 shadow-2xl backdrop-blur-xl",
        collapsed ? "w-[64px]" : "w-[260px]"
      )}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
    >
      <div className="h-16 flex items-center justify-center border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 dark:from-blue-700 dark:via-indigo-700 dark:to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        <div className={cn(
          "relative flex items-center transition-all duration-300 overflow-hidden",
          collapsed ? "justify-center w-12" : "justify-start w-full px-5"
        )}>
          <div className="p-1.5 rounded-xl bg-white/20 backdrop-blur-sm">
            <ClipboardList className="h-6 w-6 text-white drop-shadow-lg" />
          </div>
          {!collapsed && (
            <div className="ml-3">
              <span className="font-bold text-lg text-white drop-shadow-lg">AgileWork</span>
              <div className="text-[10px] text-blue-100 -mt-0.5">Sistema de Gestão</div>
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
                "relative flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group overflow-hidden",
                collapsed ? "justify-center" : "justify-start",
                currentPath === item.href
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-600/30 scale-105"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 hover:scale-105 hover:shadow-md"
              )}
              title={collapsed ? item.label : ""}
              style={{
                transitionDelay: collapsed ? '0ms' : `${index * 30}ms`
              }}
            >
              {currentPath === item.href && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse" />
              )}
              <div className={cn(
                "relative z-10 transition-transform duration-300",
                currentPath === item.href ? "scale-110" : "group-hover:scale-110",
                collapsed ? "w-6 h-6 flex items-center justify-center" : ""
              )}>
                {item.icon}
              </div>
              {!collapsed && (
                <span className="relative z-10 text-sm font-semibold whitespace-nowrap">
                  {item.label}
                </span>
              )}
              {!collapsed && currentPath === item.href && (
                <div className="absolute right-3 w-2 h-2 bg-white rounded-full animate-pulse" />
              )}
            </button>
          ))}        </nav>
      </div>

      {/* Informações do Desenvolvedor */}
      {!collapsed && (
        <div className="border-t border-gray-200/50 dark:border-gray-800/50 p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50 backdrop-blur-sm">
          <div className="text-center space-y-2.5 p-3 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
            <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
              Desenvolvido por
            </div>
            <div className="text-sm font-bold text-gray-800 dark:text-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Johnathan Herbert
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              ID: 75710
            </div>
            <a
              href="https://github.com/johnathanherbert"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <Github size={13} />
              <span>GitHub</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      <div className="border-t border-gray-200/50 dark:border-gray-800/50 p-2.5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 dark:hover:from-gray-800 dark:hover:to-gray-800/80 text-gray-700 dark:text-gray-300 transition-all duration-200 hover:shadow-md"
        >
          {collapsed ? (
            <Menu size={20} className="transition-transform hover:scale-110" />
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