import React from 'react';
import styles from './LoadingScreen.module.css';

export default function LoadingScreen() {
  return (
    <div className={styles.container}>
      <div className={styles.spinner}>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
      </div>
      <div className={styles.text}>Loading...</div>
    </div>
  );
}

// Animations (add to global CSS or Tailwind config if needed):
// .animate-fadeIn { animation: fadeIn 0.5s ease; }
// .animate-fadeInUp { animation: fadeInUp 0.7s ease; }
// @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
// @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } 