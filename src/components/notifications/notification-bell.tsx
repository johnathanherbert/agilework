import { useNotifications, Notification, NotificationMessagePart } from '@/components/providers/notification-provider';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Clock, 
  CheckCircle, 
  ExternalLink, 
  Factory, 
  FilePlus2, 
  CircleDollarSign, 
  Settings,
  BellOff,
  Sparkles,
  Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type NotificationFilterTab = 'all' | 'unread' | 'nt' | 'production';

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
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>('all');

  const formatTime = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch (error) {
      return 'agora';
    }
  };

  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return notifications.filter((n) => !n.read);
      case 'nt':
        return notifications.filter((n) => 
          n.type === 'nt_created' || n.type === 'nt_updated' || n.type === 'nt_deleted' || n.type === 'item_paid'
        );
      case 'production':
        return notifications.filter((n) => n.type === 'production_updated');
      case 'all':
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Navegar para a entidade relacionada, se houver
    if (notification.type === 'nt_created' && notification.entityId) {
      router.push(`/almoxarifado/nts?nt=${notification.entityId}`);
    } else if (notification.type === 'production_updated') {
      router.push('/producao');
    }
    
    setIsOpen(false);
  };

  const handleRemoveNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeNotification(id);
  };

  // Classes de destaque para cada tipo de informação distinta na mensagem
  const partVariantClasses: Record<NonNullable<NotificationMessagePart['variant']>, string> = {
    actor: 'font-bold text-blue-600 dark:text-blue-400',
    entity: 'font-semibold text-purple-600 dark:text-purple-400',
    'status-success': 'font-semibold text-emerald-600 dark:text-emerald-400',
    'status-warning': 'font-semibold text-amber-600 dark:text-amber-400',
    accent: 'font-bold text-sky-600 dark:text-sky-400',
    muted: 'text-slate-400 dark:text-slate-500 font-normal',
  };

  const renderMessage = (notification: Notification) => {
    if (!notification.parts || notification.parts.length === 0) {
      return notification.message;
    }

    return notification.parts.map((part, index) => (
      <span key={index} className={part.variant ? partVariantClasses[part.variant] : undefined}>
        {part.text}
      </span>
    ));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'nt_created':
        return <FilePlus2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'nt_updated':
        return <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'item_paid':
        return <CircleDollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'production_updated':
        return <Factory className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
      case 'system':
      default:
        return <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  const getNotificationIconBg = (type: Notification['type']) => {
    switch (type) {
      case 'nt_created':
        return 'bg-blue-100/80 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50';
      case 'nt_updated':
        return 'bg-amber-100/80 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50';
      case 'item_paid':
        return 'bg-emerald-100/80 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50';
      case 'production_updated':
        return 'bg-sky-100/80 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-800/50';
      case 'system':
      default:
        return 'bg-purple-100/80 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800/50';
    }
  };

  return (
    <div className="relative">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative text-white/90 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300 h-10 w-10 shadow-xs active:scale-95"
            title="Central de Notificações"
          >
            <Bell size={20} className={cn("transition-transform duration-300", isOpen && "rotate-12 scale-110")} />
            {notificationsEnabled && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black border-2 border-[#003d6b] animate-pulse shadow-md z-50">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent 
          align="end" 
          className="w-[420px] sm:w-[450px] p-0 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-950 flex flex-col overflow-hidden"
          style={{ maxHeight: 'min(80vh, var(--radix-dropdown-menu-content-available-height, 560px))' }}
        >
          {/* Header Superior */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary">
                  <Bell size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none flex items-center gap-2">
                    Notificações
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Acompanhe atualizações em tempo real
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={markAllAsRead}
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1 text-blue-600 dark:text-blue-400" />
                    Lidas
                  </Button>
                )}
                
                {notifications.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    onClick={clearNotifications}
                    title="Limpar todas as notificações"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Abas de Filtro Segmentado */}
            {notifications.length > 0 && (
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all",
                    activeTab === 'all'
                      ? "bg-primary text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  )}
                >
                  Todas ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('unread')}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1",
                    activeTab === 'unread'
                      ? "bg-primary text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  )}
                >
                  Não lidas
                  {unreadCount > 0 && (
                    <span className={cn(
                      "w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black",
                      activeTab === 'unread' ? "bg-white text-primary" : "bg-blue-500 text-white"
                    )}>
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('nt')}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all",
                    activeTab === 'nt'
                      ? "bg-primary text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  )}
                >
                  NTs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('production')}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all",
                    activeTab === 'production'
                      ? "bg-primary text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  )}
                >
                  Produção
                </button>
              </div>
            )}
          </div>
          
          {/* Conteúdo Principal com Lista Scrollável */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-white dark:bg-slate-950">
            {filteredNotifications.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredNotifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={cn(
                      "p-3.5 cursor-pointer transition-all duration-200 relative group",
                      !notification.read 
                        ? "bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-l-4 border-l-primary" 
                        : "hover:bg-slate-50 dark:hover:bg-slate-900/60 border-l-4 border-l-transparent"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Ícone com background estilizado */}
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105",
                        getNotificationIconBg(notification.type)
                      )}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      {/* Informações da Notificação */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={cn(
                            "text-xs leading-tight font-bold truncate",
                            !notification.read ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"
                          )}>
                            {notification.title}
                          </h4>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Clock size={10} className="opacity-70" />
                              {formatTime(notification.createdAt)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveNotification(e, notification.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-all"
                              aria-label="Remover notificação"
                              title="Remover"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        
                        <p className={cn(
                          "text-xs mt-1 leading-relaxed",
                          !notification.read ? "text-slate-800 dark:text-slate-200 font-medium" : "text-slate-600 dark:text-slate-400"
                        )}>
                          {renderMessage(notification)}
                        </p>
                        
                        {notification.entityId && (
                          <div className="mt-2 flex justify-end">
                            <span className="inline-flex items-center text-[11px] font-bold text-primary hover:underline group-hover:translate-x-0.5 transition-transform">
                              Ver detalhes
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Estado Vazio Refinado */
              <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                {!notificationsEnabled ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                      <BellOff className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Notificações Desativadas</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] mt-1">
                      As notificações estão desabilitadas nas configurações do sistema.
                    </p>
                  </>
                ) : activeTab !== 'all' ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-400 flex items-center justify-center mb-3">
                      <Inbox className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Nenhum item encontrado</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] mt-1">
                      Não há notificações nesta categoria no momento.
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setActiveTab('all')} 
                      className="mt-3 text-xs font-bold text-primary"
                    >
                      Ver todas as notificações
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-primary flex items-center justify-center mb-3">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Tudo em dia por aqui!</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[250px] mt-1">
                      Você não tem nenhuma notificação no momento. Novas mensagens aparecerão aqui.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Rodapé com Atalho para Configurações */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800 shrink-0 flex items-center justify-between text-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pl-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Notificações ativas
            </span>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg gap-1.5"
              onClick={() => {
                setIsOpen(false);
                router.push('/settings');
              }}
            >
              <Settings className="h-3.5 w-3.5 text-slate-500" />
              Configurar Som & Alertas
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

