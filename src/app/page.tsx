'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons';

export default function Home() {
  useEffect(() => {
    // Create floating dots
    const heroContent = document.querySelector(`.${styles.heroContent}`);
    if (heroContent) {
      const dotsContainer = document.createElement('div');
      dotsContainer.className = styles.floatingDots;
      
      // Create 20 dots with random positions
      for (let i = 0; i < 20; i++) {
        const dot = document.createElement('div');
        dot.className = styles.dot;
        dot.style.left = `${Math.random() * 100}%`;
        dot.style.top = `${Math.random() * 100}%`;
        dot.style.animationDelay = `${Math.random() * 4}s`;
        dotsContainer.appendChild(dot);
      }
      
      heroContent.appendChild(dotsContainer);
    }
  }, []);

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.logo}>QueryBuilder</div>
        <div className={styles.navLinks}>
          <Link href="/" className={styles.active}>HOME</Link>
          <Link href="/about">ABOUT US</Link>
          <Link href="/blog">BLOG</Link>
          <Link href="/contact">CONTACT</Link>
          <Link href="/login" className={styles.signIn}>SIGN IN</Link>
        </div>
      </nav>

      <div className={styles.socialLinks}>
        <Link href="https://github.com" target="_blank" className={styles.socialLink}>
          <FontAwesomeIcon icon={faGithub} />
        </Link>
        <Link href="https://linkedin.com" target="_blank" className={styles.socialLink}>
          <FontAwesomeIcon icon={faLinkedin} />
        </Link>
      </div>

      <main className={styles.main}>
        <div className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.title}>
              Chatbot
              <br />
              Service
              <span className={styles.subtitle}>Concept</span>
            </h1>
            <p className={styles.description}>
              Experience the next generation of conversational AI with our 
              intelligent chatbot service. Transform your customer interactions.
            </p>
            <button className={styles.demoButton}>
              VIEW DEMO
              <span className={styles.arrow}>→</span>
            </button>
          </div>

          <div className={styles.heroImage}>
            <div className={styles.chatInterface}>
              <div className={styles.messageBot}>
                <div className={styles.botIcon}>🤖</div>
                <div className={styles.messageContent}></div>
              </div>
              <div className={styles.messageUser}>
                <div className={styles.userIcon}>👤</div>
                <div className={styles.messageContent}></div>
              </div>
              <div className={styles.messageBot}>
                <div className={styles.botIcon}>🤖</div>
                <div className={styles.messageContent}></div>
              </div>
              <div className={styles.messageUser}>
                <div className={styles.userIcon}>👤</div>
                <div className={styles.messageContent}></div>
              </div>
              <div className={styles.messageBot}>
                <div className={styles.botIcon}>🤖</div>
                <div className={styles.messageContent}></div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.hexagonGrid}>
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className={styles.hexagon}></div>
          ))}
        </div>
      </main>
    </div>
  );
}