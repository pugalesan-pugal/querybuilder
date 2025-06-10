'use client';

import React from 'react';
import styles from './LoginTransition.module.css';
import { FiUser, FiLock, FiCheck } from 'react-icons/fi';

export default function LoginTransition() {
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.iconWrapper}>
              <FiUser className={styles.icon} />
              <div className={styles.checkmark}>
                <FiCheck />
              </div>
            </div>
            <p>Verifying Credentials</p>
          </div>
          <div className={`${styles.step} ${styles.stepDelay1}`}>
            <div className={styles.iconWrapper}>
              <FiLock className={styles.icon} />
              <div className={styles.checkmark}>
                <FiCheck />
              </div>
            </div>
            <p>Authenticating Access</p>
          </div>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progress}></div>
        </div>
        <p className={styles.message}>Setting up your workspace...</p>
      </div>
    </div>
  );
} 