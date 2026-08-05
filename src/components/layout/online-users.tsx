"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  serverTimestamp, 
  setDoc,
  onSnapshot,
  where,
  or,
  and,
  addDoc,
  updateDoc,
  orderBy,
  limit,
  doc as firestoreDoc
} from 'firebase/firestore';
import { 
  Users, 
  Circle, 
  ArrowLeft, 
  Send, 
  MessageCircle, 
  WifiOff, 
  AlertTriangle, 
  RefreshCw,
  Search,
  Hash,
  CheckCheck,
  Check,
  Smile,
  Copy,
  Volume2,
  VolumeX,
  Sparkles,
  Flame,
  Factory,
  Package,
  Layers,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface UserContact {
  id: string;
  name: string;
  email: string;
  lastActive: Date;
  isOnline: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId?: string;
  receiverName?: string;
  channelId?: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface ChatChannel {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

type MainTab = 'channels' | 'direct';
type ActiveChat = { type: 'channel'; channel: ChatChannel } | { type: 'direct'; user: UserContact } | null;

const CHANNELS: ChatChannel[] = [
  {
    id: 'geral',
    name: 'Geral',
    description: 'Comunicação aberta para toda a fábrica',
    icon: <MessageSquare className="w-4 h-4 text-blue-500" />,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
  },
  {
    id: 'producao',
    name: 'Linha de Produção',
    description: 'Avisos de Heijunka, rotas e turnos',
    icon: <Factory className="w-4 h-4 text-amber-500" />,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  },
  {
    id: 'almoxarifado',
    name: 'Almoxarifado & NTs',
    description: 'Status de materiais e notas de transporte',
    icon: <Package className="w-4 h-4 text-emerald-500" />,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  }
];

const QUICK_REPLIES = [
  'Combinado! 👍',
  'Verificado ✅',
  'A caminho 🚚',
  'Urgente! ⚠️',
  'Recebido 📦'
];

const EMOJI_LIST = ['👍', '✅', '❤️', '🚀', '⚠️', '🔥', '👏', '📦', '👀', '💡'];

export function OnlineUsers() {
  const { user, userData } = useFirebase();
  const { playSound } = useAudioNotification();

  // Estados principais
  const [open, setOpen] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('channels');
  const [activeChat, setActiveChat] = useState<ActiveChat>(null);
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [networkOnline, setNetworkOnline] = useState(true);
  const [messagesError, setMessagesError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [soundMuted, setSoundMuted] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Presença do usuário no Firestore
  useEffect(() => {
    if (!user) return;

    let isActive = true;
    let updateTimeout: NodeJS.Timeout;

    const updatePresence = async () => {
      if (!isActive) return;
      
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          lastActive: serverTimestamp(),
          isOnline: true,
          name: userData?.name || user.displayName || user.email?.split('@')[0] || 'Usuário',
          email: user.email || ''
        }, { merge: true });
      } catch (error) {
        console.error('Erro ao atualizar presença:', error);
      }
    };

    updatePresence();

    const interval = setInterval(() => {
      if (isActive) updatePresence();
    }, 45000);

    const handleVisibilityChange = () => {
      if (!document.hidden && isActive) {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updatePresence, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      clearInterval(interval);
      clearTimeout(updateTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, { isOnline: false }, { merge: true }).catch(console.error);
    };
  }, [user, userData]);

  // Carregar todos os contatos e status de online
  useEffect(() => {
    if (!user) return;

    let isSubscribed = true;

    const fetchContacts = async () => {
      if (!isSubscribed) return;
      
      try {
        const usersQuery = query(collection(db, 'users'));
        const snapshot = await getDocs(usersQuery);
        
        const loadedContacts: UserContact[] = [];
        const now = Date.now();
        const twoMinutesAgo = new Date(now - 2 * 60 * 1000);
        
        snapshot.forEach((docSnap) => {
          if (docSnap.id === user.uid) return;

          const data = docSnap.data();
          let lastActive: Date;
          if (data.lastActive?.toDate) {
            lastActive = data.lastActive.toDate();
          } else if (data.lastActive instanceof Date) {
            lastActive = data.lastActive;
          } else {
            lastActive = new Date(0);
          }
          
          const isRecentlyActive = data.isOnline === true && lastActive > twoMinutesAgo;
          
          loadedContacts.push({
            id: docSnap.id,
            name: data.name || data.email?.split('@')[0] || 'Usuário',
            email: data.email || '',
            lastActive,
            isOnline: isRecentlyActive
          });
        });

        // Ordenar: Online primeiro, depois por nome
        loadedContacts.sort((a, b) => {
          if (a.isOnline === b.isOnline) {
            return a.name.localeCompare(b.name);
          }
          return a.isOnline ? -1 : 1;
        });
        
        if (isSubscribed) {
          setContacts(loadedContacts);
        }
      } catch (error) {
        console.error('Erro ao buscar lista de usuários:', error);
      }
    };

    fetchContacts();
    const interval = setInterval(fetchContacts, 15000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [user]);

  // Monitorar estado da rede (offline/online)
  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    setNetworkOnline(navigator.onLine);

    const handleOnline = () => {
      setNetworkOnline(true);
      toast.success('Conexão restabelecida no chat.');
    };
    const handleOffline = () => {
      setNetworkOnline(false);
      toast.error('Você está offline. Mensagens não poderão ser enviadas.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitorar contagem de mensagens não lidas
  useEffect(() => {
    if (!user) return;

    const unreadQuery = query(
      collection(db, 'private_messages'),
      where('receiverId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(
      unreadQuery,
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const senderId = data.senderId;
          counts[senderId] = (counts[senderId] || 0) + 1;
        });
        setUnreadCounts(counts);
      },
      (error) => console.error('Erro no listener de mensagens não lidas:', error)
    );

    return () => unsubscribe();
  }, [user]);

  // Monitorar mensagens do chat ativo (Canal ou Direto)
  useEffect(() => {
    if (!user || !activeChat) {
      setMessages([]);
      return;
    }

    let messagesQuery;

    if (activeChat.type === 'channel') {
      messagesQuery = query(
        collection(db, 'channel_messages'),
        where('channelId', '==', activeChat.channel.id),
        limit(100)
      );
    } else {
      messagesQuery = query(
        collection(db, 'private_messages'),
        or(
          and(
            where('senderId', '==', user.uid),
            where('receiverId', '==', activeChat.user.id)
          ),
          and(
            where('senderId', '==', activeChat.user.id),
            where('receiverId', '==', user.uid)
          )
        ),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        setMessagesError(false);
        const loadedMsgs: ChatMessage[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedMsgs.push({
            id: docSnap.id,
            senderId: data.senderId,
            senderName: data.senderName,
            receiverId: data.receiverId,
            receiverName: data.receiverName,
            channelId: data.channelId,
            message: data.message,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
            read: data.read || false
          });
        });

        const sorted = loadedMsgs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        // Tocar som de mensagem recebida
        if (lastMessageCountRef.current > 0 && sorted.length > lastMessageCountRef.current && !soundMuted) {
          const lastMsg = sorted[sorted.length - 1];
          if (lastMsg.senderId !== user.uid) {
            playSound({ enabled: true, volume: 0.5, soundType: 'subtle' });
          }
        }
        
        lastMessageCountRef.current = sorted.length;
        setMessages(sorted);

        // Marcar DMs como lidas ao visualizar
        if (activeChat.type === 'direct') {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (!data.read && data.receiverId === user.uid) {
              updateDoc(firestoreDoc(db, 'private_messages', docSnap.id), { read: true })
                .catch(err => console.error('Erro ao marcar como lida:', err));
            }
          });
        }
      },
      (error) => {
        console.error('Erro ao carregar mensagens:', error);
        setMessagesError(true);
      }
    );

    return () => unsubscribe();
  }, [user, activeChat, playSound, retryTick, soundMuted]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!user) return null;

  // Filtro de contatos por pesquisa
  const filteredContacts = contacts.filter((c) => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineCount = contacts.filter(c => c.isOnline).length;
  const displayedAvatars = contacts.filter(c => c.isOnline).slice(0, 3);
  const totalUnreadCount = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  // Enviar Mensagem
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const messageText = newMessage.trim();
    if (!messageText || !user || !activeChat || isSending) return;

    if (!networkOnline) {
      toast.error('Sem conexão com a internet.');
      return;
    }

    setIsSending(true);
    setNewMessage('');
    setShowEmojiPicker(false);

    try {
      if (activeChat.type === 'channel') {
        await addDoc(collection(db, 'channel_messages'), {
          channelId: activeChat.channel.id,
          senderId: user.uid,
          senderName: userData?.name || user.displayName || user.email?.split('@')[0] || 'Usuário',
          message: messageText,
          timestamp: serverTimestamp(),
          createdAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'private_messages'), {
          senderId: user.uid,
          senderName: userData?.name || user.displayName || user.email?.split('@')[0] || 'Usuário',
          receiverId: activeChat.user.id,
          receiverName: activeChat.user.name,
          message: messageText,
          timestamp: serverTimestamp(),
          createdAt: new Date().toISOString(),
          read: false
        });
      }

      if (!soundMuted) {
        playSound({ enabled: true, volume: 0.3, soundType: 'subtle' });
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Falha ao enviar. Tente novamente.');
      setNewMessage(messageText);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  // Copiar lote ou código ao clicar
  const handleCopyCode = (text: string, typeName: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${typeName} "${text}" copiado!`, { icon: '📋' });
  };

  // Copiar texto da mensagem
  const handleCopyMessage = (msgText: string) => {
    navigator.clipboard.writeText(msgText);
    toast.success('Mensagem copiada!', { icon: '✨' });
  };

  // Renderizar mensagem com destaque clicável para Lotes/Códigos
  const renderFormattedMessage = (text: string) => {
    const combinedPattern = /([A-Z]\d[A-Z]\d{4})|(\b\d{6}\b)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = combinedPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const matchedText = match[0];
      const isLote = /[A-Z]\d[A-Z]\d{4}/.test(matchedText);

      parts.push(
        <button
          key={match.index}
          type="button"
          onClick={() => handleCopyCode(matchedText, isLote ? 'Lote' : 'Código')}
          title="Clique para copiar"
          className={cn(
            "px-1.5 py-0.5 mx-0.5 rounded font-mono font-bold text-xs transition-all hover:scale-105 inline-flex items-center gap-1 cursor-pointer",
            isLote
              ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
              : "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200"
          )}
        >
          {matchedText}
        </button>
      );

      lastIndex = match.index + matchedText.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Obter iniciais do nome
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Obter cor consistente do avatar
  const getColorFromId = (id: string) => {
    const colors = [
      'bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 
      'bg-amber-600', 'bg-indigo-600', 'bg-sky-600', 'bg-rose-600'
    ];
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Formatar horário
  const formatMsgTime = (date: Date) => {
    try {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'agora';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white/90 hover:text-white cursor-pointer"
          title="Abrir Chat da Equipe"
        >
          {/* Avatar stack para usuários online */}
          <div className="flex items-center -space-x-2">
            {displayedAvatars.map((onlineUser, index) => (
              <div
                key={onlineUser.id}
                className={cn(
                  "relative w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#003d6b] shadow-xs text-[10px] font-bold text-white",
                  getColorFromId(onlineUser.id)
                )}
                style={{ zIndex: displayedAvatars.length - index }}
              >
                {getInitials(onlineUser.name)}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-[#003d6b]" />
              </div>
            ))}

            {onlineCount === 0 && (
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/80">
                <MessageSquare className="w-4 h-4" />
              </div>
            )}
          </div>

          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-bold leading-tight">Chat</span>
            <span className="text-[10px] text-emerald-300 font-medium leading-none flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {onlineCount} online
            </span>
          </div>

          {/* Badge Geral de Não Lidas */}
          {totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black border-2 border-[#003d6b] animate-pulse shadow-md">
              {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent 
        className="w-[430px] sm:w-[470px] p-0 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-950 flex flex-col overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Cabeçalho da Central de Mensagens */}
        <div className="p-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between gap-2">
            {activeChat ? (
              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveChat(null)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  title="Voltar à lista"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>

                {activeChat.type === 'channel' ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Hash className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm leading-none flex items-center gap-1.5">
                        #{activeChat.channel.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-none truncate max-w-[220px]">
                        {activeChat.channel.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white", getColorFromId(activeChat.user.id))}>
                      {getInitials(activeChat.user.name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm leading-none">
                        {activeChat.user.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-none flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full", activeChat.user.isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
                        {activeChat.user.isOnline ? 'Online agora' : 'Offline'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-none">Central de Comunicação</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-none">
                    {onlineCount} colaboradores ativos na fábrica
                  </p>
                </div>
              </div>
            )}

            {/* Controles de Som */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSoundMuted(!soundMuted)}
              className="w-8 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              title={soundMuted ? "Ativar som de mensagens" : "Silenciar mensagens"}
            >
              {soundMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </Button>
          </div>

          {/* Abas Principais (Canais vs Mensagens Diretas) quando nenhuma conversa está aberta */}
          {!activeChat && (
            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setMainTab('channels')}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                  mainTab === 'channels'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                <Hash className="w-3.5 h-3.5" />
                Canais de Equipe
              </button>
              <button
                type="button"
                onClick={() => setMainTab('direct')}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 relative",
                  mainTab === 'direct'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Mensagens Diretas
                {totalUnreadCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                    {totalUnreadCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* --- LISTA DE CANAIS OU CONTATOS --- */}
        {!activeChat ? (
          <div className="h-[430px] flex flex-col bg-white dark:bg-slate-950">
            {mainTab === 'channels' ? (
              <ScrollArea className="flex-1 p-3">
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide px-2 mb-2">
                  Canais Públicos da Fábrica
                </p>
                <div className="space-y-2">
                  {CHANNELS.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setActiveChat({ type: 'channel', channel: ch })}
                      className="w-full p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-all flex items-center gap-3 text-left group cursor-pointer"
                    >
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", ch.color)}>
                        {ch.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary leading-tight">
                            #{ch.name}
                          </h4>
                          <span className="text-[10px] font-semibold text-slate-400 group-hover:text-primary">
                            Entrar →
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {ch.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Campo de Pesquisa de Usuários */}
                <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar colaborador por nome..."
                      className="pl-8 h-8 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1 p-2">
                  {filteredContacts.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Nenhum colaborador encontrado com "{searchQuery}".
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredContacts.map((contactUser) => {
                        const unread = unreadCounts[contactUser.id] || 0;
                        return (
                          <button
                            key={contactUser.id}
                            type="button"
                            onClick={() => setActiveChat({ type: 'direct', user: contactUser })}
                            className="w-full p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-all flex items-center justify-between group cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs", getColorFromId(contactUser.id))}>
                                  {getInitials(contactUser.name)}
                                </div>
                                <span className={cn(
                                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950",
                                  contactUser.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                                )} />
                              </div>

                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-primary">
                                  {contactUser.name}
                                </p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                  {contactUser.isOnline ? 'Online no sistema' : contactUser.email}
                                </p>
                              </div>
                            </div>

                            {unread > 0 && (
                              <span className="w-5 h-5 rounded-full bg-red-500 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                                {unread}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        ) : (
          /* --- ÁREA DE CONVERSA DO CHAT ATIVO --- */
          <div className="h-[430px] flex flex-col bg-slate-50/50 dark:bg-slate-950">
            {/* Mensagem de status offline/erro */}
            {!networkOnline && (
              <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-bold flex items-center gap-2">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                Sem conexão. Suas mensagens não serão entregues.
              </div>
            )}

            {/* Lista de Mensagens Scrollável */}
            <ScrollArea className="flex-1 p-3">
              {messages.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-primary flex items-center justify-center mb-2">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Inicie a conversa
                  </h4>
                  <p className="text-[11px] text-slate-400 max-w-[220px] mt-1">
                    Envie uma mensagem para começar a colaborar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isMine = msg.senderId === user.uid;

                    return (
                      <div
                        key={msg.id}
                        className={cn("flex flex-col group relative", isMine ? "items-end" : "items-start")}
                      >
                        {/* Nome do remetente nos canais públicos */}
                        {!isMine && activeChat.type === 'channel' && (
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1">
                            {msg.senderName}
                          </span>
                        )}

                        {/* Balão da Mensagem */}
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed relative shadow-xs",
                            isMine
                              ? "bg-primary text-white rounded-br-none"
                              : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-bl-none"
                          )}
                        >
                          <div className="break-words">
                            {renderFormattedMessage(msg.message)}
                          </div>

                          <div className={cn("flex items-center justify-end gap-1 mt-1 text-[9.5px]", isMine ? "text-blue-100" : "text-slate-400")}>
                            <span>{formatMsgTime(msg.timestamp)}</span>
                            {isMine && activeChat.type === 'direct' && (
                              <CheckCheck className={cn("w-3 h-3", msg.read ? "text-sky-300" : "text-blue-200/60")} />
                            )}

                            {/* Botão sutil de copiar mensagem ao passar o mouse */}
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.message)}
                              className="ml-1 opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"
                              title="Copiar texto"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Barra de Respostas Rápidas (Quick Chips) */}
            <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {QUICK_REPLIES.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setNewMessage(prev => prev ? `${prev} ${chip}` : chip);
                    inputRef.current?.focus();
                  }}
                  className="px-2 py-0.5 text-[10.5px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/50 transition-all shrink-0 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Picker Rápido de Emojis */}
            {showEmojiPicker && (
              <div className="p-2 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1 justify-between overflow-x-auto">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setNewMessage(prev => prev + emoji);
                      setShowEmojiPicker(false);
                      inputRef.current?.focus();
                    }}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-sm transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Form de Envio de Mensagem */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Inserir emoji"
              >
                <Smile className="w-4 h-4" />
              </button>

              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite sua mensagem ou cole um lote/código..."
                disabled={isSending || !networkOnline}
                className="flex-1 h-9 text-xs rounded-xl border-slate-200 dark:border-slate-800 focus:ring-primary"
                maxLength={500}
              />

              <Button
                type="submit"
                disabled={!newMessage.trim() || isSending || !networkOnline}
                size="icon"
                className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 text-white shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
