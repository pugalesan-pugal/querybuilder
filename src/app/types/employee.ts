export interface Employee {
  id?: string;
  Age: string;
  City: string;
  "Contact Number": string;
  DateOfJoining: string;
  Department: string;
  Designation: string;
  Email: string;
  Experience: number;
  Gender: string;
  Name: string;
  Salary: string;
  accessCode?: string;
  role?: string; // Role for access control
  permissions?: {
    canViewAllChats: boolean;
    canDeleteChats: boolean;
    canModifyOthersChats: boolean;
    restrictedToDepartment: boolean;
  };
} 