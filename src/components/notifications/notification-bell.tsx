"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, Notification } from '@/components/providers/notification-provider';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

type NotificationTab = 'all' | 'unread' | 'nt' | 'production';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatHM(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTimeRelative(date: Date) {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return formatHM(date);
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'ontem';
  }
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) {
    return DIAS[date.getDay()];
  }
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

export const NotificationBell = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    removeNotification,
    clearNotifications, 
    notificationsEnabled 
  } = useNotifications();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBumping, setIsBumping] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const prevUnreadRef = useRef(unreadCount);

  // Efeito de animação bump quando surge nova notificação não lida
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setIsBumping(true);
      const timer = setTimeout(() => setIsBumping(false), 500);
      return () => clearTimeout(timer);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Fechar com tecla Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filtragem e busca
  const filteredNotifications = useMemo(() => {
    let list = notifications;

    if (activeTab === 'unread') {
      list = list.filter((n) => !n.read);
    } else if (activeTab === 'nt') {
      list = list.filter((n) => 
        n.type === 'nt_created' || n.type === 'nt_updated' || n.type === 'nt_deleted' || n.type === 'item_paid'
      );
    } else if (activeTab === 'production') {
      list = list.filter((n) => n.type === 'production_updated');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.message.toLowerCase().includes(q) ||
        (n.entityId && n.entityId.toLowerCase().includes(q))
      );
    }

    return list;
  }, [notifications, activeTab, searchQuery]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Extrai número da NT se existir em parts, message ou entityId
    let ntNumber = '';
    if (notification.parts) {
      const entityPart = notification.parts.find(p => p.variant === 'entity' && /\d{4,10}/.test(p.text));
      if (entityPart) {
        ntNumber = entityPart.text.replace(/[^0-9]/g, '');
      }
    }
    if (!ntNumber && notification.message) {
      const match = notification.message.match(/NT\s*#?(\d{4,10})/i) || notification.message.match(/#(\d{4,10})/) || notification.message.match(/(\d{5,10})/);
      if (match) {
        ntNumber = match[1];
      }
    }
    if (!ntNumber && notification.entityId && /^\d+$/.test(notification.entityId)) {
      ntNumber = notification.entityId;
    }

    if (ntNumber) {
      router.push(`/almoxarifado/nts?search=${encodeURIComponent(ntNumber)}`);
    } else if (notification.type === 'nt_created' || notification.type === 'nt_updated' || notification.type === 'item_paid') {
      router.push('/almoxarifado/nts');
    } else if (notification.type === 'production_updated') {
      router.push('/producao');
    }
    
    setIsOpen(false);
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeNotification(id);
    toast.success('Notificação removida');
  };

  // Renderização do corpo da notificação com chips interativos de NT
  const renderMessageContent = (notification: Notification) => {
    if (notification.parts && notification.parts.length > 0) {
      return (
        <span className="text-[12.5px] leading-relaxed text-[var(--text)] break-words">
          {notification.parts.map((part, idx) => {
            const isEntity = part.variant === 'entity';
            const isActor = part.variant === 'actor';
            const isSuccess = part.variant === 'status-success';
            const isWarning = part.variant === 'status-warning';
            const isAccent = part.variant === 'accent';

            if (isEntity && /\d{4,10}/.test(part.text)) {
              const code = part.text.replace(/[^0-9]/g, '');
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                    setIsOpen(false);
                    router.push(`/almoxarifado/nts?search=${encodeURIComponent(code)}`);
                  }}
                  title={`Abrir NT ${code} em Notas Técnicas`}
                  className="inline-flex items-center font-mono text-[11.5px] px-1.5 py-0.5 mx-0.5 rounded border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-weak)] font-semibold transition-colors cursor-pointer"
                >
                  {part.text}
                </button>
              );
            }

            return (
              <span
                key={idx}
                className={cn(
                  isActor && "font-semibold text-[var(--text)]",
                  isEntity && "font-medium text-[var(--accent)]",
                  isSuccess && "font-medium text-[var(--green)]",
                  isWarning && "font-medium text-[var(--amber)]",
                  isAccent && "font-bold text-[var(--accent)]",
                  part.variant === 'muted' && "text-[var(--text-3)]"
                )}
              >
                {part.text}
              </span>
            );
          })}
        </span>
      );
    }

    // Fallback: se não tiver parts, detecta número da NT no texto e cria o link
    const match = notification.message?.match(/NT\s*#?(\d{4,10})/i) || notification.message?.match(/#(\d{4,10})/);
    if (match) {
      const code = match[1];
      const parts = notification.message.split(match[0]);
      return (
        <span className="text-[12.5px] leading-relaxed text-[var(--text)] break-words">
          {parts[0]}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!notification.read) {
                markAsRead(notification.id);
              }
              setIsOpen(false);
              router.push(`/almoxarifado/nts?search=${encodeURIComponent(code)}`);
            }}
            title={`Abrir NT ${code} em Notas Técnicas`}
            className="inline-flex items-center font-mono text-[11.5px] px-1.5 py-0.5 mx-0.5 rounded border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-weak)] font-semibold transition-colors cursor-pointer"
          >
            {match[0]}
          </button>
          {parts.slice(1).join(match[0])}
        </span>
      );
    }

    return <span className="text-[12.5px] leading-relaxed text-[var(--text)] break-words">{notification.message}</span>;
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'nt_created':
        return (
          <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        );
      case 'nt_updated':
        return (
          <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case 'item_paid':
        return (
          <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'production_updated':
        return (
          <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
            <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            <path d="M17 18h1" />
            <path d="M12 18h1" />
            <path d="M7 18h1" />
          </svg>
        );
      case 'chat_mention':
        return (
          <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  const getNotificationColorClass = (type: Notification['type']) => {
    switch (type) {
      case 'nt_created':
        return 'text-[var(--accent)] border-[var(--accent)]/30 bg-[var(--accent-weak)]';
      case 'nt_updated':
        return 'text-[var(--amber)] border-[var(--amber)]/30 bg-[var(--amber)]/10';
      case 'item_paid':
        return 'text-[var(--green)] border-[var(--green)]/30 bg-[var(--green)]/10';
      case 'production_updated':
        return 'text-[var(--accent)] border-[var(--border)] bg-[var(--surface-2)]';
      case 'chat_mention':
        return 'text-[var(--accent)] border-[var(--accent)]/30 bg-[var(--accent-weak)]';
      default:
        return 'text-[var(--text-3)] border-[var(--border)] bg-[var(--surface-2)]';
    }
  };

  return (
    <div className="relative inline-block select-none">
      {/* Botão de Gatilho na Topbar */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          "w-7 h-7 rounded-[6px] grid place-items-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer relative",
          isOpen && "bg-[var(--hover)] text-[var(--text)]"
        )}
        title="Notificações"
      >
        <svg className="w-4 h-4 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>

        {notificationsEnabled && unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-[8px] bg-[var(--red)] text-white text-[9.5px] font-semibold grid place-items-center border-2 border-[var(--surface)] shadow-xs",
              isBumping && "animate-bump"
            )}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* PAINEL DE NOTIFICAÇÕES (.cc style) */}
      {isOpen && (
        <section
          ref={panelRef}
          role="dialog"
          aria-label="Notificações"
          className="fixed sm:absolute top-12 right-2 sm:right-0 w-[calc(100vw-16px)] sm:w-[400px] h-[min(580px,calc(100vh-60px))] flex flex-col bg-[var(--surface)] border border-[var(--border-strong)] rounded-[8px] shadow-[0_16px_40px_rgba(0,0,0,0.45)] z-50 overflow-hidden animate-fade-in"
        >
          {/* Cabeçalho do Painel */}
          <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-1 shrink-0">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)] leading-tight">
                Notificações
              </h2>
              <div className="text-xs text-[var(--text-3)] flex items-center gap-1.5 mt-0.5">
                <i className={cn("w-1.5 h-1.5 rounded-full", unreadCount > 0 ? "bg-[var(--accent)] animate-pulse-dot" : "bg-[var(--green)]")} />
                <span>
                  {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas as notificações lidas'}
                </span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="h-6 px-2 text-[11.5px] font-medium text-[var(--accent)] hover:bg-[var(--hover)] rounded-[4px] transition-colors cursor-pointer"
                  title="Marcar todas como lidas"
                >
                  Lidas
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="w-7 h-7 rounded-[6px] grid place-items-center text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                  title="Limpar todas as notificações"
                >
                  <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-[6px] grid place-items-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                title="Fechar (Esc)"
              >
                <svg className="w-4 h-4 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Abas (.cc-tabs) */}
          <div className="flex gap-1 px-3 pt-2 border-b border-[var(--border)] shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('all');
                setSearchQuery('');
              }}
              className={cn(
                "relative px-2 py-1.5 text-[12.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                activeTab === 'all'
                  ? "text-[var(--text)] after:content-[''] after:absolute after:left-1.5 after:right-1.5 after:-bottom-[1px] after:h-[2px] after:bg-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <span>Todas</span>
              <span className="font-mono text-[10.5px] text-[var(--text-3)]">
                {notifications.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('unread');
                setSearchQuery('');
              }}
              className={cn(
                "relative px-2 py-1.5 text-[12.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                activeTab === 'unread'
                  ? "text-[var(--text)] after:content-[''] after:absolute after:left-1.5 after:right-1.5 after:-bottom-[1px] after:h-[2px] after:bg-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <span>Não lidas</span>
              {unreadCount > 0 && (
                <span className="font-mono text-[10.5px] text-[var(--red)] font-semibold">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('nt');
                setSearchQuery('');
              }}
              className={cn(
                "relative px-2 py-1.5 text-[12.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                activeTab === 'nt'
                  ? "text-[var(--text)] after:content-[''] after:absolute after:left-1.5 after:right-1.5 after:-bottom-[1px] after:h-[2px] after:bg-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <span>NTs</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('production');
                setSearchQuery('');
              }}
              className={cn(
                "relative px-2 py-1.5 text-[12.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                activeTab === 'production'
                  ? "text-[var(--text)] after:content-[''] after:absolute after:left-1.5 after:right-1.5 after:-bottom-[1px] after:h-[2px] after:bg-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <span>Produção</span>
            </button>
          </div>

          {/* Campo de Busca (.cc-search) */}
          <div className="p-3 pb-1.5 shrink-0">
            <div className="flex items-center gap-2 h-[30px] px-2.5 rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg)] text-[var(--text-3)] focus-within:border-[var(--accent)] transition-colors">
              <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar notificação ou NT..."
                className="bg-transparent border-0 outline-none text-[12.5px] text-[var(--text)] flex-1 min-w-0 placeholder:text-[var(--text-3)]"
              />
            </div>
          </div>

          {/* Lista de Notificações */}
          <div className="flex-1 overflow-y-auto pb-2">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-3)] leading-relaxed">
                {searchQuery ? (
                  `Nenhuma notificação encontrada com "${searchQuery}".`
                ) : activeTab === 'unread' ? (
                  'Tudo em dia! Você não tem notificações não lidas.'
                ) : (
                  'Nenhuma notificação recente por aqui.'
                )}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {filteredNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "grid grid-cols-[28px_1fr_auto] gap-2.5 items-start px-3.5 py-2.5 hover:bg-[var(--hover)] transition-colors cursor-pointer group relative",
                      !n.read && "bg-[var(--accent-weak)]/30"
                    )}
                  >
                    {/* Ícone de Categoria */}
                    <span
                      className={cn(
                        "w-7 h-7 rounded-[6px] border grid place-items-center shrink-0 mt-0.5",
                        getNotificationColorClass(n.type)
                      )}
                    >
                      {getNotificationIcon(n.type)}
                    </span>

                    {/* Texto da Notificação */}
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <b className={cn("text-[13px] truncate", !n.read ? "font-semibold text-[var(--text)]" : "font-medium text-[var(--text-2)]")}>
                          {n.title}
                        </b>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                        )}
                      </div>

                      <div className="mt-0.5">
                        {renderMessageContent(n)}
                      </div>
                    </div>

                    {/* Hora e Ações no Hover */}
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                      <time className="font-mono text-[11px] text-[var(--text-3)]">
                        {formatTimeRelative(n.createdAt)}
                      </time>

                      <button
                        type="button"
                        onClick={(e) => handleRemove(e, n.id)}
                        className="w-5 h-5 rounded-[4px] grid place-items-center text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--surface-2)] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Remover notificação"
                      >
                        <svg className="w-3 h-3 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rodapé (.cc style) */}
          <div className="p-2.5 px-3 bg-[var(--surface-2)] border-t border-[var(--border)] shrink-0 flex items-center justify-between text-xs">
            <span className="text-[11px] text-[var(--text-3)] flex items-center gap-1.5">
              <i className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
              Notificações ativas
            </span>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push('/settings');
              }}
              className="text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              Configurações →
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
