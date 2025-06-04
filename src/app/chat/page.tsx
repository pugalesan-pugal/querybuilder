'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../login/firebase';
import { initFirebase } from '../utils/initFirebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, getDocs, updateDoc, FirestoreError, deleteDoc, writeBatch } from 'firebase/firestore';
import styles from './page.module.css';
import { FiSend, FiPlus, FiLogOut, FiUser, FiTrash2, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { RiRobot2Fill } from 'react-icons/ri';
import type { Employee } from '../types/employee';
import LoadingOverlay from '../components/LoadingOverlay';
import { GeminiChat } from '../utils/gemini';
import { HRAssistant } from '../utils/hrAssistant';

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
}

interface ChatHistory {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  userId: string;
  department?: string;
  createdBy?: string;
}

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

  useEffect(() => {
    try {
      // Check for user data in localStorage
      const userData = localStorage.getItem('currentUser');
      if (!userData) {
        console.log('No user data found in localStorage');
        router.push('/login');
        return;
      }

      const parsedUserData = JSON.parse(userData);
      console.log('Loaded user data:', parsedUserData);

      if (!parsedUserData.id || !parsedUserData.email) {
        console.log('Invalid user data format:', parsedUserData);
        localStorage.removeItem('currentUser');
        router.push('/login');
        return;
      }

      setCurrentUser(parsedUserData);
    } catch (error) {
      console.error('Error loading user data:', error);
      localStorage.removeItem('currentUser');
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!currentUser?.id) {
      console.log('No current user ID, skipping chat history load');
      return;
    }

    console.log('Loading chat history for user:', currentUser.id);
    const { db } = initFirebase();
    
    // Load chat history
    const loadChatHistory = async () => {
      try {
        const historyRef = collection(db, 'chatHistory');
        const q = query(
          historyRef,
          where('userId', '==', currentUser.id),
          orderBy('timestamp', 'desc')
        );

        console.log('Setting up chat history listener');
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const history: ChatHistory[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            history.push({
              id: doc.id,
              title: data.title || 'New Chat',
              lastMessage: data.lastMessage || '',
              timestamp: data.timestamp?.toDate() || new Date(),
              userId: data.userId,
              department: data.department,
              createdBy: data.createdBy
            });
          });
          console.log('Loaded chat history:', history);
          setChatHistory(history);
          setIsLoading(false);

          // If no chat is selected and we have history, select the most recent chat
          if (!currentChatId && history.length > 0) {
            console.log('Selecting most recent chat:', history[0].id);
            setCurrentChatId(history[0].id);
          }

          // If no chat history exists, create a new chat
          if (history.length === 0) {
            console.log('No chat history found, creating new chat');
            handleNewChat();
          }
        }, (error) => {
          console.error('Error in chat history listener:', error);
          setError('Failed to load chat history: ' + error.message);
          setIsLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error loading chat history:', error);
        setError('Failed to load chat history');
        setIsLoading(false);
      }
    };

    loadChatHistory();
  }, [currentUser, currentChatId]);

  useEffect(() => {
    if (!currentChatId || !currentUser) return;

    const { db } = initFirebase();
    // Load messages for current chat
    const loadMessages = async () => {
      try {
        const messagesRef = collection(db, 'messages');
        const q = query(
          messagesRef,
          where('chatId', '==', currentChatId),
          orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const msgs: ChatMessage[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            msgs.push({
              id: doc.id,
              content: data.content,
              timestamp: data.timestamp.toDate(),
              isUser: data.isUser,
              userId: data.userId,
              chatId: data.chatId,
              department: data.department
            });
          });
          setMessages(msgs);
          scrollToBottom();
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error loading messages:', error);
        setError('Failed to load messages');
      }
    };

    loadMessages();
  }, [currentChatId, currentUser]);

  // Initialize Gemini chat when component mounts
  useEffect(() => {
    try {
      setGeminiChat(new GeminiChat());
    } catch (error) {
      console.error('Failed to initialize Gemini chat:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize chat');
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNewChat = async () => {
    if (!currentUser) return;

    try {
      const { db } = initFirebase();
      const chatRef = collection(db, 'chatHistory');
      const newChat = {
        title: 'New Chat',
        lastMessage: 'Welcome! How can I help you today?',
        timestamp: new Date(),
        userId: currentUser.id,
        department: currentUser.department,
        createdBy: currentUser.name
      };

      const docRef = await addDoc(chatRef, newChat);
      setCurrentChatId(docRef.id);

      // Reset Gemini chat history for new chat
      if (geminiChat) {
        geminiChat.clearHistory();
      }

      // Add welcome message
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        content: 'Hello! 👋 I\'m your AI assistant powered by Gemini. How can I help you today?',
        timestamp: new Date(),
        isUser: false,
        userId: currentUser.id,
        chatId: docRef.id,
        department: currentUser.department
      });
    } catch (error) {
      console.error('Error creating new chat:', error);
      setError('Failed to create new chat');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChatId || !currentUser || !geminiChat) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsTyping(true);
    setError(null); // Clear any previous errors

    try {
      const { db } = initFirebase();
      const messagesRef = collection(db, 'messages');
      
      // Add user message
      const message = {
        content: messageText,
        timestamp: new Date(),
        isUser: true,
        userId: currentUser.id,
        chatId: currentChatId,
        department: currentUser.department
      };

      await addDoc(messagesRef, message);

      // Update chat history
      const chatRef = doc(db, 'chatHistory', currentChatId);
      await updateDoc(chatRef, {
        lastMessage: messageText,
        timestamp: new Date()
      });

      try {
        // Get response from Gemini
        const response = await geminiChat.sendMessage(messageText);

        // Add bot response
        const botResponse = {
          content: response,
          timestamp: new Date(),
          isUser: false,
          userId: currentUser.id,
          chatId: currentChatId,
          department: currentUser.department
        };

        await addDoc(messagesRef, botResponse);

        // Update chat history with bot's response
        await updateDoc(chatRef, {
          lastMessage: response,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error getting Gemini response:', error);
        
        // Add error message if Gemini fails
        const errorMessage = error instanceof Error 
          ? error.message
          : "I apologize, but I'm having trouble processing your request at the moment. Please try again.";

        const errorResponse = {
          content: errorMessage,
          timestamp: new Date(),
          isUser: false,
          userId: currentUser.id,
          chatId: currentChatId,
          department: currentUser.department
        };

        await addDoc(messagesRef, errorResponse);
        setError(errorMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setIsTyping(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!window.confirm('Are you sure you want to delete this chat?')) return;

    try {
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
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      setError('Failed to delete chat');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    router.push('/login');
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

  if (!currentUser) {
    return <LoadingOverlay />;
  }

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <button className={styles.newChatButton} onClick={handleNewChat}>
            <FiPlus /> New Chat
          </button>
          <div className={styles.userInfo}>
            <FiUser />
            <div className={styles.userDetails}>
              <span className={styles.userName}>{currentUser.name}</span>
              <span className={styles.userDesignation}>{currentUser.designation}</span>
              <span className={styles.userEmail}>{currentUser.email}</span>
            </div>
            <button className={styles.logoutButton} onClick={handleLogout}>
              <FiLogOut />
            </button>
          </div>
        </div>

        <div className={styles.chatList}>
          {chatHistory.map((chat) => (
            <div
              key={chat.id}
              className={`${styles.chatItem} ${currentChatId === chat.id ? styles.active : ''}`}
              onClick={() => setCurrentChatId(chat.id)}
            >
              <div className={styles.chatItemContent}>
                {editingTitle === chat.id ? (
                  <div className={styles.titleEdit}>
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => handleTitleKeyPress(e, chat.id)}
                      className={styles.titleInput}
                      placeholder="Enter chat title"
                    />
                    <button
                      className={styles.titleButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTitleUpdate(chat.id);
                      }}
                    >
                      <FiCheck />
                    </button>
                    <button
                      className={styles.titleButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTitle(null);
                      }}
                    >
                      <FiX />
                    </button>
                  </div>
                ) : (
                  <div className={styles.titleContainer}>
                    <h3>{chat.title}</h3>
                    <button
                      className={styles.editButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTitle(chat.id, chat.title);
                      }}
                    >
                      <FiEdit2 />
                    </button>
                  </div>
                )}
                <p>{chat.lastMessage}</p>
              </div>
              <button
                className={styles.deleteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChat(chat.id);
                }}
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={styles.chatArea}>
        {isLoading ? (
          <LoadingOverlay />
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : !currentChatId ? (
          <div className={styles.welcome}>
            <RiRobot2Fill className={styles.botIcon} />
            <h1>Welcome to QueryBuilder Bot!</h1>
            <p>Start a new chat to begin your conversation.</p>
          </div>
        ) : (
          <>
            <div className={styles.messages}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`${styles.message} ${
                    message.isUser ? styles.userMessage : styles.botMessage
                  }`}
                >
                  <div className={styles.messageContent}>
                    {message.content}
                    <span className={styles.timestamp}>
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className={`${styles.message} ${styles.botMessage}`}>
                  <div className={styles.typingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className={styles.inputArea}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className={styles.input}
                disabled={isTyping}
              />
              <button 
                type="submit" 
                className={styles.sendButton} 
                disabled={!newMessage.trim() || isTyping}
              >
                <FiSend />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
} 