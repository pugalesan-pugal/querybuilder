import React, { useEffect } from 'react';
import styles from './LoadingTransition.module.css';
import { RiRobot2Fill } from 'react-icons/ri';

interface LoadingTransitionProps {
  onTimeout?: () => void;
  timeout?: number;
}

export default function LoadingTransition({ onTimeout, timeout = 3000 }: LoadingTransitionProps) {
  useEffect(() => {
    if (onTimeout) {
      const timer = setTimeout(() => {
        onTimeout();
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [onTimeout, timeout]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <RiRobot2Fill className={styles.icon} />
          <div className={styles.pulse}></div>
        </div>
        <h1 className={styles.title}>Welcome to Your AI Assistant</h1>
        <p className={styles.subtitle}>Setting up your personalized experience...</p>
        <div className={styles.progressBar}>
          <div className={styles.progress}></div>
        </div>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepDot}></span>
            <span className={styles.stepText}>Authenticating</span>
          </div>
          <div className={styles.step}>
            <span className={styles.stepDot}></span>
            <span className={styles.stepText}>Loading preferences</span>
          </div>
          <div className={styles.step}>
            <span className={styles.stepDot}></span>
            <span className={styles.stepText}>Preparing workspace</span>
          </div>
        </div>
      </div>
    </div>
  );
} 