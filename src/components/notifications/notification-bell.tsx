import { useNotifications, Notification } from '@/components/providers/notification-provider';
import { Bell, CheckCheck, Trash2, Clock, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const NotificationBell = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications, 
    notificationsEnabled 
  } = useNotifications();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const formatTime = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch (error) {
      return 'data desconhecida';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navegar para a entidade relacionada, se houver
    if (notification.type === 'nt_created' && notification.entityId) {
      router.push(`/almoxarifado/nts?nt=${notification.entityId}`);
    }
    
    setIsOpen(false);
  };
  return (
    <div className="relative">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 rounded-xl transition-all duration-300 h-10 w-10 shadow-sm hover:shadow-md hover:scale-105"
          >
            <Bell size={20} />
            {notificationsEnabled && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold animate-pulse border-2 border-white dark:border-gray-800 z-50">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-[350px] p-0 border border-gray-200 dark:border-gray-700 shadow-lg"
        >
          <div className="p-3 font-medium border-b flex items-center justify-between bg-white dark:bg-gray-900">
            <h3 className="text-gray-900 dark:text-gray-100">Notificações</h3>
            
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={markAllAsRead}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                  Marcar todas como lidas
                </Button>
              )}
              
              {notifications.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-gray-500 hover:text-red-600"
                  onClick={clearNotifications}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          
          <ScrollArea className="max-h-[400px] bg-white dark:bg-gray-900">
            {notifications.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={cn(
                      "p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors",
                      !notification.read && "bg-blue-50 dark:bg-blue-900/20"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 p-2 rounded-full flex-shrink-0",
                        notification.type === 'nt_created' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                        notification.type === 'nt_updated' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {notification.type === 'nt_created' && <Bell className="h-4 w-4" />}
                        {notification.type === 'nt_updated' && <Clock className="h-4 w-4" />}
                        {notification.type === 'system' && <CheckCircle className="h-4 w-4" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={cn(
                            "text-sm font-medium truncate",
                            !notification.read ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"
                          )}>
                            {notification.title}
                          </h4>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {formatTime(notification.createdAt)}
                          </span>
                        </div>
                        
                        <p className={cn(
                          "text-xs mt-0.5",
                          !notification.read ? "text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"
                        )}>
                          {notification.message}
                        </p>
                        
                        {notification.entityId && (
                          <div className="mt-1.5 flex justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            >
                              Ver detalhes
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {notificationsEnabled 
                  ? "Nenhuma notificação no momento" 
                  : "Notificações estão desativadas nas configurações"}
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
