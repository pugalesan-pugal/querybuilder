'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomAuth } from '../utils/customAuth';
import { BankQueryService } from '../utils/bankQueryService';
import LoadingScreen from '../components/LoadingScreen';
import styles from './page.module.css';
import { BankCustomer } from '../types/bankTypes';
import { collection, query, where, orderBy, onSnapshot, Timestamp, FirestoreError } from 'firebase/firestore';
import { db } from '../utils/initFirebase';
import { FiEdit2, FiTrash2, FiCheck, FiX } from 'react-icons/fi';

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

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Initialize BankQueryService
  useEffect(() => {
    if (user) {
      const bankCustomer = user as unknown as BankCustomer;
      console.log('Initializing BankQueryService with customer:', {
        email: bankCustomer.email,
        companyId: bankCustomer.companyId,
        name: bankCustomer.name,
        company: bankCustomer.company
      });
      setBankQueryService(new BankQueryService(bankCustomer.companyId, bankCustomer.email));
    }
  }, [user]);

  // Load chat history
  useEffect(() => {
    if (!user) return;

    const bankCustomer = user as unknown as BankCustomer;
    const historyQuery = query(
      collection(db, 'chatHistory'),
      where('userId', '==', bankCustomer.email),
      where('companyId', '==', bankCustomer.companyId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(historyQuery, 
      (snapshot) => {
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ChatHistory));
        setChatHistory(history);
        setIsIndexBuilding(false);

        // If no chat is selected and we have history, select the most recent chat
        if (!currentChatId && history.length > 0) {
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
  }, [user, currentChatId]);

  // Load messages for current chat
  useEffect(() => {
    if (!currentChatId || !user) return;

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
        setMessages(msgs);

        // Scroll to bottom
        const messagesDiv = document.querySelector(`.${styles.messages}`);
        if (messagesDiv) {
          setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
          }, 100);
        }
      },
      (error) => {
        console.error('Error loading messages:', error);
        setError('Failed to load messages. Please try refreshing the page.');
      }
    );

    return () => unsubscribe();
  }, [currentChatId, user]);

  // Create a new chat if none exists
  useEffect(() => {
    if (!bankQueryService || chatHistory.length > 0 || isIndexBuilding) return;
    
    createNewChat();
  }, [bankQueryService, chatHistory, isIndexBuilding]);

  const createNewChat = async () => {
    if (!bankQueryService) return;

    try {
      const newChatId = await bankQueryService.createNewChat();
      setCurrentChatId(newChatId);
      setMessages([]);
      setError(null);
    } catch (err) {
      console.error('Error creating new chat:', err);
      setError('Failed to create new chat');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', { inputMessage, isProcessing, user, currentChatId, bankQueryService });
    
    if (!inputMessage.trim()) {
      console.log('No input message');
      return;
    }
    if (isProcessing) {
      console.log('Already processing');
      return;
    }
    if (!user) {
      console.log('No user');
      return;
    }
    if (!currentChatId) {
      console.log('No current chat ID');
      return;
    }
    if (!bankQueryService) {
      console.log('No bank query service');
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsProcessing(true);
    setError(null);
    setPendingUserMessage(userMessage);

    try {
      console.log('Processing query:', userMessage);
      await bankQueryService.processQuery(userMessage, currentChatId);
      console.log('Query processed successfully');
    } catch (err) {
      console.error('Error processing query:', err);
      setError('Failed to process your query. Please try again.');
    } finally {
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

  if (loading) {
    return <LoadingScreen />;
  }

  if (authError) {
    return (
      <div className={styles.error}>
        Authentication error: {authError.message}
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
          New Chat
        </button>

        <div className={styles.chatHistory}>
          {chatHistory.map((chat) => (
            <div
              key={chat.id}
              className={`${styles.chatHistoryItem} ${currentChatId === chat.id ? styles.active : ''}`}
              onClick={() => setCurrentChatId(chat.id)}
            >
              <div className={styles.chatContent}>
                <div className={styles.chatTitle}>
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
            </div>
          ))}
        </div>
      </div>

      <div className={styles.chatContainer}>
        <div className={styles.messages}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.message} ${
                message.isUser ? styles.userMessage : styles.aiMessage
              }`}
            >
              <div className={styles.messageContent}>{message.content}</div>
            </div>
          ))}
          {pendingUserMessage && (
            <div className={`${styles.message} ${styles.userMessage}`}>
              <div className={styles.messageContent}>{pendingUserMessage}</div>
            </div>
          )}
          {isProcessing && (
            <div className={`${styles.message} ${styles.aiMessage}`}>
              <div className={styles.messageContent}>
                <div className={styles.typingIndicator}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.inputArea}>
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <textarea
              className={styles.input}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={isProcessing || isIndexBuilding}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={isProcessing || !inputMessage.trim() || isIndexBuilding}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 