'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../utils/auth';
import { BankQueryService } from '../utils/bankQueryService';
import LoadingScreen from '../components/LoadingScreen';
import styles from './page.module.css';
import { BankCustomer } from '../types/bankTypes';
import { collection, query, where, orderBy, onSnapshot, Timestamp, FirestoreError } from 'firebase/firestore';
import { db } from '../utils/initFirebase';

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
  const { user, loading, error: authError } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [bankQueryService, setBankQueryService] = useState<BankQueryService | null>(null);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);

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
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
      },
      (error) => {
        console.error('Error loading messages:', error);
        setError('Failed to load messages. Please try refreshing the page.');
      }
    );

    return () => unsubscribe();
  }, [currentChatId, user]);

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
    if (!inputMessage.trim() || isProcessing || !user || !currentChatId || !bankQueryService) return;

    setInputMessage('');
    setIsProcessing(true);
    setError(null);

    try {
      await bankQueryService.processQuery(inputMessage.trim(), currentChatId);
    } catch (err) {
      console.error('Error processing query:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while processing your query');
    } finally {
      setIsProcessing(false);
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
          <div className={styles.userName}>{bankCustomer.name}</div>
          <div className={styles.userEmail}>{bankCustomer.email}</div>
        </div>
        <button 
          onClick={createNewChat} 
          className={styles.newChatButton}
          disabled={isIndexBuilding}
        >
          New Chat
        </button>
        <div className={styles.chatHistory}>
          {isIndexBuilding ? (
            <div className={styles.indexBuilding}>
              <div className={styles.spinner}></div>
              <p>Preparing chat history...</p>
              <p>This may take a few moments</p>
            </div>
          ) : chatHistory.map(chat => (
            <div
              key={chat.id}
              className={`${styles.chatHistoryItem} ${currentChatId === chat.id ? styles.active : ''}`}
              onClick={() => setCurrentChatId(chat.id)}
            >
              <div className={styles.chatTitle}>
                {chat.title || 'New Chat'}
              </div>
              <div className={styles.chatLastMessage}>
                {chat.lastMessage || 'No messages yet'}
              </div>
              <div className={styles.chatTimestamp}>
                {chat.lastMessageTimestamp 
                  ? new Date(chat.lastMessageTimestamp.seconds * 1000).toLocaleString()
                  : new Date(chat.createdAt.seconds * 1000).toLocaleString()
                }
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.chatArea}>
        {currentChatId ? (
          <>
            <div className={styles.messages}>
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`${styles.message} ${message.isUser ? styles.userMessage : styles.botMessage}`}
                >
                  <div className={styles.messageContent}>{message.content}</div>
                  <div className={styles.timestamp}>
                    {new Date(message.timestamp.seconds * 1000).toLocaleString()}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className={styles.processing}>
                  Processing your query...
                </div>
              )}
              {error && (
                <div className={styles.error}>
                  {error}
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className={styles.inputArea}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your query here..."
                disabled={isProcessing || isIndexBuilding}
                className={styles.input}
              />
              <button
                type="submit"
                disabled={isProcessing || !inputMessage.trim() || isIndexBuilding}
                className={styles.button}
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className={styles.welcome}>
            <h1>Welcome to AI Query Builder</h1>
            <p>Select a chat from the sidebar or create a new one to get started.</p>
            {isIndexBuilding && (
              <p className={styles.indexBuildingNote}>
                Note: Chat history is being prepared. This may take a few moments...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 