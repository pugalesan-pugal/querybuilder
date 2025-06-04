'use client';

import React from 'react';
import styles from './LoadingOverlay.module.css';
import { RiRobot2Fill } from 'react-icons/ri';

export default function LoadingOverlay() {
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <RiRobot2Fill className={styles.icon} />
        <div className={styles.spinner} />
        <h2>Loading your chat...</h2>
        <p>Please wait while we set things up</p>
      </div>
    </div>
  );
} 