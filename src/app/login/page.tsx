'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { initFirebase, isFirebaseInitialized } from '../utils/initFirebase';
import { AuthService } from '../utils/auth';
import styles from './page.module.css';
import { FiMail, FiLock, FiLoader } from 'react-icons/fi';
import LoadingTransition from '../components/LoadingTransition';
import { FirebaseError } from 'firebase/app';
import { initializeTestData } from '../utils/initializeTestData';
import { setupFirebase } from '../utils/setupFirebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | JSX.Element>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLoadingTransition, setShowLoadingTransition] = useState(false);
  const router = useRouter();
  const isInitialized = useRef(false);
  const sessionCheckComplete = useRef(false);

  useEffect(() => {
    const initializeApp = async () => {
      if (isInitialized.current) return;

      try {
        if (!isFirebaseInitialized()) {
          console.log('Initializing Firebase...');
          const { db } = initFirebase();
          if (!db) throw new Error('Failed to initialize Firebase');
          console.log('Firebase initialized successfully');
        }

        if (!sessionCheckComplete.current) {
          console.log('Checking for existing session...');
          const user = await AuthService.getCurrentUser();
          sessionCheckComplete.current = true;

          if (user) {
            console.log('Found existing session, redirecting to chat');
            setShowLoadingTransition(true);
            setTimeout(() => router.push('/chat'), 1000);
            return;
          }
        }

        isInitialized.current = true;
      } catch (error) {
        console.error('Error during initialization:', error);
        setError('Failed to initialize application. Please try again.');
      }
    };

    initializeApp();

    return () => {
      sessionCheckComplete.current = false;
    };
  }, [router]);

  const handleInitTestData = async () => {
    setIsLoading(true);
    setError('');

    try {
      console.log('Setting up Firebase...');
      const setupResult = await setupFirebase();
      if (!setupResult) {
        setError('Failed to set up Firebase. Check console for details.');
        setIsLoading(false);
        return;
      }
      console.log('Firebase setup completed');

      console.log('Initializing test data...');
      const success = await initializeTestData();
      if (success) {
        setEmail('pugal@example.com');
        setAccessCode('ABC123');
        setError(
          <div className={styles.successMessage}>
            Test data initialized successfully! You can now log in with:
            <br />
            Email: pugal@example.com
            <br />
            Access Code: ABC123
          </div>
        );
      } else {
        setError('Failed to initialize test data. Check console for details.');
      }
    } catch (error) {
      console.error('Error initializing test data:', error);
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'permission-denied':
            setError('Permission denied. Please check Firebase rules and try again.');
            break;
          case 'not-found':
            setError('Firebase project not found. Please check configuration.');
            break;
          default:
            setError(`Error: ${error.message}`);
        }
      } else {
        setError('Error initializing test data. Check console for details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    console.log('Starting login process...', { email });

    if (!email || !accessCode) {
      setError('Please enter both email and access code');
      setIsLoading(false);
      return;
    }

    try {
      const user = await AuthService.validateUser(email, accessCode);
      if (!user) {
        setError(
          <div className={styles.errorDetails}>
            <h3>User Not Found</h3>
            <p>We couldn't find an account with these credentials.</p>
            <ul>
              <li>Check if your email is correct</li>
              <li>Verify your access code</li>
              <li>Contact your company administrator if you need access</li>
            </ul>
            <p className={styles.demoNote}>
              For testing, use the demo credentials below.
            </p>
          </div>
        );
        setIsLoading(false);
        return;
      }

      const storedUser = localStorage.getItem('currentUser');
      if (!storedUser) {
        localStorage.setItem('currentUser', JSON.stringify(user));
      }

      const { auth } = initFirebase();
      if (!auth.currentUser) {
        setError('Authentication error. Please try again.');
        setIsLoading(false);
        return;
      }

      setShowLoadingTransition(true);
      setIsLoading(false);

      setTimeout(() => {
        const finalCheck = localStorage.getItem('currentUser');
        if (!finalCheck) {
          setError('Session error. Please try logging in again.');
          setShowLoadingTransition(false);
          return;
        }
        router.push('/chat');
      }, 1500);

    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/invalid-email':
            setError('Please enter a valid email address');
            break;
          case 'auth/user-disabled':
            setError('This account has been disabled. Please contact support.');
            break;
          case 'auth/user-not-found':
            setError(
              <div className={styles.errorDetails}>
                <h3>User Not Found</h3>
                <p>We couldn't find an account with this email.</p>
                <ul>
                  <li>Check if your email is correct</li>
                  <li>Contact your company administrator if you need access</li>
                </ul>
                <p className={styles.demoNote}>
                  For testing, use the demo credentials below.
                </p>
              </div>
            );
            break;
          case 'auth/wrong-password':
            setError(
              <div className={styles.errorDetails}>
                <h3>Invalid Access Code</h3>
                <p>The access code you entered is incorrect.</p>
                <ul>
                  <li>Check if your access code is correct</li>
                  <li>Try using the demo credentials below</li>
                </ul>
              </div>
            );
            break;
          default:
            setError(`Login failed: ${error.message}`);
        }
      } else if (error instanceof Error) {
        setError(`Login failed: ${error.message}`);
      } else {
        setError('An error occurred during login. Please try again.');
      }
      setIsLoading(false);
    }
  };

  const handleTransitionComplete = () => {
    const user = localStorage.getItem('currentUser');
    if (!user) {
      setError('Session error. Please try logging in again.');
      setShowLoadingTransition(false);
    }
  };

  if (showLoadingTransition) {
    return <LoadingTransition onTimeout={handleTransitionComplete} timeout={2000} />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1 className={styles.title}>Welcome Back</h1>
        <p className={styles.subtitle}>
          Enter your credentials to access your company data
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              <FiMail className={styles.inputIcon} />
              Email Address
            </label>
            <input
              type="email"
              id="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoFocus
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="accessCode" className={styles.label}>
              <FiLock className={styles.inputIcon} />
              Access Code
            </label>
            <input
              type="password"
              id="accessCode"
              className={styles.input}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Enter your access code"
              required
            />
          </div>

          <button 
            type="submit" 
            className={`${styles.loginButton} ${isLoading ? styles.loading : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <FiLoader className={styles.spinner} />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className={styles.demoCredentials}>
          <p>Demo Credentials:</p>
          <ul>
            <li>
              ABC Company:
              <br />Email: pugal@example.com
              <br />Access Code: ABC123
            </li>
            <li>
              XYZ Company:
              <br />Email: madhu@example.com
              <br />Access Code: XYZ456
            </li>
          </ul>
        </div>

        <div className={styles.testDataSection}>
          <button
            onClick={handleInitTestData}
            disabled={isLoading}
            className={styles.initDataButton}
          >
            Initialize Test Data
          </button>
          <p className={styles.testNote}>
            Click the button above to create test user data in Firebase
          </p>
        </div>
      </div>
    </div>
  );
}
