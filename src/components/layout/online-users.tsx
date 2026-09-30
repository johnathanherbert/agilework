"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, ADMIN_EMAIL } from '@/components/providers/firebase-provider';
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
  deleteDoc,
  limit,
  doc as firestoreDoc
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { getCurrentActiveShift, getShiftPhase, SHIFT_SCHEDULES } from '@/lib/production-schedule';

// Tipagens
interface UserContact {
  id: string;
  name: string;
  email: string;
  role?: string;
  lastActive: Date;
  isOnline: boolean;
  isAway?: boolean;
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
  mentions?: string[];
  isSystem?: boolean;
  meta?: string;
}

interface ChatChannel {
  id: string;
  name: string;
  description: string;
  membersCount: number;
}

type MainTab = 'ch' | 'dm';
type ActiveChat = { type: 'ch'; channel: ChatChannel } | { type: 'dm'; user: UserContact } | null;

const CHANNELS: ChatChannel[] = [
  {
    id: 'geral',
    name: 'geral',
    description: 'Comunicação aberta para toda a fábrica',
    membersCount: 38
  },
  {
    id: 'producao',
    name: 'linha-de-producao',
    description: 'Heijunka, rotas e turnos',
    membersCount: 24
  },
  {
    id: 'almoxarifado',
    name: 'almoxarifado-e-nts',
    description: 'Status de materiais e notas técnicas',
    membersCount: 15
  }
];

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Helpers de formatação e iniciais
function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function getInitials(name: string) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
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

function formatDayHeader(date: Date) {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  return `${DIAS[date.getDay()]}, ${date.getDate()} ${MESES[date.getMonth()]}`;
}

function formatLastSeen(date: Date) {
  const minutes = (Date.now() - date.getTime()) / 60000;
  if (minutes < 1) return 'visto agora';
  if (minutes < 60) return `visto há ${Math.max(1, Math.floor(minutes))} min`;
  if (minutes < 1440) return `visto hoje às ${formatHM(date)}`;
  const days = Math.floor(minutes / 1440);
  return `visto há ${days} dia${days > 1 ? 's' : ''}`;
}

// Síntese de áudio leve e agradável (Web Audio API)
function playBeepSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.21);
  } catch (err) {
    console.warn('Erro ao reproduzir som de notificação:', err);
  }
}

