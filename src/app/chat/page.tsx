'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomAuth } from '../utils/customAuth';
import { BankQueryService } from '../utils/bankQueryService';
import LoadingScreen from '../components/LoadingScreen';
import styles from './page.module.css';
import { BankCustomer } from '../types/bankTypes';
import { collection, query, where, orderBy, onSnapshot, Timestamp, FirestoreError } from 'firebase/firestore';
import { db } from '../utils/initFirebase';
import { FiEdit2, FiTrash2, FiCheck, FiX, FiPlus, FiMessageSquare, FiSend, FiDownload, FiFileText } from 'react-icons/fi';
import { ExportService } from '../utils/exportService';

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
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const chatInitializedRef = useRef(false);
  const initialMessageSentRef = useRef(false);
  const messageCache = useRef(new Set<string>());
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Scroll to bottom immediately
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, []);

  // Handle scroll position
  useEffect(() => {
    const container = chatContainerRef.current?.querySelector('.messages');
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const bottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(bottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  // Scroll to bottom when sending a message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !bankQueryService || !currentChatId || isProcessing) {
      return;
    }

    const messageToSend = inputMessage.trim();
    setInputMessage('');
    setIsProcessing(true);
    setPendingUserMessage(messageToSend);
    setError(null);
    setIsAtBottom(true);
    scrollToBottom();

    try {
      await bankQueryService.processQuery(messageToSend, currentChatId);
    } catch (error) {
      console.error('Error processing query:', error);
      setError('Failed to process your query. Please try again.');
      setIsProcessing(false);
      setPendingUserMessage(null);
    }
  };

  // Initial scroll to bottom
  useEffect(() => {
    setIsAtBottom(true);
  }, []);

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
    if (!user || !bankQueryService || !db) return;

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
    if (!currentChatId || !user || !db) return;

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
          let hasNewMessages = false;

          sortedMsgs.forEach(msg => {
            if (!allMessages.some(m => m.id === msg.id)) {
              allMessages.push(msg);
              hasNewMessages = true;
              // If we receive an AI message and it matches our pending user message context,
              // clear the processing state
              if (!msg.isUser && pendingUserMessage) {
                setIsProcessing(false);
                setPendingUserMessage(null);
              }
            }
          });

          if (hasNewMessages) {
            setIsAtBottom(true);
          }

          return allMessages.sort((a, b) => 
            a.timestamp.seconds - b.timestamp.seconds || 
            a.timestamp.nanoseconds - b.timestamp.nanoseconds
          );
        });
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
  }, [currentChatId, user, db, pendingUserMessage]);

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

  const formatMessage = (content: string) => {
    // Format sensitive data patterns
    return content
      // Format masked numbers (e.g., ****1234)
      .replace(/(\*{4}\d{4})/g, '<span class="sensitiveData">$1</span>')
      // Format currency amounts
      .replace(/(₹[\d,]+(\.\d{2})?)/g, '<span class="currency">$1</span>')
      // Format dates
      .replace(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/g, '<span class="date">$1</span>')
      // Format status values
      .replace(/(Status: )(Active|Completed|Pending|Failed)/gi, 
        '$1<span class="status $2">$2</span>')
      // Format KYC status
      .replace(/(KYC Status: )(Completed|Pending|Verified)/gi,
        '$1<span class="status $2">$2</span>');
  };

  // Render messages with memoization
  const renderMessages = useMemo(() => {
    return (
      <div className={styles.messagesWrapper}>
        {messages.map((message, index) => (
          <div 
            key={message.id} 
            className={styles.messageContainer}
          >
            <div className={`${styles.messageHeader} ${message.isUser ? styles.userMessageHeader : styles.aiMessageHeader}`}>
              {message.isUser ? 'You' : 'AI Assistant'}
            </div>
            <div className={`${styles.message} ${message.isUser ? styles.userMessage : styles.aiMessage}`}>
              {message.isUser ? (
                message.content
              ) : (
                <div
                  className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: formatMessage(message.content)
                  }}
                />
              )}
            </div>
          </div>
        ))}
        {pendingUserMessage && (
          <div 
            className={styles.messageContainer}
          >
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
        <div ref={messagesEndRef} className={styles.messagesEnd} />
      </div>
    );
  }, [messages, pendingUserMessage, isProcessing, formatMessage]);

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

  // Add console log to debug processing state
  useEffect(() => {
    if (isProcessing) {
      console.log('Processing state active:', { pendingUserMessage, isProcessing });
    }
  }, [isProcessing, pendingUserMessage]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <p className={styles.errorTitle}>Error</p>
          <p className={styles.errorMessage}>{error}</p>
          {isIndexBuilding && (
            <div className={styles.errorActions}>
              <p className={styles.errorHint}>This usually takes a few minutes. You can:</p>
              <button
                onClick={() => window.location.reload()}
                className={styles.errorButton}
              >
                Refresh Page
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.userInfo}>
          {user && (
            <>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userEmail}>{user.email}</div>
              <div className={styles.companyId}>{user.companyId}</div>
            </>
          )}
        </div>

        <button
          className={styles.newChatButton}
          onClick={createNewChat}
          disabled={isProcessing}
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
              <div className={styles.chatActions}>
                {editingChatId === chat.id ? (
                  <>
                    <button
                      className={styles.chatActionButton}
                      onClick={() => handleRenameChat(chat.id)}
                    >
                      <FiCheck size={16} />
                    </button>
                    <button
                      className={styles.chatActionButton}
                      onClick={() => {
                        setEditingChatId(null);
                        setNewChatTitle('');
                      }}
                    >
                      <FiX size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={styles.chatActionButton}
                      onClick={() => {
                        setEditingChatId(chat.id);
                        setNewChatTitle(chat.title);
                      }}
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      className={`${styles.chatActionButton} ${styles.deleteButton}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                      disabled={isDeleting}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.chatContainer}>
        <div className={styles.messages} ref={chatContainerRef}>
          {renderMessages}
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