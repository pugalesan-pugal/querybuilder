'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { initFirebase } from '../utils/initFirebase';
import styles from './page.module.css';
import type { Employee } from '../types/employee';
import LoadingOverlay from '../components/LoadingOverlay';
import LoginTransition from '../components/LoginTransition';

const getRolePermissions = (designation: string) => {
  const designation_lower = designation.toLowerCase();
  
  if (designation_lower.includes('admin')) {
    return {
      canViewAllChats: true,
      canDeleteChats: true,
      canModifyOthersChats: true,
      restrictedToDepartment: false
    };
  }
  
  if (designation_lower.includes('manager') || designation_lower.includes('lead')) {
    return {
      canViewAllChats: false,
      canDeleteChats: true,
      canModifyOthersChats: true,
      restrictedToDepartment: true
    };
  }
  
  return {
    canViewAllChats: false,
    canDeleteChats: false,
    canModifyOthersChats: false,
    restrictedToDepartment: true
  };
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { db } = initFirebase();
      const employeesRef = collection(db, 'employees');
      const q = query(employeesRef, where('Email', '==', email));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('Invalid email or access code. Please verify your credentials.');
        setIsLoading(false);
        return;
      }

      const employeeDoc = snapshot.docs[0];
      const employeeData = employeeDoc.data() as Employee;

      if (employeeData.accessCode !== accessCode) {
        setError('Invalid email or access code. Please verify your credentials.');
        setIsLoading(false);
        return;
      }

      // Determine role based on designation
      let role = 'Employee';
      const designation_lower = employeeData.Designation.toLowerCase();
      if (designation_lower.includes('hr') || designation_lower.includes('human resources')) {
        role = 'HR';
      }

      // Store employee data in localStorage for persistence
      localStorage.setItem('currentUser', JSON.stringify({
        id: employeeDoc.id,
        email: employeeData.Email,
        name: employeeData.Name,
        department: employeeData.Department,
        designation: employeeData.Designation,
        role: role, // Add the role to the stored data
        accessCode: accessCode // Add the access code
      }));

      // Show loading overlay
      setIsNavigating(true);

      // Add a delay to show the transition animation
      setTimeout(() => {
        // Redirect to the chat/bot page
        router.push('/chat');
      }, 2500); // Increased delay to match animation duration
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <>
      {isNavigating ? (
        <LoginTransition />
      ) : (
      <div className={styles.container}>
        <div className={styles.loginBox}>
          <h1 className={styles.title}>Employee Login</h1>
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
              <label htmlFor="accessCode">Access Code</label>
              <input
                type="text"
                id="accessCode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
                className={styles.input}
                placeholder="Enter your access code"
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button 
              type="submit" 
              className={styles.button}
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
      )}
    </>
  );
}
