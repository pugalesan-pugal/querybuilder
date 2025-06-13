/**
 * Shared authentication utilities
 */

/**
 * Generates a consistent password for Firebase Auth
 * @param email User's email
 * @param accessCode User's access code
 * @returns A consistent password that meets Firebase requirements
 */
export function generateAuthPassword(email: string, accessCode: string): string {
  // Create a deterministic password that meets Firebase requirements
  // Normalize email to lowercase to ensure consistency
  const normalizedEmail = email.toLowerCase();
  const username = normalizedEmail.split('@')[0];
  
  // Create a more secure password that includes:
  // - Uppercase letters (A)
  // - Lowercase letters (a)
  // - Numbers (1)
  // - Special characters (#)
  // - At least 8 characters long
  return `${accessCode}#${username}#Auth2024!`;
} 