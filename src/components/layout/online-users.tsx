"use client";

import { useState, useEffect, useRef } from 'react';
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
  doc as firestoreDoc
} from 'firebase/firestore';
import { Users, Circle, ArrowLeft, Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface OnlineUser {
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
  receiverId: string;
  receiverName: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

type View = 'list' | 'chat';

export function OnlineUsers() {
  const { user, userData } = useFirebase();
  const { playSound } = useAudioNotification();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update user's last active timestamp
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
          isOnline: true
        }, { merge: true });
        console.log('✅ Presence updated for user:', user.uid);
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    // Update immediately
    updatePresence();

    // Update every 45 seconds (increased from 30s to reduce load)
    const interval = setInterval(() => {
      if (isActive) {
        updatePresence();
      }
    }, 45000);

    // Update on page visibility change (with debounce)
    const handleVisibilityChange = () => {
      if (!document.hidden && isActive) {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updatePresence, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set offline on unmount
    return () => {
      isActive = false;
      clearInterval(interval);
      clearTimeout(updateTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, { isOnline: false }, { merge: true }).catch(console.error);
    };
  }, [user]);

  // Listen to online users using polling instead of real-time listener
  // This avoids the FIRESTORE INTERNAL ASSERTION error
  useEffect(() => {
    if (!user) return;

    let isSubscribed = true;

    const fetchOnlineUsers = async () => {
      if (!isSubscribed) return;
      
      try {
        const usersQuery = query(collection(db, 'users'));
        const snapshot = await getDocs(usersQuery);
        
        console.log('👥 Fetching online users...', {
          totalUsers: snapshot.size,
          currentUserId: user.uid,
          now: new Date().toISOString()
        });
        
        const users: OnlineUser[] = [];
        const now = Date.now();
        const twoMinutesAgo = new Date(now - 2 * 60 * 1000);
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          
          // Handle both Timestamp and Date objects
          let lastActive: Date;
          if (data.lastActive?.toDate) {
            lastActive = data.lastActive.toDate();
          } else if (data.lastActive instanceof Date) {
            lastActive = data.lastActive;
          } else {
            lastActive = new Date(0);
          }
          
          const timeDiff = now - lastActive.getTime();
          const minutesAgo = Math.floor(timeDiff / 60000);
          
          console.log(`👤 User: ${docSnap.id}`, {
            name: data.name,
            email: data.email,
            isOnline: data.isOnline,
            lastActive: lastActive.toISOString(),
            minutesAgo,
            twoMinutesAgo: twoMinutesAgo.toISOString(),
            isRecent: lastActive > twoMinutesAgo,
            isSelf: docSnap.id === user.uid
          });
          
          // Only include users that are:
          // 1. Not the current user
          // 2. Have isOnline flag set to true
          // 3. Were active in the last 2 minutes
          if (docSnap.id !== user.uid && data.isOnline === true && lastActive > twoMinutesAgo) {
            console.log(`✅ Adding user to online list: ${data.name}`);
            users.push({
              id: docSnap.id,
              name: data.name || data.email?.split('@')[0] || 'Usuário',
              email: data.email || '',
              lastActive,
              isOnline: true
            });
          }
        });

        // Sort by last active (most recent first)
        users.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
        
        console.log(`📊 Online users count: ${users.length}`, users.map(u => ({
          name: u.name,
          lastActive: u.lastActive.toISOString()
        })));
        
        if (isSubscribed) {
          setOnlineUsers(users);
        }
      } catch (error: any) {
        console.error('❌ Error fetching online users:', error);
        
        // Show helpful message for permission errors
        if (error?.code === 'permission-denied') {
          console.error(`
🔒 FIREBASE PERMISSIONS ERROR
          
Para corrigir, vá ao Firebase Console:
1. Firestore Database > Regras
2. Adicione a regra:
   match /users/{userId} {
     allow read: if request.auth != null;
     allow write: if request.auth.uid == userId;
   }
3. Clique em Publicar
          `);
        }
        
        if (isSubscribed) {
          setOnlineUsers([]);
        }
      }
    };

    // Fetch immediately
    fetchOnlineUsers();

    // Poll every 10 seconds
    const interval = setInterval(fetchOnlineUsers, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [user]);

  // Listen to unread message counts
  useEffect(() => {
    if (!user) return;

    const unreadQuery = query(
      collection(db, 'private_messages'),
      where('receiverId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(unreadQuery, (snapshot) => {
      const counts: Record<string, number> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const senderId = data.senderId;
        counts[senderId] = (counts[senderId] || 0) + 1;
      });

      setUnreadCounts(counts);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen to messages with selected user
  useEffect(() => {
    if (!user || !selectedUser) return;

    const messagesQuery = query(
      collection(db, 'private_messages'),
      or(
        and(
          where('senderId', '==', user.uid),
          where('receiverId', '==', selectedUser.id)
        ),
        and(
          where('senderId', '==', selectedUser.id),
          where('receiverId', '==', user.uid)
        )
      )
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: ChatMessage[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          receiverId: data.receiverId,
          receiverName: data.receiverName,
          message: data.message,
          timestamp: data.timestamp?.toDate() || new Date(),
          read: data.read || false
        });
      });

      const sortedMessages = msgs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Play sound for new incoming messages
      if (lastMessageCountRef.current > 0 && sortedMessages.length > lastMessageCountRef.current) {
        const lastMessage = sortedMessages[sortedMessages.length - 1];
        if (lastMessage.senderId !== user.uid) {
          playSound({ enabled: true, volume: 0.5, soundType: 'subtle' });
        }
      }
      
      lastMessageCountRef.current = sortedMessages.length;
      setMessages(sortedMessages);

      // Mark messages as read
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.read && data.receiverId === user.uid) {
          updateDoc(firestoreDoc(db, 'private_messages', doc.id), { read: true })
            .catch(error => console.error('Error marking as read:', error));
        }
      });
    });

    return () => unsubscribe();
  }, [user, selectedUser, playSound]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!user) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user || !userData || !selectedUser) return;

    setIsSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');
    
    try {
      await addDoc(collection(db, 'private_messages'), {
        senderId: user.uid,
        senderName: userData.name || user.email?.split('@')[0] || 'Usuário',
        receiverId: selectedUser.id,
        receiverName: selectedUser.name,
        message: messageText,
        timestamp: serverTimestamp(),
        createdAt: new Date(),
        read: false
      });

      playSound({ enabled: true, volume: 0.3, soundType: 'subtle' });
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText);
    } finally {
      setIsSending(false);
      // Manter foco no input após enviar
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  };

  const handleSelectUser = (user: OnlineUser) => {
    setSelectedUser(user);
    setView('chat');
    lastMessageCountRef.current = 0;
  };

  const handleBack = () => {
    setSelectedUser(null);
    setView('list');
    lastMessageCountRef.current = 0;
  };

  // Highlight lotes (ex: M4R5767) e códigos (ex: 010311)
  const highlightText = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    const combinedPattern = /([A-Z]\d[A-Z]\d{4})|(\b\d{6}\b)/g;
    
    let match;
    while ((match = combinedPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const matchedText = match[0];
      const isLote = /[A-Z]\d[A-Z]\d{4}/.test(matchedText);
      
      parts.push(
        <span
          key={match.index}
          className={`px-1.5 py-0.5 rounded font-bold ${
            isLote
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
          }`}
        >
          {matchedText}
        </span>
      );

      lastIndex = match.index + matchedText.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'agora';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Get initials from name
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Generate a consistent color based on user ID
  const getColorFromId = (id: string) => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-purple-500 to-pink-600',
      'from-green-500 to-emerald-600',
      'from-amber-500 to-orange-600',
      'from-red-500 to-rose-600',
      'from-cyan-500 to-blue-600',
      'from-violet-500 to-purple-600',
      'from-lime-500 to-green-600',
    ];
    
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const displayedUsers = onlineUsers.slice(0, 4);
  const remainingCount = onlineUsers.length - displayedUsers.length;
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen && view === 'chat') {
        setView('list');
        setSelectedUser(null);
      }
    }}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center gap-0 hover:opacity-80 transition-opacity"
          title={`${onlineUsers.length} usuário(s) online`}
        >
          {/* Cascata de avatares */}
          <div className="flex items-center -space-x-2">
            {displayedUsers.map((onlineUser, index) => (
              <div
                key={onlineUser.id}
                className={`relative w-9 h-9 rounded-full bg-gradient-to-br ${getColorFromId(onlineUser.id)} flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-lg transition-transform hover:scale-110 hover:z-10`}
                style={{
                  zIndex: displayedUsers.length - index,
                  animation: `fadeInScale 0.3s ease-out ${index * 0.1}s both`
                }}
              >
                <span className="text-xs font-bold text-white drop-shadow-md">
                  {getInitials(onlineUser.name)}
                </span>
                
                {/* Indicador online */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse" />
              </div>
            ))}
            
            {remainingCount > 0 && (
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-lg">
                <span className="text-xs font-bold text-white">
                  +{remainingCount}
                </span>
              </div>
            )}
          </div>

          {/* Ícone de usuários (visível quando não há usuários online) */}
          {onlineUsers.length === 0 && (
            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
          )}
          
          {/* Badge de mensagens não lidas */}
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold animate-pulse border-2 border-white dark:border-gray-800 z-50">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent 
        className="w-[400px] p-0 border-0 shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Header com gradiente */}
        <div className="relative p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="relative flex items-center gap-3">
            {view === 'chat' && (
              <button
                onClick={handleBack}
                className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            )}
            
            {view === 'list' ? (
              <>
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Users className="w-5 h-5 text-white drop-shadow-lg" />
                </div>
                <div>
                  <h3 className="font-black text-white text-lg drop-shadow-lg">
                    Usuários Online
                  </h3>
                  <p className="text-xs font-bold text-white/90">
                    {onlineUsers.length} {onlineUsers.length === 1 ? 'pessoa' : 'pessoas'} ativa{onlineUsers.length === 1 ? '' : 's'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getColorFromId(selectedUser!.id)} flex items-center justify-center shadow-lg`}>
                  <span className="text-sm font-bold text-white drop-shadow-md">
                    {getInitials(selectedUser!.name)}
                  </span>
                </div>
                <div>
                  <h3 className="font-black text-white text-lg drop-shadow-lg">
                    {selectedUser!.name}
                  </h3>
                  <p className="text-xs font-bold text-white/90 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${selectedUser!.isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                    {selectedUser!.isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Lista de usuários */}
        {view === 'list' && (
          <ScrollArea className="h-[450px]">
            {onlineUsers.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                  Nenhum outro usuário online no momento
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {onlineUsers.map((onlineUser) => {
                  const unreadCount = unreadCounts[onlineUser.id] || 0;
                  
                  return (
                    <button
                      key={onlineUser.id}
                      onClick={() => handleSelectUser(onlineUser)}
                      className="w-full group p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative">
                          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getColorFromId(onlineUser.id)} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow`}>
                            <span className="text-sm font-bold text-white drop-shadow-md">
                              {getInitials(onlineUser.name)}
                            </span>
                          </div>
                          
                          {/* Indicador online */}
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-bold text-gray-900 dark:text-gray-100 truncate">
                            {onlineUser.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Circle className="w-2 h-2 text-green-500 fill-green-500 animate-pulse" />
                            <p className="text-xs font-medium text-green-600 dark:text-green-400">
                              Online agora
                            </p>
                          </div>
                        </div>
                        
                        {/* Unread count */}
                        {unreadCount > 0 && (
                          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}

        {/* Chat view */}
        {view === 'chat' && (
          <div className="flex flex-col h-[450px]">
            <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-900">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                      Nenhuma mensagem ainda
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Envie a primeira mensagem!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isOwnMessage = msg.senderId === user.uid;
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            isOwnMessage
                              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          <p className="text-sm break-words leading-relaxed">
                            {highlightText(msg.message)}
                          </p>
                          <p className={`text-xs mt-1 ${
                            isOwnMessage ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  disabled={isSending}
                  className="flex-1 rounded-xl border-2 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
                  maxLength={500}
                  autoFocus
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className="rounded-xl px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 relative overflow-hidden group"
                >
                  {isSending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Use <span className="font-bold text-blue-600 dark:text-blue-400">M4R5767</span> para lotes ou <span className="font-bold text-purple-600 dark:text-purple-400">010311</span> para códigos
              </p>
            </form>
          </div>
        )}
      </PopoverContent>

      {/* Animação CSS */}
      <style jsx>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </Popover>
  );
}
