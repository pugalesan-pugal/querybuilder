import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './initFirebase';

interface UserData {
  email: string;
  name: string;
  companyId: string;
  role: string;
  isActive: boolean;
  password: string;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
}

interface CompanyData {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  services: any;
  createdAt: string;
  updatedAt: string;
}

interface CustomUser {
  email: string;
  name: string;
  companyId: string;
  role: string;
  company: CompanyData;
  isActive: boolean;
  lastLogin: string | null;
}

interface AuthState {
  user: CustomUser | null;
  loading: boolean;
  error: Error | null;
}

export class CustomAuthService {
  private static instance: CustomAuthService;
  private db;
  private currentUser: CustomUser | null = null;

  private constructor() {
    this.db = db;
  }

  public static getInstance(): CustomAuthService {
    if (!CustomAuthService.instance) {
      CustomAuthService.instance = new CustomAuthService();
    }
    return CustomAuthService.instance;
  }

  async login(email: string, password: string): Promise<CustomUser> {
    try {
      console.log('🔐 Attempting custom login for:', email);
      
      // Step 1: Check if user exists in bank_customers collection
      const userDoc = await getDoc(doc(this.db, 'bank_customers', email));
      console.log('📄 User document exists:', userDoc.exists());
      
      if (!userDoc.exists()) {
        console.error('❌ User not found in bank_customers collection');
        throw new Error('User not found. Please check your email.');
      }

      const userData = userDoc.data() as UserData;
      console.log('👤 User data loaded:', {
        email: userData.email,
        companyId: userData.companyId,
        name: userData.name,
        isActive: userData.isActive
      });

      // Step 2: Check if user is active
      if (!userData.isActive) {
        console.error('❌ User account is not active');
        throw new Error('Account is deactivated. Please contact administrator.');
      }

      // Step 3: Verify password matches
      if (userData.password !== password) {
        console.error('❌ Password does not match');
        throw new Error('Invalid password. Please try again.');
      }

      // Step 4: Verify company exists
      const companyDoc = await getDoc(doc(this.db, 'companies', userData.companyId));
      console.log('🏢 Company document exists:', companyDoc.exists());
      
      if (!companyDoc.exists()) {
        console.error('❌ Company not found:', userData.companyId);
        throw new Error('Company not found. Please contact administrator.');
      }

      const companyData = companyDoc.data() as CompanyData;
      console.log('🏢 Company data loaded:', {
        name: companyData.name,
        id: companyData.id,
        isActive: companyData.isActive
      });

      // Step 5: Check if company is active
      if (!companyData.isActive) {
        console.error('❌ Company is not active');
        throw new Error('Company account is deactivated. Please contact administrator.');
      }

      // Step 6: Create custom user object
      const customUser: CustomUser = {
        email: userData.email,
        name: userData.name,
        companyId: userData.companyId,
        role: userData.role,
        company: companyData,
        isActive: userData.isActive,
        lastLogin: userData.lastLogin
      };

      // Step 7: Store user in memory and localStorage
      this.currentUser = customUser;
      localStorage.setItem('customUser', JSON.stringify(customUser));
      
      console.log('✅ Login successful for:', customUser.name);
      return customUser;

    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      this.currentUser = null;
      localStorage.removeItem('customUser');
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      throw error;
    }
  }

  getCurrentUser(): CustomUser | null {
    if (this.currentUser) {
      return this.currentUser;
    }
    
    // Try to get from localStorage
    const storedUser = localStorage.getItem('customUser');
    if (storedUser) {
      try {
        this.currentUser = JSON.parse(storedUser);
        return this.currentUser;
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('customUser');
      }
    }
    
    return null;
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }
}

export function useCustomAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const authService = CustomAuthService.getInstance();
    
    // Check for existing session
    const currentUser = authService.getCurrentUser();
    
    if (currentUser) {
      console.log('🔍 Found existing session for:', currentUser.name);
      setAuthState({
        user: currentUser,
        loading: false,
        error: null
      });
    } else {
      console.log('🔍 No existing session found');
      setAuthState({
        user: null,
        loading: false,
        error: null
      });
    }
  }, []);

  return authState;
} 