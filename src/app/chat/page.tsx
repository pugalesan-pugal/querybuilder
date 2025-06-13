'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { initFirebase } from '../utils/initFirebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, getDocs, updateDoc, FirestoreError, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import styles from './page.module.css';
import { FiSend, FiPlus, FiLogOut, FiUser, FiTrash2, FiEdit2, FiCheck, FiX, FiDownload, FiLoader } from 'react-icons/fi';
import { RiRobot2Fill } from 'react-icons/ri';
import type { Employee } from '../types/employee';
import LoadingOverlay from '../components/LoadingOverlay';
import { GeminiChat } from '../utils/gemini';
import { HRAssistant } from '../utils/hrAssistant';
import { DataAnalytics } from '../utils/dataAnalytics';
import { QueryProcessor } from '../utils/queryProcessor';
import { FirebaseError } from 'firebase/app';
import { AuthService } from '../utils/auth';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  downloadOptions?: {
    excel: boolean;
    pdf: boolean;
  };
}

interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  userId: string;
  chatId: string;
  department?: string;
  downloadOptions?: {
    excel: boolean;
    pdf: boolean;
  };
}

interface ChatHistory {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  userId: string;
  department?: string;
  createdBy?: string;
  companyId: string;
}

const generateChatTitle = (message: string): string => {
  // Remove special characters and trim
  const cleanMessage = message.replace(/[^\w\s]/gi, ' ').trim();
  
  // Get first 5 words
  const words = cleanMessage.split(' ').slice(0, 5);
  
  // If message is too short, use default title
  if (words.length === 0) return 'New Chat';
  
  // Create title with first 5 words and ellipsis if needed
  const title = words.join(' ');
  return title.length > 30 ? title.substring(0, 30) + '...' : title;
};

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [geminiChat, setGeminiChat] = useState<GeminiChat | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [dataAnalytics, setDataAnalytics] = useState<DataAnalytics | null>(null);
  const [downloadableData, setDownloadableData] = useState<any>(null);
  const sessionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const chatHistoryUnsubscribe = useRef<(() => void) | null>(null);
  const messagesUnsubscribe = useRef<(() => void) | null>(null);
  const isInitialized = useRef(false);

  const cleanup = useCallback(() => {
    if (sessionCheckInterval.current) {
      clearInterval(sessionCheckInterval.current);
      sessionCheckInterval.current = null;
    }
    if (chatHistoryUnsubscribe.current) {
      chatHistoryUnsubscribe.current();
      chatHistoryUnsubscribe.current = null;
    }
    if (messagesUnsubscribe.current) {
      messagesUnsubscribe.current();
      messagesUnsubscribe.current = null;
    }
  }, []);

  const redirectToLogin = useCallback(() => {
    cleanup();
    router.push('/login');
  }, [cleanup, router]);

  // Single initialization effect
  useEffect(() => {
    const initializeChat = async () => {
      // Prevent multiple initializations
      if (isInitialized.current) {
        console.log('Chat already initialized, skipping');
        return;
      }
      console.log('Starting chat initialization...');
      isInitialized.current = true;

      try {
        setError(null);
        setIsLoading(true);
        
        // Check user session first
        console.log('Checking user session...');
        const user = await AuthService.getCurrentUser();
        console.log('Current user:', user ? 'Found' : 'Not found');
        
        if (!user) {
          console.log('No valid user session found, redirecting to login');
          redirectToLogin();
          return;
        }

        // Verify company ID
        console.log('Verifying company ID...');
        if (!user.companyId) {
          console.error('User has no company ID');
          setError('Invalid user data. Please log in again.');
          setTimeout(redirectToLogin, 2000);
          return;
        }

        // Initialize Firebase
        console.log('Initializing Firebase...');
        const { db } = initFirebase();
        if (!db) {
          console.error('Failed to initialize Firebase');
          throw new Error('Failed to initialize Firebase');
        }

        // Verify user's company access
        console.log('Verifying company access...');
        const customerRef = doc(db, 'bank_customers', user.id);
        const customerDoc = await getDoc(customerRef);
        
        if (!customerDoc.exists()) {
          console.error('User not found in database');
          setError('User account not found. Please log in again.');
          setTimeout(redirectToLogin, 2000);
          return;
        }

        const customerData = customerDoc.data();
        if (customerData.companyId !== user.companyId) {
          console.error('Company ID mismatch', {
            expected: user.companyId,
            found: customerData.companyId
          });
          setError('Access validation failed. Please log in again.');
          setTimeout(redirectToLogin, 2000);
          return;
        }

        console.log('User verification complete, setting up chat...');
        setCurrentUser(user);
        
        // Initialize services
        try {
          console.log('Initializing chat services...');
          const gemini = new GeminiChat();
          setGeminiChat(gemini);

          const analytics = new DataAnalytics();
          setDataAnalytics(analytics);
          console.log('Chat services initialized successfully');
        } catch (serviceError) {
          console.error('Error initializing services:', serviceError);
          setError('Error initializing AI services. Some features may be limited.');
        }

        // Set up session check interval
        console.log('Setting up session check interval...');
        sessionCheckInterval.current = setInterval(async () => {
          try {
            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
              console.log('Session expired during check');
              redirectToLogin();
              return;
            }
            // Update last active timestamp
            const updatedUser = {
              ...currentUser,
              lastActive: Date.now()
            };
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          } catch (error) {
            console.error('Session check error:', error);
            redirectToLogin();
          }
        }, 30000);

        setIsLoading(false);
        console.log('Chat initialization complete');

      } catch (error) {
        console.error('Error initializing chat:', error);
        if (error instanceof Error) {
          setError(`Error initializing chat: ${error.message}`);
        } else {
          setError('Error initializing chat: Unknown error');
        }
        setTimeout(redirectToLogin, 2000);
      }
    };

    initializeChat();

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up chat resources...');
      cleanup();
    };
  }, [redirectToLogin, cleanup]);

  // Chat history effect
  useEffect(() => {
    if (!currentUser?.id || !currentUser?.companyId) {
      console.log('No current user ID or company ID, skipping chat history load');
      return;
    }

    console.log('Loading chat history for user:', currentUser.id, 'company:', currentUser.companyId);
    const { db } = initFirebase();
    
    // Load chat history for the specific company
    const loadChatHistory = async () => {
      try {
        // Verify company access again before loading chat history
        const customerRef = doc(db, 'bank_customers', currentUser.id);
        const customerDoc = await getDoc(customerRef);
        
        if (!customerDoc.exists() || customerDoc.data().companyId !== currentUser.companyId) {
          throw new Error('Company access validation failed');
        }

        const historyRef = collection(db, 'chatHistory');
        const q = query(
          historyRef,
          where('companyId', '==', currentUser.companyId),
          orderBy('timestamp', 'desc')
        );

        console.log('Setting up chat history listener');
        chatHistoryUnsubscribe.current = onSnapshot(q, 
          (snapshot) => {
            const history: ChatHistory[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              history.push({
                id: doc.id,
                title: data.title || 'New Chat',
                lastMessage: data.lastMessage || '',
                timestamp: data.timestamp?.toDate() || new Date(),
                userId: data.userId,
                companyId: data.companyId,
                department: data.department,
                createdBy: data.createdBy
              });
            });
            setChatHistory(history);
          },
          (error) => {
            console.error('Error loading chat history:', error);
            if (error instanceof FirebaseError && error.code === 'permission-denied') {
              setError('Access to chat history denied. Please log in again.');
              setTimeout(redirectToLogin, 2000);
            } else {
            setError('Error loading chat history. Please try refreshing the page.');
            }
          }
        );
      } catch (error) {
        console.error('Error setting up chat history listener:', error);
        if (error instanceof Error) {
          setError(`Error loading chat history: ${error.message}`);
        } else {
        setError('Error loading chat history. Please try refreshing the page.');
        }
        setTimeout(redirectToLogin, 2000);
      }
    };

    loadChatHistory();

    return () => {
      if (chatHistoryUnsubscribe.current) {
        chatHistoryUnsubscribe.current();
      }
    };
  }, [currentUser?.id, currentUser?.companyId, redirectToLogin]);

  useEffect(() => {
    if (!currentChatId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const { db } = initFirebase();
        const messagesRef = collection(db, 'messages');
        const q = query(
          messagesRef,
          where('chatId', '==', currentChatId),
          orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const newMessages: ChatMessage[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            newMessages.push({
              id: doc.id,
              content: data.content,
              timestamp: data.timestamp.toDate(),
              isUser: data.isUser,
              userId: data.userId,
              chatId: data.chatId,
              department: data.department,
              downloadOptions: data.downloadOptions
            });
          });
          setMessages(newMessages);
          scrollToBottom();
        });

        messagesUnsubscribe.current = unsubscribe;
        return unsubscribe;
      } catch (error) {
        console.error('Error loading messages:', error);
        setError('Error loading messages. Please try refreshing the page.');
        return undefined;
      }
    };

    loadMessages();

    return () => {
      if (messagesUnsubscribe.current) {
        messagesUnsubscribe.current();
      }
    };
  }, [currentChatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNewChat = async () => {
    if (!currentUser) {
      console.error('No current user found');
      setError('Please log in to create a new chat');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Creating new chat for user:', {
        userId: currentUser.id,
        companyId: currentUser.companyId,
        name: currentUser.name
      });

      const { db } = initFirebase();
      if (!db) {
        throw new Error('Firebase database not initialized');
      }

      // Verify user exists in bank_customers collection
      const customerRef = doc(db, 'bank_customers', currentUser.id);
      const customerDoc = await getDoc(customerRef);
      
      if (!customerDoc.exists()) {
        throw new Error('User not found in bank_customers');
      }

      const customerData = customerDoc.data();
      if (customerData.companyId !== currentUser.companyId) {
        throw new Error('Company ID mismatch');
      }

      // Create new chat document
      const chatRef = collection(db, 'chatHistory');
      const newChat = {
        title: 'New Chat',
        lastMessage: 'Welcome! How can I help you today?',
        timestamp: new Date(),
        userId: currentUser.id,
        companyId: currentUser.companyId,
        createdBy: currentUser.name
      };

      console.log('Attempting to create new chat with data:', newChat);

      const docRef = await addDoc(chatRef, newChat);
      console.log('Chat document created with ID:', docRef.id);

      // Add welcome message
      const messagesRef = collection(db, 'messages');
      const welcomeMessage = {
        content: `Hello! 👋 I'm your AI assistant for ${currentUser.companyId}. How can I help you today?`,
        timestamp: new Date(),
        isUser: false,
        userId: currentUser.id,
        chatId: docRef.id,
        companyId: currentUser.companyId
      };

      console.log('Adding welcome message:', welcomeMessage);
      
      await addDoc(messagesRef, welcomeMessage);
      console.log('Welcome message added successfully');

      // Set current chat
      setCurrentChatId(docRef.id);
      
      // Reset states
      setMessages([]);
      if (geminiChat) {
        geminiChat.clearHistory();
      }
      if (dataAnalytics) {
        dataAnalytics.clearChat();
      }

      console.log('New chat created and initialized successfully');
      
    } catch (error) {
      console.error('Detailed error creating new chat:', error);
      if (error instanceof Error) {
        setError(`Failed to create new chat: ${error.message}`);
      } else {
        setError('Failed to create new chat: Unknown error');
      }
      
      // If there's a Firebase permission error, try to refresh the page
      if (error instanceof FirebaseError && error.code === 'permission-denied') {
        setError('Session expired. Please refresh the page or log in again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChatId || !currentUser) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsTyping(true);
    setError(null);

    try {
      const { db } = initFirebase();
      const messagesRef = collection(db, 'messages');
      
      // Add user message
      const userMessage = {
        content: messageText,
        timestamp: new Date(),
        isUser: true,
        userId: currentUser.id,
        chatId: currentChatId,
        companyId: currentUser.companyId
      };

      await addDoc(messagesRef, userMessage);

      // Get current chat title
      const chatRef = doc(db, 'chatHistory', currentChatId);
      const chatDoc = await getDoc(chatRef);
      const currentTitle = chatDoc.data()?.title;

      // If this is the first user message, generate a title from it
      if (currentTitle === 'New Chat') {
        const generatedTitle = generateChatTitle(messageText);
        await updateDoc(chatRef, {
          title: generatedTitle,
          lastMessage: messageText,
          timestamp: new Date()
        });
      } else {
        // Just update last message and timestamp
        await updateDoc(chatRef, {
          lastMessage: messageText,
          timestamp: new Date()
        });
      }

      // Process the query and get response
      let response = await QueryProcessor.processQuery(messageText, currentUser.companyId);

      // Add bot response
      const botResponse = {
        content: response,
        timestamp: new Date(),
        isUser: false,
        userId: currentUser.id,
        chatId: currentChatId,
        companyId: currentUser.companyId
      };

      await addDoc(messagesRef, botResponse);

    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleDownload = async (format: 'excel' | 'pdf') => {
    if (!downloadableData) {
      setError('No data available for download');
      return;
    }

    try {
      const filename = `data_${new Date().toISOString().split('T')[0]}`;
      const blob = await HRAssistant.downloadData(downloadableData, format, filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading data:', error);
      setError(`Failed to download ${format.toUpperCase()} file. Please try again.`);
    }
  };

  const handleDeleteChat = async (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent chat selection when clicking delete
    
    if (!window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      const { db } = initFirebase();
      const batch = writeBatch(db);

      // Delete all messages in the chat
      const messagesRef = collection(db, 'messages');
      const messagesQuery = query(messagesRef, where('chatId', '==', chatId));
      const messagesSnapshot = await getDocs(messagesQuery);
      messagesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete the chat history entry
      const chatRef = doc(db, 'chatHistory', chatId);
      batch.delete(chatRef);

      await batch.commit();

      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
        
        // If there are other chats, select the most recent one
        const remainingChats = chatHistory.filter(chat => chat.id !== chatId);
        if (remainingChats.length > 0) {
          setCurrentChatId(remainingChats[0].id);
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      setError('Failed to delete chat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      AuthService.logout();
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      // Force redirect to login even if logout fails
      router.push('/login');
    }
  };

  const handleEditTitle = (chatId: string, currentTitle: string) => {
    setEditingTitle(chatId);
    setNewTitle(currentTitle);
    // Focus the input field when it appears
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
  };

  const handleTitleUpdate = async (chatId: string) => {
    if (!newTitle.trim()) {
      setEditingTitle(null);
      return;
    }

    try {
      const { db } = initFirebase();
      const chatRef = doc(db, 'chatHistory', chatId);
      await updateDoc(chatRef, {
        title: newTitle.trim()
      });
      setEditingTitle(null);
    } catch (error) {
      console.error('Error updating chat title:', error);
      setError('Failed to update chat title');
    }
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent, chatId: string) => {
    if (e.key === 'Enter') {
      handleTitleUpdate(chatId);
    } else if (e.key === 'Escape') {
      setEditingTitle(null);
    }
  };

  const renderUserProfile = () => {
    if (!currentUser) return null;

    return (
      <div className={styles.userProfile}>
        <FiUser />
        <div className={styles.userDetails}>
          <span className={styles.userName}>{currentUser.name}</span>
          <span className={styles.userEmail}>{currentUser.email}</span>
          <span className={styles.userCompany}>
            {currentUser.companyId === 'ABC' ? 'ABC Company' : 'XYZ Company'}
          </span>
        </div>
      </div>
    );
  };

  const renderChatHistory = () => {
    if (!currentUser) return null;

    return (
      <div className={styles.chatList}>
        <div className={styles.chatListHeader}>
          <h2>Your Chats</h2>
          <button
            className={styles.newChatButton}
            onClick={handleNewChat}
            disabled={isLoading}
          >
            <FiPlus /> New Chat
          </button>
        </div>
        {chatHistory.length === 0 ? (
          <div className={styles.noChatHistory}>
            <p>No chat history yet</p>
            <p>Start a new chat to begin</p>
          </div>
        ) : (
          <div className={styles.chatItems}>
            {chatHistory.map((chat) => (
              <div
                key={chat.id}
                className={`${styles.chatItem} ${
                  currentChatId === chat.id ? styles.active : ''
                }`}
                onClick={() => setCurrentChatId(chat.id)}
              >
                <div className={styles.chatItemContent}>
                  {editingTitle === chat.id ? (
                    <div className={styles.editTitleContainer}>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyPress={(e) => handleTitleKeyPress(e, chat.id)}
                        className={styles.editTitleInput}
                        ref={titleInputRef}
                        autoFocus
                      />
                      <div className={styles.editTitleActions}>
                        <button
                          onClick={() => handleTitleUpdate(chat.id)}
                          className={styles.confirmEdit}
                        >
                          <FiCheck />
                        </button>
                        <button
                          onClick={() => setEditingTitle(null)}
                          className={styles.cancelEdit}
                        >
                          <FiX />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.chatItemTitle}>
                      <span>{chat.title}</span>
                      <div className={styles.chatItemActions}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTitle(chat.id, chat.title);
                          }}
                          className={styles.editButton}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          className={styles.deleteButton}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderChatArea = () => {
    if (!currentUser) return null;

    return (
      <div className={styles.chatArea}>
        <div className={styles.messagesContainer}>
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`${styles.message} ${
                message.isUser ? styles.userMessage : styles.botMessage
              }`}
            >
              <div className={styles.messageContent}>
                {message.isUser ? (
                  <FiUser className={styles.messageIcon} />
                ) : (
                  <RiRobot2Fill className={styles.messageIcon} />
                )}
                <div className={styles.messageText}>
                  {message.content}
                  {message.downloadOptions && (
                    <div className={styles.downloadOptions}>
                      {message.downloadOptions.excel && (
                        <button
                          onClick={() => handleDownload('excel')}
                          className={styles.downloadButton}
                        >
                          <FiDownload /> Download Excel
                        </button>
                      )}
                      {message.downloadOptions.pdf && (
                        <button
                          onClick={() => handleDownload('pdf')}
                          className={styles.downloadButton}
                        >
                          <FiDownload /> Download PDF
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className={styles.inputForm}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message here..."
            className={styles.messageInput}
            disabled={isLoading || !currentChatId}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isLoading || !newMessage.trim() || !currentChatId}
          >
            {isTyping ? <FiLoader className={styles.spinner} /> : <FiSend />}
          </button>
        </form>
      </div>
    );
  };

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={handleLogout} className={styles.logoutButton}>
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          {renderUserProfile()}
          <button onClick={handleLogout} className={styles.logoutButton}>
            <FiLogOut /> Logout
          </button>
        </div>
        {renderChatHistory()}
      </div>
      {renderChatArea()}
    </div>
  );
} 