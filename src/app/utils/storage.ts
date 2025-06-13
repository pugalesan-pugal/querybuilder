export const STORAGE_KEY = 'currentUser';

export function isBrowser() {
  return typeof window !== 'undefined';
}

export function getStorage() {
  if (!isBrowser()) return null;
  return localStorage;
}

export function saveUser(user: any) {
  try {
    const storage = getStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(user));
      console.log('User saved to storage:', { email: user.email });
    }
  } catch (error) {
    console.error('Error saving user to storage:', error);
  }
}

export function getUser(): any {
  try {
    const storage = getStorage();
    if (!storage) return null;
    const data = storage.getItem(STORAGE_KEY);
    if (data) {
      const user = JSON.parse(data);
      console.log('User retrieved from storage:', { email: user.email });
      return user;
    }
    return null;
  } catch (error) {
    console.error('Error getting user from storage:', error);
    return null;
  }
}

export function clearUser() {
  try {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(STORAGE_KEY);
      console.log('User cleared from storage');
    }
  } catch (error) {
    console.error('Error clearing user from storage:', error);
  }
}
