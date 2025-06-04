'use client';

import React from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
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
          <i className="fab fa-github"></i>
        </Link>
        <Link href="https://twitter.com" target="_blank" className={styles.socialLink}>
          <i className="fab fa-twitter"></i>
        </Link>
        <Link href="https://facebook.com" target="_blank" className={styles.socialLink}>
          <i className="fab fa-facebook-f"></i>
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
