import React from 'react';
import styles from './PageLoadingTransition.module.css';
import { FiLoader } from 'react-icons/fi';

export default function PageLoadingTransition() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <div className={styles.pulse}></div>
          <FiLoader className={styles.icon} />
        </div>
        <h1 className={styles.title}>Loading</h1>
        <p className={styles.subtitle}>Please wait while we set up your workspace</p>
        <div className={styles.progressBar}>
          <div className={styles.progress}></div>
        </div>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepDot}></div>
            <span className={styles.stepText}>Initializing components...</span>
          </div>
          <div className={styles.step}>
            <div className={styles.stepDot}></div>
            <span className={styles.stepText}>Loading data...</span>
          </div>
          <div className={styles.step}>
            <div className={styles.stepDot}></div>
            <span className={styles.stepText}>Preparing interface...</span>
          </div>
        </div>
      </div>
    </div>
  );
} 