export function OnlineUsers() {
  const router = useRouter();
  const { user, userData } = useFirebase();

  // Estados principais
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<MainTab>('ch');
  const [activeChat, setActiveChat] = useState<ActiveChat>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mutedChannels, setMutedChannels] = useState<string[]>([]);
  const [isBumping, setIsBumping] = useState(false);

  // Não lidas por canal e por usuário
  const [unreadDirectCounts, setUnreadDirectCounts] = useState<Record<string, number>>({});
  const [lastChannelMessages, setLastChannelMessages] = useState<Record<string, ChatMessage>>({});
  const [lastDirectMessages, setLastDirectMessages] = useState<Record<string, ChatMessage>>({});

  // Menções com @
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSelectionIndex, setMentionSelectionIndex] = useState(0);
  const [showMentionPicker, setShowMentionPicker] = useState(false);

  // Confirmação para apagar mensagem
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<ChatMessage | null>(null);

  // Refs
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const firstUnreadIndexRef = useRef<number>(-1);

  // Carregar preferências salvas no localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedTab = localStorage.getItem('cc_tab');
      if (savedTab === 'ch' || savedTab === 'dm') setTab(savedTab);

      const savedSound = localStorage.getItem('cc_sound');
      if (savedSound !== null) setSoundEnabled(savedSound === '1');

      const savedMuted = localStorage.getItem('cc_muted_channels');
      if (savedMuted) setMutedChannels(JSON.parse(savedMuted));
    } catch (e) {
      console.warn('Erro ao carregar preferências do localStorage:', e);
    }
  }, []);

  // Presença do usuário no Firestore
  useEffect(() => {
    if (!user) return;
    let isActive = true;

    const updatePresence = async () => {
      if (!isActive) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(
          userRef,
          {
            lastActive: serverTimestamp(),
            isOnline: true,
            name: userData?.name || user.displayName || user.email?.split('@')[0] || 'Usuário',
            email: user.email || '',
            role: userData?.role || 'Operador'
          },
          { merge: true }
        );
      } catch (error) {
        console.error('Erro ao registrar presença no chat:', error);
      }
    };

    updatePresence();
    const interval = setInterval(() => {
      if (isActive) updatePresence();
    }, 45000);

    const handleVisibility = () => {
      if (!document.hidden && isActive) {
        updatePresence();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isActive = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      try {
        const userRef = doc(db, 'users', user.uid);
        setDoc(userRef, { isOnline: false }, { merge: true }).catch(console.error);
      } catch (e) {}
    };
  }, [user, userData]);

  // Carregar lista de usuários cadastrados
  useEffect(() => {
    if (!user) return;
    let isSubscribed = true;

    const fetchUsers = async () => {
      if (!isSubscribed) return;
      try {
        const usersQuery = query(collection(db, 'users'));
        const snapshot = await getDocs(usersQuery);
        const loaded: UserContact[] = [];
        const now = Date.now();
        const twoMinutesAgo = new Date(now - 2 * 60 * 1000);
        const tenMinutesAgo = new Date(now - 10 * 60 * 1000);

        snapshot.forEach((docSnap) => {
          if (docSnap.id === user.uid) return;
          const d = docSnap.data();
          let lastActive: Date;
          if (d.lastActive?.toDate) {
            lastActive = d.lastActive.toDate();
          } else if (d.lastActive instanceof Date) {
            lastActive = d.lastActive;
          } else {
            lastActive = new Date(0);
          }

          const isOnline = d.isOnline === true && lastActive > twoMinutesAgo;
          const isAway = !isOnline && d.isOnline === true && lastActive > tenMinutesAgo;

          loaded.push({
            id: docSnap.id,
            name: d.name || d.email?.split('@')[0] || 'Colaborador',
            email: d.email || '',
            role: d.role || 'Operador',
            lastActive,
            isOnline,
            isAway
          });
        });

        // Ordenar: Online primeiro, depois Away, depois alfabético
        loaded.sort((a, b) => {
          if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
          if (a.isAway !== b.isAway) return a.isAway ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        if (isSubscribed) setContacts(loaded);
      } catch (err) {
        console.error('Erro ao buscar contatos:', err);
      }
    };

    fetchUsers();
    const interval = setInterval(fetchUsers, 20000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [user]);

  // Monitorar DMs não lidas
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
        setUnreadDirectCounts(counts);
      },
      (error) => console.error('Erro ao monitorar não lidas:', error)
    );

    return () => unsubscribe();
  }, [user]);

  // Monitorar mensagens da conversa ativa
  useEffect(() => {
    if (!user || !activeChat) {
      setMessages([]);
      firstUnreadIndexRef.current = -1;
      return;
    }

    let messagesQuery;

    if (activeChat.type === 'ch') {
      messagesQuery = query(
        collection(db, 'chat_messages'),
        where('channelId', '==', activeChat.channel.id),
        limit(120)
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
        limit(120)
      );
    }

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const loaded: ChatMessage[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loaded.push({
            id: docSnap.id,
            senderId: data.senderId || data.userId,
            senderName: data.senderName || 'Colaborador',
            receiverId: data.receiverId,
            receiverName: data.receiverName,
            channelId: data.channelId,
            message: data.message || '',
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
            read: data.read ?? true,
            mentions: data.mentions || [],
            isSystem: data.isSystem,
            meta: data.meta
          });
        });

        const sorted = loaded.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Identificar primeira mensagem não lida
        if (activeChat.type === 'dm') {
          const firstUnread = sorted.findIndex(m => !m.read && m.senderId === activeChat.user.id);
          firstUnreadIndexRef.current = firstUnread;
        }

        // Tocar som e bump quando nova mensagem chega de outro usuário
        if (lastMessageCountRef.current > 0 && sorted.length > lastMessageCountRef.current) {
          const lastMsg = sorted[sorted.length - 1];
          if (lastMsg.senderId !== user.uid) {
            const isMuted = activeChat.type === 'ch' && mutedChannels.includes(activeChat.channel.id);
            if (!isMuted && soundEnabled) {
              playBeepSound();
            }
            setIsBumping(true);
            setTimeout(() => setIsBumping(false), 500);
          }
        }

        lastMessageCountRef.current = sorted.length;
        setMessages(sorted);

        // Marcar mensagens recebidas como lidas
        if (activeChat.type === 'dm') {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (!data.read && data.receiverId === user.uid) {
              updateDoc(firestoreDoc(db, 'private_messages', docSnap.id), { read: true })
                .catch(err => console.error('Erro ao marcar DM como lida:', err));
            }
          });
        }
      },
      (err) => console.error('Erro no listener de mensagens:', err)
    );

    return () => unsubscribe();
  }, [user, activeChat, soundEnabled, mutedChannels]);

  // Monitorar últimas mensagens de cada canal para a lista de visualização
  useEffect(() => {
    if (!user) return;

    const unsubs = CHANNELS.map((ch) => {
      const q = query(
        collection(db, 'chat_messages'),
        where('channelId', '==', ch.id),
        limit(1)
      );
      return onSnapshot(q, (snapshot) => {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const msgObj: ChatMessage = {
            id: docSnap.id,
            senderId: data.senderId || data.userId,
            senderName: data.senderName || 'Colaborador',
            channelId: data.channelId,
            message: data.message || '',
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
            read: true
          };
          setLastChannelMessages((prev) => ({ ...prev, [ch.id]: msgObj }));
        });
      });
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [user]);

  // Auto-scroll para a primeira nova mensagem ou para o fim
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const newSeparator = container.querySelector('[data-new-sep="true"]') as HTMLElement;
    if (newSeparator) {
      container.scrollTop = newSeparator.offsetTop - 60;
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Atalhos de teclado globais (M/m abre/fecha, Esc fecha ou volta)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.key === 'Escape') {
        if (showMentionPicker) {
          setShowMentionPicker(false);
          return;
        }
        if (activeChat) {
          setActiveChat(null);
          return;
        }
        if (isOpen) {
          setIsOpen(false);
          return;
        }
      }

      if (!isInput && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, activeChat, showMentionPicker]);

  // Fechar ao clicar fora do painel
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

  // Salvar rascunho da conversa ativa
  useEffect(() => {
    if (!activeChat) return;
    const key = `cc_draft_${activeChat.type === 'ch' ? activeChat.channel.id : activeChat.user.id}`;
    const savedDraft = localStorage.getItem(key) || '';
    setInputMessage(savedDraft);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(120, textareaRef.current.scrollHeight)}px`;
        textareaRef.current.focus();
      }
    }, 60);
  }, [activeChat]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputMessage(val);

    // Ajuste de altura automático
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(120, target.scrollHeight)}px`;

    // Salvar rascunho
    if (activeChat) {
      const key = `cc_draft_${activeChat.type === 'ch' ? activeChat.channel.id : activeChat.user.id}`;
      localStorage.setItem(key, val);
    }

    // Detecção de menção (@)
    const cursor = target.selectionStart || val.length;
    const textBefore = val.substring(0, cursor);
    const lastAt = textBefore.lastIndexOf('@');

    if (lastAt !== -1) {
      const textAfterAt = textBefore.substring(lastAt + 1);
      if (!/\s/.test(textAfterAt)) {
        setMentionQuery(textAfterAt.toLowerCase());
        setMentionSelectionIndex(0);
        setShowMentionPicker(true);
        return;
      }
    }

    setShowMentionPicker(false);
    setMentionQuery(null);
  };

  // Sugestões de menção
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const special = [
      { id: 'todos', name: 'todos', role: 'Notificar todos no canal', isSpecial: true },
      { id: 'geral', name: 'geral', role: 'Notificar todos no canal', isSpecial: true }
    ];
    const userMatches = contacts.map(c => ({
      id: c.id,
      name: c.name,
      role: '',
      isSpecial: false
    }));
    const combined = [...special, ...userMatches];
    if (!mentionQuery) return combined.slice(0, 6);
    return combined.filter(item => item.name.toLowerCase().includes(mentionQuery)).slice(0, 6);
  }, [mentionQuery, contacts]);

  const pickMention = (name: string) => {
    if (!textareaRef.current) return;
    const val = inputMessage;
    const cursor = textareaRef.current.selectionStart || val.length;
    const textBefore = val.substring(0, cursor);
    const textAfter = val.substring(cursor);
    const lastAt = textBefore.lastIndexOf('@');

    if (lastAt !== -1) {
      const firstName = name.split(' ')[0];
      const newBefore = textBefore.substring(0, lastAt) + `@${firstName} `;
      setInputMessage(newBefore + textAfter);
      const newPos = newBefore.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newPos, newPos);
          textareaRef.current.focus();
        }
      }, 10);
    }
    setShowMentionPicker(false);
    setMentionQuery(null);
  };

  // Envio de Mensagem
  const handleSendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || !user || !activeChat || isSending) return;

    setIsSending(true);
    setInputMessage('');
    setShowMentionPicker(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (activeChat) {
      const key = `cc_draft_${activeChat.type === 'ch' ? activeChat.channel.id : activeChat.user.id}`;
      localStorage.removeItem(key);
    }

    try {
      const senderName = userData?.name || user.displayName || user.email?.split('@')[0] || 'Usuário';

      // Detectar menções para criar notificações no Firestore
      const targetUserIds = new Set<string>();
      const lower = text.toLowerCase();

      if (lower.includes('@todos') || lower.includes('@geral')) {
        contacts.forEach(c => {
          if (c.id !== user.uid) targetUserIds.add(c.id);
        });
      } else {
        contacts.forEach(c => {
          if (c.id !== user.uid) {
            const firstName = `@${c.name.split(' ')[0].toLowerCase()}`;
            if (lower.includes(firstName)) targetUserIds.add(c.id);
          }
        });
      }

      const targetIdsArray = Array.from(targetUserIds);

      if (activeChat.type === 'ch') {
        await addDoc(collection(db, 'chat_messages'), {
          channelId: activeChat.channel.id,
          userId: user.uid,
          senderId: user.uid,
          senderName,
          message: text.slice(0, 1000),
          mentions: targetIdsArray,
          timestamp: serverTimestamp(),
          createdAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'private_messages'), {
          senderId: user.uid,
          senderName,
          receiverId: activeChat.user.id,
          receiverName: activeChat.user.name,
          message: text.slice(0, 1000),
          mentions: targetIdsArray,
          timestamp: serverTimestamp(),
          createdAt: new Date().toISOString(),
          read: false
        });
      }

      // Criar notificações para menções
      for (const targetId of targetIdsArray) {
        addDoc(collection(db, 'notifications'), {
          user_id: targetId,
          title: activeChat.type === 'ch' ? `Mencionado em #${activeChat.channel.name}` : `Mencionado por ${senderName}`,
          message: `${senderName}: ${text}`,
          sender_id: user.uid,
          sender_name: senderName,
          chat_type: activeChat.type,
          channel_id: activeChat.type === 'ch' ? activeChat.channel.id : null,
          created_at: serverTimestamp(),
          createdAt: new Date().toISOString(),
          read: false,
          type: 'chat_mention'
        }).catch(console.error);
      }

      if (soundEnabled) {
        playBeepSound();
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      toast.error('Falha ao enviar mensagem.');
      setInputMessage(text);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  // Excluir mensagem individual
  const handleDeleteMessage = async (msgId: string) => {
    if (!user || !activeChat) return;
    try {
      const colName = activeChat.type === 'ch' ? 'chat_messages' : 'private_messages';
      await deleteDoc(doc(db, colName, msgId));
      toast.success('Mensagem excluída.');
      setDeleteConfirmMsg(null);
    } catch (err) {
      console.error('Erro ao excluir mensagem:', err);
      toast.error('Não foi possível excluir.');
    }
  };

  // Excluir todas as minhas mensagens nesta conversa
  const handleClearMyMessages = async () => {
    if (!user || !activeChat || messages.length === 0) return;
    const myMessages = messages.filter(m => m.senderId === user.uid);
    if (myMessages.length === 0) {
      toast.error('Você não tem mensagens nesta conversa.');
      return;
    }
    if (!confirm(`Deseja excluir suas ${myMessages.length} mensagens desta conversa?`)) return;

    try {
      const colName = activeChat.type === 'ch' ? 'chat_messages' : 'private_messages';
      await Promise.all(myMessages.map(m => deleteDoc(doc(db, colName, m.id))));
      toast.success(`${myMessages.length} mensagens excluídas.`);
    } catch (err) {
      console.error('Erro ao limpar mensagens:', err);
      toast.error('Erro ao excluir mensagens.');
    }
  };

  // Alternar silenciamento do canal
  const toggleMuteChannel = (channelId: string) => {
    setMutedChannels(prev => {
      const isMuted = prev.includes(channelId);
      const next = isMuted ? prev.filter(id => id !== channelId) : [...prev, channelId];
      localStorage.setItem('cc_muted_channels', JSON.stringify(next));
      toast(isMuted ? 'Notificações reativadas' : 'Canal silenciado');
      return next;
    });
  };

  // Alternar som geral
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('cc_sound', next ? '1' : '0');
      toast(next ? 'Som das mensagens ativado' : 'Som das mensagens desativado');
      return next;
    });
  };

  // Resumo inteligente do turno para inserção rápida
  const getShiftSummaryText = () => {
    const active = getCurrentActiveShift();
    const shiftLabel = active ? active.label : 'Turno Operacional';
    const phase = active ? getShiftPhase(active.n) : null;
    const pct = phase?.el ? Math.round(phase.el * 100) : 0;
    return `${shiftLabel}: acompanhamento ativo · ${pct}% do turno decorrido`;
  };

  // Formatação rica de conteúdo de mensagem (NTs clicáveis e Menções)
  const renderFormattedBody = (rawText: string, isMine: boolean) => {
    const currentUserName = (userData?.name || user?.displayName || '').split(' ')[0];
    const ntPattern = /\b(NT\s?)?(\d{6}|\d{10})\b/gi;
    const atPattern = /@([A-ZÀ-Úa-zà-ú0-9._-]+)/g;
    const combined = new RegExp(`(\\b(?:NT\\s?)?(?:\\d{6}|\\d{10})\\b)|(@[A-ZÀ-Úa-zà-ú0-9._-]+)`, 'gi');

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = combined.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(rawText.substring(lastIndex, match.index));
      }

      const matchedString = match[0];

      if (matchedString.startsWith('@')) {
        const mentionTarget = matchedString.substring(1);
        const isSelf = currentUserName && mentionTarget.toLowerCase() === currentUserName.toLowerCase();

        parts.push(
          <span
            key={match.index}
            className={cn(
              "font-semibold rounded px-1 py-0.5 text-xs transition-colors",
              isSelf
                ? "bg-[var(--accent-weak)] text-[var(--accent)] border border-[var(--accent)]/30 font-bold"
                : "text-[var(--accent)]"
            )}
          >
            {matchedString}
          </span>
        );
      } else {
        // Código de NT / Material
        const codeOnly = matchedString.replace(/^NT\s?/i, '');
        parts.push(
          <button
            key={match.index}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(codeOnly);
              toast.success(`NT ${codeOnly} copiada!`, { icon: '📋' });
            }}
            title="Copiar código da NT"
            className="inline-flex items-center font-mono text-[11.5px] px-1 py-0.2 mx-0.5 rounded border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            {codeOnly}
          </button>
        );
      }

      lastIndex = match.index + matchedString.length;
    }

    if (lastIndex < rawText.length) {
      parts.push(rawText.substring(lastIndex));
    }

    return parts.length > 0 ? parts : rawText;
  };

  // Contagens e contatos filtrados
  const onlineContacts = contacts.filter(c => c.isOnline);
  const totalDirectUnread = Object.values(unreadDirectCounts).reduce((a, b) => a + b, 0);
  const onlineAvatars = onlineContacts.slice(0, 3);

  const filteredChannels = CHANNELS.filter(ch => 
    !searchQuery ||
    ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ch.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter(c =>
    !searchQuery ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentContacts = filteredContacts.filter(c => lastDirectMessages[c.id] || unreadDirectCounts[c.id]);
  const onlineOnlyContacts = filteredContacts.filter(c => c.isOnline && !recentContacts.includes(c));
  const offlineContacts = filteredContacts.filter(c => !c.isOnline && !recentContacts.includes(c));

  if (!user) return null;

  return (
    <div className="relative inline-block select-none">
      {/* Botão de Gatilho na Topbar (.who-btn) */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          "h-[30px] px-2 py-0 rounded-[6px] flex items-center gap-2 text-xs text-[var(--text-3)] hover:bg-[var(--hover)] hover:text-[var(--text)] transition-all cursor-pointer relative",
          isOpen && "bg-[var(--hover)] text-[var(--text)]"
        )}
        title="Mensagens (Atalho M)"
      >
        {/* Pilha de Avatares Sobrepostos */}
        <div className="flex items-center">
          {onlineAvatars.length > 0 ? (
            onlineAvatars.map((contact, index) => (
              <span
                key={contact.id}
                style={{ marginLeft: index === 0 ? 0 : -6 }}
                className="w-[22px] h-[22px] rounded-full border-2 border-[var(--surface)] bg-[#2a3038] dark:bg-[#2a3038] text-[#c9ced6] grid place-items-center text-[9px] font-semibold"
                title={contact.name}
              >
                {getInitials(contact.name)}
              </span>
            ))
          ) : (
            <span className="w-[22px] h-[22px] rounded-full border-2 border-[var(--surface)] bg-[var(--surface-2)] text-[var(--text-3)] grid place-items-center text-[9px] font-semibold">
              #
            </span>
          )}
        </div>

        <span className="text-xs font-medium text-[var(--text-2)]">
          {onlineContacts.length} online
        </span>

        {/* Badge de Mensagens Não Lidas */}
        {totalDirectUnread > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1.5 min-w-[15px] h-[15px] px-[3px] rounded-[8px] bg-[var(--red)] text-white text-[9.5px] font-semibold grid place-items-center border-2 border-[var(--surface)] shadow-xs",
              isBumping && "animate-bump"
            )}
          >
            {totalDirectUnread > 9 ? '9+' : totalDirectUnread}
          </span>
        )}
      </button>

      {/* PAINEL CENTRAL DE COMUNICAÇÃO (.cc) */}
      {isOpen && (
        <section
          ref={panelRef}
          role="dialog"
          aria-label="Mensagens"
          className="fixed sm:absolute top-12 right-2 sm:right-0 w-[calc(100vw-16px)] sm:w-[400px] h-[min(580px,calc(100vh-60px))] flex flex-col bg-[var(--surface)] border border-[var(--border-strong)] rounded-[8px] shadow-[0_16px_40px_rgba(0,0,0,0.45)] z-50 overflow-hidden animate-fade-in"
        >
          {/* Cabeçalho do Painel Principal */}
          <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-1 shrink-0">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)] leading-tight">
                Mensagens
              </h2>
              <div className="text-xs text-[var(--text-3)] flex items-center gap-1.5 mt-0.5">
                <i className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse-dot" />
                <span>{onlineContacts.length} colaboradores online</span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                className="w-7 h-7 rounded-[6px] grid place-items-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                title={soundEnabled ? "Som ativado · clique para silenciar" : "Som desativado · clique para ativar"}
              >
                {soundEnabled ? (
                  <svg className="w-4 h-4 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                    <path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 stroke-current fill-none stroke-[1.6] text-[var(--red)]" viewBox="0 0 24 24">
                    <path d="M11 5 6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6" />
                  </svg>
                )}
              </button>

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
                setTab('ch');
                localStorage.setItem('cc_tab', 'ch');
                setSearchQuery('');
              }}
              className={cn(
                "relative px-2 py-1.5 text-[12.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                tab === 'ch'
                  ? "text-[var(--text)] after:content-[''] after:absolute after:left-1.5 after:right-1.5 after:-bottom-[1px] after:h-[2px] after:bg-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <span>Canais</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('dm');
                localStorage.setItem('cc_tab', 'dm');
                setSearchQuery('');
              }}
              className={cn(
                "relative px-2 py-1.5 text-[12.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                tab === 'dm'
                  ? "text-[var(--text)] after:content-[''] after:absolute after:left-1.5 after:right-1.5 after:-bottom-[1px] after:h-[2px] after:bg-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <span>Diretas</span>
              {totalDirectUnread > 0 && (
                <span className="font-mono text-[10.5px] text-[var(--red)] font-semibold">
                  {totalDirectUnread}
                </span>
              )}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (tab === 'ch' && filteredChannels.length > 0) {
                      setActiveChat({ type: 'ch', channel: filteredChannels[0] });
                    } else if (tab === 'dm' && filteredContacts.length > 0) {
                      setActiveChat({ type: 'dm', user: filteredContacts[0] });
                    }
                  }
                }}
                placeholder={tab === 'ch' ? 'Buscar canal' : 'Buscar colaborador'}
                className="bg-transparent border-0 outline-none text-[12.5px] text-[var(--text)] flex-1 min-w-0 placeholder:text-[var(--text-3)]"
              />
            </div>
          </div>

          {/* Lista de Canais ou Pessoas (.cc-list) */}
          <div className="flex-1 overflow-y-auto pb-2">
            {tab === 'ch' ? (
              <div>
                <div className="flex justify-between items-center px-3.5 pt-2 pb-1 text-[11px] font-medium text-[var(--text-3)]">
                  <span>Canais da fábrica</span>
                  <span>{filteredChannels.length}</span>
                </div>

                {filteredChannels.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-3)]">
                    Nenhum canal encontrado.
                  </div>
                ) : (
                  filteredChannels.map((ch) => {
                    const last = lastChannelMessages[ch.id];
                    const isMuted = mutedChannels.includes(ch.id);

                    return (
                      <div
                        key={ch.id}
                        onClick={() => setActiveChat({ type: 'ch', channel: ch })}
                        className="grid grid-cols-[30px_1fr_auto] gap-2.5 items-center px-3.5 py-2 hover:bg-[var(--hover)] transition-colors cursor-pointer group"
                      >
                        <span className="w-[30px] h-[30px] rounded-[6px] border border-[var(--border)] grid place-items-center text-[var(--text-3)] font-mono text-sm font-semibold">
                          #
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <b className="font-medium text-[var(--text)] truncate text-[13px]">
                              {ch.name}
                            </b>
                            {isMuted && (
                              <span className="text-[var(--text-3)]" title="Silenciado">
                                <svg className="w-3 h-3 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                                  <path d="M11 5 6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6" />
                                </svg>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--text-3)] truncate mt-0.5">
                            {last ? `${last.senderName.split(' ')[0]}: ${last.message}` : ch.description}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {last && (
                            <time className="font-mono text-[11px] text-[var(--text-3)]">
                              {formatTimeRelative(last.timestamp)}
                            </time>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div>
                {/* Conversas Recentes */}
                {recentContacts.length > 0 && (
                  <div>
                    <div className="px-3.5 pt-2 pb-1 text-[11px] font-medium text-[var(--text-3)]">
                      <span>Conversas recentes</span>
                    </div>
                    {recentContacts.map(c => renderContactRow(c))}
                  </div>
                )}

                {/* Online Agora */}
                {onlineOnlyContacts.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center px-3.5 pt-2 pb-1 text-[11px] font-medium text-[var(--text-3)]">
                      <span>Online agora</span>
                      <span>{onlineOnlyContacts.length}</span>
                    </div>
                    {onlineOnlyContacts.map(c => renderContactRow(c))}
                  </div>
                )}

                {/* Offline */}
                {offlineContacts.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center px-3.5 pt-2 pb-1 text-[11px] font-medium text-[var(--text-3)]">
                      <span>Offline</span>
                      <span>{offlineContacts.length}</span>
                    </div>
                    {offlineContacts.map(c => renderContactRow(c))}
                  </div>
                )}

                {filteredContacts.length === 0 && (
                  <div className="py-8 text-center text-xs text-[var(--text-3)]">
                    Nenhum colaborador encontrado com "{searchQuery}".
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PAINEL DE CONVERSA ATIVA (Slide-in .cv) */}
          <div
            className={cn(
              "absolute inset-0 bg-[var(--surface)] flex flex-col transition-transform duration-200 ease-out z-20",
              activeChat ? "translate-x-0" : "translate-x-full pointer-events-none"
            )}
          >
            {activeChat && (
              <>
                {/* Cabeçalho da Conversa (.cv-head) */}
                <div className="flex items-center gap-2.5 px-2.5 py-2 border-b border-[var(--border)] shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveChat(null)}
                    className="w-7 h-7 rounded-[6px] grid place-items-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                    title="Voltar (Esc)"
                  >
                    <svg className="w-4 h-4 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                      <path d="m15 6-6 6 6 6" />
                    </svg>
                  </button>

                  {activeChat.type === 'ch' ? (
                    <>
                      <span className="w-7 h-7 rounded-[6px] border border-[var(--border)] grid place-items-center text-[var(--text-3)] font-mono text-[13px]">
                        #
                      </span>
                      <div className="min-w-0 flex-1">
                        <b className="block font-semibold text-[13px] text-[var(--text)] truncate">
                          {activeChat.channel.name}
                        </b>
                        <small className="block text-[11.5px] text-[var(--text-3)] truncate">
                          {activeChat.channel.membersCount} membros · {activeChat.channel.description}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleMuteChannel(activeChat.channel.id)}
                        className="w-7 h-7 rounded-[6px] grid place-items-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                        title={mutedChannels.includes(activeChat.channel.id) ? "Reativar notificações" : "Silenciar canal"}
                      >
                        {mutedChannels.includes(activeChat.channel.id) ? (
                          <svg className="w-4 h-4 stroke-current fill-none stroke-[1.6] text-[var(--red)]" viewBox="0 0 24 24">
                            <path d="M11 5 6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                            <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
                          </svg>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="relative shrink-0">
                        <span className="w-[28px] h-[28px] rounded-full bg-[#2a3038] text-[#c9ced6] grid place-items-center text-[10.5px] font-semibold">
                          {getInitials(activeChat.user.name)}
                        </span>
                        <span
                          className={cn(
                            "absolute -right-0.5 -bottom-0.5 w-[9px] h-[9px] rounded-full border-2 border-[var(--surface)]",
                            activeChat.user.isOnline
                              ? "bg-[var(--green)]"
                              : activeChat.user.isAway
                              ? "bg-[var(--amber)]"
                              : "hidden"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <b className="block font-semibold text-[13px] text-[var(--text)] truncate">
                          {activeChat.user.name}
                        </b>
                        <small className="block text-[11.5px] text-[var(--text-3)] truncate">
                          {activeChat.user.isOnline ? 'online' : activeChat.user.isAway ? 'ausente' : formatLastSeen(activeChat.user.lastActive)}
                        </small>
                      </div>
                    </>
                  )}

                  {/* Limpar minhas mensagens */}
                  {messages.some(m => m.senderId === user.uid) && (
                    <button
                      type="button"
                      onClick={handleClearMyMessages}
                      className="w-7 h-7 rounded-[6px] grid place-items-center text-[var(--text-3)] hover:text-[var(--red)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                      title="Excluir minhas mensagens desta conversa"
                    >
                      <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Modal de Confirmação de Exclusão */}
                {deleteConfirmMsg && (
                  <div className="p-3 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--text-2)] truncate">
                      Excluir esta mensagem?
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmMsg(null)}
                        className="px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(deleteConfirmMsg.id)}
                        className="px-2 py-0.5 rounded bg-[var(--red)] text-white font-medium"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                )}

                {/* Mensagens (.msgs) */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto py-2">
                  {messages.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[var(--text-3)] leading-relaxed">
                      Nenhuma mensagem ainda.<br />Comece a conversa com a equipe.
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const isMine = m.senderId === user.uid;
                      const prevMsg = idx > 0 ? messages[idx - 1] : null;
                      const isCont = prevMsg && prevMsg.senderId === m.senderId && (m.timestamp.getTime() - prevMsg.timestamp.getTime()) < 5 * 60 * 1000;
                      const dayHeader = formatDayHeader(m.timestamp);
                      const prevDayHeader = prevMsg ? formatDayHeader(prevMsg.timestamp) : null;
                      const showDaySeparator = dayHeader !== prevDayHeader;
                      const isFirstUnread = idx === firstUnreadIndexRef.current;

                      return (
                        <React.Fragment key={m.id}>
                          {showDaySeparator && (
                            <div className="flex items-center gap-2.5 px-3.5 py-2 text-[11px] text-[var(--text-3)] before:content-[''] before:flex-1 before:h-[1px] before:bg-[var(--border)] after:content-[''] after:flex-1 after:h-[1px] after:bg-[var(--border)]">
                              {dayHeader}
                            </div>
                          )}

                          {isFirstUnread && (
                            <div
                              data-new-sep="true"
                              className="flex items-center gap-2.5 px-3.5 py-1 text-[11px] font-medium text-[var(--red)] after:content-[''] after:flex-1 after:h-[1px] after:bg-[var(--red)] after:opacity-50"
                            >
                              Novas
                            </div>
                          )}

                          {m.isSystem ? (
                            <div className="grid grid-cols-[26px_1fr] gap-2.5 px-3.5 py-1.5">
                              <span className="w-[26px] grid place-items-center text-[var(--text-3)]">
                                <i className="w-[7px] h-[7px] rounded-full bg-[var(--text-3)]" />
                              </span>
                              <div className="border border-[var(--border)] rounded-[6px] p-2 bg-[var(--surface-2)] text-[12.5px] leading-snug text-[var(--text)]">
                                <div>{m.message}</div>
                                <small className="block text-[11px] text-[var(--text-3)] mt-1 font-mono">
                                  {m.meta || 'Sistema'} · {formatHM(m.timestamp)}
                                </small>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "grid grid-cols-[26px_1fr] gap-2.5 px-3.5 py-1 hover:bg-[var(--surface-2)] transition-colors group relative",
                                isCont && "pt-0"
                              )}
                            >
                              {/* Avatar */}
                              <span
                                className={cn(
                                  "w-[26px] h-[26px] rounded-full bg-[#2a3038] text-[#c9ced6] grid place-items-center text-[10px] font-semibold shrink-0 select-none",
                                  isCont && "invisible h-0"
                                )}
                              >
                                {getInitials(m.senderName)}
                              </span>

                              <div className="min-w-0">
                                {!isCont && (
                                  <div className="flex items-baseline gap-2">
                                    <b className="font-semibold text-[12.5px] text-[var(--text)]">
                                      {isMine ? 'Você' : m.senderName}
                                    </b>
                                    <time className="font-mono text-[10.5px] text-[var(--text-3)]">
                                      {formatHM(m.timestamp)}
                                    </time>
                                  </div>
                                )}

                                <div className="text-[13px] leading-relaxed text-[var(--text)] break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                                  {renderFormattedBody(m.message, isMine)}
                                </div>
                              </div>

                              {/* Ações ao passar o mouse */}
                              <div className="absolute right-3 top-1 hidden group-hover:flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] p-0.5 shadow-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(m.message);
                                    toast.success('Mensagem copiada!');
                                  }}
                                  className="w-5 h-5 grid place-items-center text-[var(--text-3)] hover:text-[var(--text)]"
                                  title="Copiar texto"
                                >
                                  <svg className="w-3 h-3 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                  </svg>
                                </button>
                                {(isMine || userData?.email === ADMIN_EMAIL) && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmMsg(m)}
                                    className="w-5 h-5 grid place-items-center text-[var(--text-3)] hover:text-[var(--red)]"
                                    title="Excluir mensagem"
                                  >
                                    <svg className="w-3 h-3 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </div>

                {/* Compositor (.comp) */}
                <div className="border-t border-[var(--border)] p-2.5 pt-2 relative shrink-0">
                  {/* Popup de Menção (@) */}
                  {showMentionPicker && mentionSuggestions.length > 0 && (
                    <div className="absolute left-2.5 right-2.5 bottom-full mb-1 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[6px] shadow-[0_10px_26px_rgba(0,0,0,0.35)] py-1 max-h-[190px] overflow-y-auto z-30 animate-fade-in">
                      {mentionSuggestions.map((item, i) => (
                        <div
                          key={item.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickMention(item.name);
                          }}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-[12.5px] transition-colors",
                            i === mentionSelectionIndex
                              ? "bg-[var(--hover)] text-[var(--text)]"
                              : "text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                          )}
                        >
                          <span className="w-5 h-5 rounded-full bg-[#2a3038] text-[#c9ced6] grid place-items-center text-[9.5px] font-semibold shrink-0">
                            {item.isSpecial ? '@' : getInitials(item.name)}
                          </span>
                          <span className="font-medium text-[var(--text)]">@{item.name}</span>
                          {item.isSpecial && (
                            <small className="ml-auto text-[11px] text-[var(--text-3)] truncate max-w-[140px]">
                              {item.role}
                            </small>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Barra de Respostas Rápidas Operacionais (.quick) */}
                  <div className="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar">
                    {activeChat.type === 'ch' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const summary = getShiftSummaryText();
                            setInputMessage(prev => prev ? `${prev}\n${summary}` : summary);
                            textareaRef.current?.focus();
                          }}
                          className="h-6 px-2 border border-[var(--border-strong)] rounded-full text-[11.5px] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Resumo do turno
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInputMessage('Ciente.');
                            setTimeout(handleSendMessage, 50);
                          }}
                          className="h-6 px-2 border border-[var(--border-strong)] rounded-full text-[11.5px] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Ciente
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInputMessage(prev => prev ? `${prev} NT ` : 'NT ');
                            textareaRef.current?.focus();
                          }}
                          className="h-6 px-2 border border-[var(--border-strong)] rounded-full text-[11.5px] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Citar NT
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setInputMessage('Ciente.');
                            setTimeout(handleSendMessage, 50);
                          }}
                          className="h-6 px-2 border border-[var(--border-strong)] rounded-full text-[11.5px] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Ciente
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const summary = getShiftSummaryText();
                            setInputMessage(prev => prev ? `${prev}\n${summary}` : summary);
                            textareaRef.current?.focus();
                          }}
                          className="h-6 px-2 border border-[var(--border-strong)] rounded-full text-[11.5px] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Resumo do turno
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInputMessage('Pode vir à pesagem quando puder?');
                            textareaRef.current?.focus();
                          }}
                          className="h-6 px-2 border border-[var(--border-strong)] rounded-full text-[11.5px] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Pode vir à pesagem?
                        </button>
                      </>
                    )}
                  </div>

                  {/* Caixa de Texto (.box) */}
                  <div className="flex items-end gap-1.5 border border-[var(--border-strong)] rounded-[6px] bg-[var(--bg)] p-1.5 pl-2.5 focus-within:border-[var(--accent)] transition-colors">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={inputMessage}
                      onChange={handleTextareaChange}
                      onKeyDown={(e) => {
                        if (showMentionPicker && mentionSuggestions.length > 0) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setMentionSelectionIndex((prev) => (prev + 1) % mentionSuggestions.length);
                            return;
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setMentionSelectionIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                            return;
                          }
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            const picked = mentionSuggestions[mentionSelectionIndex];
                            if (picked) pickMention(picked.name);
                            return;
                          }
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            setShowMentionPicker(false);
                            return;
                          }
                        }

                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={
                        activeChat.type === 'ch'
                          ? `Mensagem em #${activeChat.channel.name}`
                          : `Mensagem para ${activeChat.user.name.split(' ')[0]}`
                      }
                      className="flex-1 min-h-[20px] max-h-[120px] resize-none border-0 outline-none bg-transparent leading-relaxed text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] py-0.5"
                    />

                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isSending}
                      className={cn(
                        "w-7 h-7 rounded-[5px] grid place-items-center transition-colors cursor-pointer shrink-0",
                        inputMessage.trim() && !isSending
                          ? "bg-[var(--text)] text-[var(--bg)] hover:opacity-90"
                          : "bg-[var(--border-strong)] text-[var(--text-3)] cursor-default"
                      )}
                      title="Enviar (Enter)"
                    >
                      <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>

                  {/* Dica de Atalhos (.hint) */}
                  <div className="flex justify-between items-center mt-1.5 text-[10.5px] text-[var(--text-3)] select-none">
                    <span>
                      <kbd className="font-mono text-[10px] border border-[var(--border-strong)] rounded px-1">Enter</kbd> envia · <kbd className="font-mono text-[10px] border border-[var(--border-strong)] rounded px-1">Shift+Enter</kbd> quebra linha · <kbd className="font-mono text-[10px] border border-[var(--border-strong)] rounded px-1">@</kbd> menciona
                    </span>
                    {inputMessage.length > 400 && (
                      <span className="font-mono">{inputMessage.length}/1000</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );

  // Renderizador de linha de colaborador
  function renderContactRow(c: UserContact) {
    const unread = unreadDirectCounts[c.id] || 0;
    const last = lastDirectMessages[c.id];
    const statusText = last ? `${last.senderId === user?.uid ? 'Você: ' : ''}${last.message}` : c.isOnline ? 'Online' : c.isAway ? 'Ausente' : formatLastSeen(c.lastActive);

    return (
      <div
        key={c.id}
        onClick={() => setActiveChat({ type: 'dm', user: c })}
        className={cn(
          "grid grid-cols-[30px_1fr_auto] gap-2.5 items-center px-3.5 py-2 hover:bg-[var(--hover)] transition-colors cursor-pointer group",
          unread > 0 && "font-semibold"
        )}
      >
        <div className="relative shrink-0">
          <span className="w-[30px] h-[30px] rounded-full bg-[#2a3038] text-[#c9ced6] grid place-items-center text-[11px] font-semibold">
            {getInitials(c.name)}
          </span>
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 w-[9px] h-[9px] rounded-full border-2 border-[var(--surface)]",
              c.isOnline
                ? "bg-[var(--green)]"
                : c.isAway
                ? "bg-[var(--amber)]"
                : "hidden"
            )}
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <b className={cn("font-medium text-[13px] truncate", unread > 0 ? "text-[var(--text)] font-semibold" : "text-[var(--text)]")}>
              {c.name}
            </b>
          </div>
          <div className={cn("text-xs truncate mt-0.5", unread > 0 ? "text-[var(--text-2)]" : "text-[var(--text-3)]")}>
            {statusText}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {last && (
            <time className={cn("font-mono text-[11px]", unread > 0 ? "text-[var(--text)] font-semibold" : "text-[var(--text-3)]")}>
              {formatTimeRelative(last.timestamp)}
            </time>
          )}
          {unread > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--text)] text-[var(--bg)] text-[10.5px] font-semibold grid place-items-center font-mono">
              {unread}
            </span>
          )}
        </div>
      </div>
    );
  }
}
