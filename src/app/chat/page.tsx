'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomAuth } from '../utils/customAuth';
import { BankQueryService } from '../utils/bankQueryService';
import LoadingScreen from '../components/LoadingScreen';
import styles from './page.module.css';
import { BankCustomer } from '../types/bankTypes';
import { collection, query, where, orderBy, onSnapshot, Timestamp, FirestoreError } from 'firebase/firestore';
import { db } from '../utils/initFirebase';
import { FiEdit2, FiTrash2, FiCheck, FiX, FiPlus, FiMessageSquare, FiSend } from 'react-icons/fi';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Timestamp;
  userId: string;
  companyId: string;
}

interface ChatHistory {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageTimestamp: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  companyId: string;
}

export default function ChatPage() {
  const router = useRouter();
  const { user, loading, error: authError } = useCustomAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [bankQueryService, setBankQueryService] = useState<BankQueryService | null>(null);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInitializedRef = useRef(false);
  const initialMessageSentRef = useRef(false);
  const messageCache = useRef(new Set<string>());

  // Scroll to bottom whenever messages change
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingUserMessage, isProcessing]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Initialize BankQueryService
  useEffect(() => {
    if (user && !bankQueryService) {
      const bankCustomer = user as unknown as BankCustomer;
      setBankQueryService(new BankQueryService(bankCustomer.companyId, bankCustomer.email));
    }
  }, [user, bankQueryService]);

  // Load chat history
  useEffect(() => {
    if (!user || !bankQueryService) return;

    const bankCustomer = user as unknown as BankCustomer;
    const historyQuery = query(
      collection(db, 'chatHistory'),
      where('userId', '==', bankCustomer.email),
      where('companyId', '==', bankCustomer.companyId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(historyQuery, 
      async (snapshot) => {
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ChatHistory));
        setChatHistory(history);
        setIsIndexBuilding(false);

        // Create new chat only if no history exists and we haven't initialized yet
        if (history.length === 0 && !chatInitializedRef.current && bankQueryService) {
          chatInitializedRef.current = true;
          const newChatId = await createNewChat();
          if (newChatId && !initialMessageSentRef.current) {
            initialMessageSentRef.current = true;
            await bankQueryService.storeAIResponse(newChatId, "Hello! I'm your banking assistant. How can I help you today?");
          }
        } else if (history.length > 0 && !currentChatId) {
          setCurrentChatId(history[0].id);
        }
      },
      (error) => {
        console.error('Error loading chat history:', error);
        if (error instanceof FirestoreError && error.code === 'failed-precondition') {
          setIsIndexBuilding(true);
          setError('Chat history is being prepared. This may take a few moments...');
        } else {
          setError('Failed to load chat history. Please try refreshing the page.');
        }
      }
    );

    return () => unsubscribe();
  }, [user, bankQueryService]);

  // Load messages for current chat
  useEffect(() => {
    if (!currentChatId || !user) return;

    setMessages([]); // Clear messages when changing chats
    messageCache.current.clear(); // Clear message cache
    
    const messagesQuery = query(
      collection(db, 'messages'),
      where('chatId', '==', currentChatId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, 
      (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Message));
        
        // Filter out duplicate messages using the cache
        const uniqueMsgs = msgs.filter(msg => {
          const messageKey = `${msg.id}-${msg.content}`;
          if (messageCache.current.has(messageKey)) {
            return false;
          }
          messageCache.current.add(messageKey);
          return true;
        });

        // Sort messages by timestamp
        const sortedMsgs = uniqueMsgs.sort((a, b) => {
          return a.timestamp.seconds - b.timestamp.seconds || 
                 a.timestamp.nanoseconds - b.timestamp.nanoseconds;
        });
        
        setMessages(prevMessages => {
          // Merge new messages with existing ones, maintaining order
          const allMessages = [...prevMessages];
          sortedMsgs.forEach(msg => {
            if (!allMessages.some(m => m.id === msg.id)) {
              allMessages.push(msg);
              // If we receive an AI message and it matches our pending user message context,
              // clear the processing state
              if (!msg.isUser && pendingUserMessage) {
                setIsProcessing(false);
                setPendingUserMessage(null);
              }
            }
          });
          return allMessages.sort((a, b) => 
            a.timestamp.seconds - b.timestamp.seconds || 
            a.timestamp.nanoseconds - b.timestamp.nanoseconds
          );
        });
        scrollToBottom();
      },
      (error) => {
        console.error('Error loading messages:', error);
        setError('Failed to load messages. Please try refreshing the page.');
        setIsProcessing(false);
        setPendingUserMessage(null);
      }
    );

    return () => {
      unsubscribe();
      messageCache.current.clear();
      setIsProcessing(false);
      setPendingUserMessage(null);
    };
  }, [currentChatId, user, pendingUserMessage]);

  const createNewChat = async () => {
    if (!bankQueryService) return null;

    try {
      const newChatId = await bankQueryService.createNewChat();
      setCurrentChatId(newChatId);
      setMessages([]);
      setError(null);
      return newChatId;
    } catch (err) {
      console.error('Error creating new chat:', err);
      setError('Failed to create new chat');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isProcessing || !user || !currentChatId || !bankQueryService) {
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsProcessing(true);
    setError(null);
    setPendingUserMessage(userMessage);

    try {
      await bankQueryService.processQuery(userMessage, currentChatId);
    } catch (err) {
      console.error('Error processing query:', err);
      setError('Failed to process your query. Please try again.');
      setIsProcessing(false);
      setPendingUserMessage(null);
    }
  };

  const handleRenameChat = async (chatId: string) => {
    if (!bankQueryService || !newChatTitle.trim()) return;

    try {
      await bankQueryService.renameChat(chatId, newChatTitle.trim());
      setEditingChatId(null);
      setNewChatTitle('');
    } catch (err) {
      console.error('Error renaming chat:', err);
      setError('Failed to rename chat');
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!bankQueryService || isDeleting) return;

    const confirmDelete = window.confirm('Are you sure you want to delete this chat? This action cannot be undone.');
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await bankQueryService.deleteChat(chatId);
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error deleting chat:', err);
      setError('Failed to delete chat');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderMessages = () => {
    return (
      <div className={styles.messagesWrapper}>
        {messages.map((message) => (
          <div key={message.id} className={styles.messageContainer}>
            <div className={`${styles.messageHeader} ${message.isUser ? styles.userMessageHeader : styles.aiMessageHeader}`}>
              {message.isUser ? 'You' : 'AI Assistant'}
            </div>
            <div className={`${styles.message} ${message.isUser ? styles.userMessage : styles.aiMessage}`}>
              {message.content}
            </div>
          </div>
        ))}
        {pendingUserMessage && (
          <div className={styles.messageContainer}>
            <div className={`${styles.messageHeader} ${styles.userMessageHeader}`}>
              You
            </div>
            <div className={`${styles.message} ${styles.userMessage}`}>
              {pendingUserMessage}
            </div>
          </div>
        )}
        {isProcessing && (
          <div className={styles.messageContainer}>
            <div className={`${styles.messageHeader} ${styles.aiMessageHeader}`}>
              AI Assistant
            </div>
            <div className={styles.processingMessage}>
              <div className={styles.spinner} />
              <span className={styles.processingText}>Processing your query...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  // Add console log to debug processing state
  useEffect(() => {
    if (isProcessing) {
      console.log('Processing state active:', { pendingUserMessage, isProcessing });
    }
  }, [isProcessing, pendingUserMessage]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (authError) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Authentication error: {authError.toString()}</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  const bankCustomer = user as unknown as BankCustomer;

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.userInfo}>
          {user && (
            <>
              <div className={styles.userName}>{(user as BankCustomer).name}</div>
              <div className={styles.userEmail}>{user.email}</div>
              <div className={styles.companyId}>{(user as BankCustomer).companyId}</div>
            </>
          )}
        </div>
        
        <button 
          className={styles.newChatButton}
          onClick={createNewChat}
          disabled={isProcessing || isIndexBuilding}
        >
          <FiPlus size={18} />
          New Chat
        </button>

        <div className={styles.chatHistory}>
          {chatHistory.map((chat) => (
            <div
              key={chat.id}
              className={`${styles.chatHistoryItem} ${currentChatId === chat.id ? styles.active : ''}`}
            >
              <div 
                className={styles.chatContent}
                onClick={() => setCurrentChatId(chat.id)}
              >
                <div className={styles.chatTitle}>
                  <FiMessageSquare size={16} style={{ marginRight: '8px', opacity: 0.7 }} />
                  {editingChatId === chat.id ? (
                    <input
                      type="text"
                      value={newChatTitle}
                      onChange={(e) => setNewChatTitle(e.target.value)}
                      className={styles.chatEditInput}
                      autoFocus
                    />
                  ) : (
                    chat.title || 'New Chat'
                  )}
                </div>
                <div className={styles.chatLastMessage}>{chat.lastMessage || 'No messages yet'}</div>
                <div className={styles.chatTimestamp}>
                  {chat.lastMessageTimestamp?.toDate().toLocaleString() || 'Just now'}
                </div>
              </div>
              <button
                className={styles.deleteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChat(chat.id);
                }}
                disabled={isDeleting}
                title="Delete chat"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.chatContainer}>
        <div className={styles.messages}>
          {renderMessages()}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.inputArea}>
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              className={styles.input}
              disabled={isProcessing}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={isProcessing || !inputMessage.trim()}
            >
              {isProcessing ? 'Sending...' : <FiSend size={18} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 