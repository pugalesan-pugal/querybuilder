export interface BankCustomer {
  id: string;
  email: string;
  name: string;
  companyId: string;  // Reference to the company they can access (ABC or XYZ)
  role: 'user' | 'admin';
  accessCode: string;  // Added access code field
  lastLogin?: Date;
  createdAt: Date;
} 