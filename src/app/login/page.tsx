'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomAuthService } from '../utils/customAuth';
import styles from './page.module.css';
import LoginTransition from '../components/LoginTransition';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = CustomAuthService.getInstance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await auth.login(email, password);
      // Keep loading true for the transition animation
      setTimeout(() => {
        router.push('/chat');
      }, 2500); // Match the duration of the transition animation
    } catch (error: any) {
      setLoading(false);
      console.error('Login error:', error);
      setError(error.message || 'An error occurred during login.');
    }
  };

  return (
    <>
      {loading ? (
        <LoginTransition />
      ) : (
        <div className={styles.container}>
          {/* Background Animations */}
          <div className={styles.orb1} />
          <div className={styles.orb2} />
          <div className={styles.orb3} />
          <div className={styles.orb4} />
          <div className={styles.shootingStar} />
          <div className={styles.shootingStar} />
          <div className={styles.shootingStar} />
          
          <div className={styles.loginBox}>
            <h1>Login</h1>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={styles.input}
                  placeholder="Enter your email"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={styles.input}
                  placeholder="Enter your password"
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className={`${styles.button} ${loading ? styles.loading : ''}`}
              >
                Login
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
