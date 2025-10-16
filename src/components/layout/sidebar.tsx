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
        "h-screen fixed left-0 top-0 z-50 bg-white dark:bg-gray-900 border-r flex flex-col transition-all duration-300 shadow-xl dark:shadow-2xl dark:shadow-gray-900/50",
        collapsed ? "w-[64px]" : "w-[250px]"
      )}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
    >
      <div className="h-16 flex items-center justify-center border-b dark:border-gray-800 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800">
        <div className={cn(
          "flex items-center transition-all duration-300 overflow-hidden",
          collapsed ? "justify-center w-12" : "justify-start w-full px-4"
        )}>
          <ClipboardList className="h-7 w-7 text-white drop-shadow-sm" />
          {!collapsed && <span className="ml-3 font-bold text-lg text-white drop-shadow-sm">NT Manager</span>}
        </div>
      </div>

      <div className="flex-1 py-4 overflow-y-auto scrollbar-thin">
        <nav className="flex flex-col gap-1.5 px-3">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 group",
                collapsed ? "justify-center" : "justify-start",
                currentPath === item.href
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold shadow-sm"
                  : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              )}
              title={collapsed ? item.label : ""}
            >
              <div className={cn(
                "transition-transform group-hover:scale-110",
                collapsed ? "w-6 h-6 flex items-center justify-center" : ""
              )}>
                {item.icon}
              </div>
              {!collapsed && <span className="text-sm whitespace-nowrap font-medium">{item.label}</span>}
            </button>
          ))}        </nav>
      </div>

      {/* Informações do Desenvolvedor */}
      {!collapsed && (
        <div className="border-t dark:border-gray-800 p-3">
          <div className="text-center space-y-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Desenvolvido por
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Johnathan Herbert
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ID: 75710
            </div>
            <a
              href="https://github.com/johnathanherbert"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <Github size={12} />
              <span>GitHub</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      <div className="border-t dark:border-gray-800 p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          {collapsed ? <Menu size={18} /> : (
            <>
              <ChevronLeft size={18} />
              <span className="text-sm">Recolher</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};