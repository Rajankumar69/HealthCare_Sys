export interface User {
  userId: number;
  fullName: string;
  email: string;
  role: 'Doctor' | 'Nurse' | 'Patient' | string;
  phoneNumber?: string;
  departmentId?: number;
  departmentName?: string;
  jobTitle?: string;
  workSchedule?: string;
  workLocation?: string;
  token?: string;
}

export interface Department {
  departmentId: number;
  departmentName: string;
  description?: string;
  isActive: boolean;
}

export interface LoginResponse {
  token: string;
  userId: number;
  fullName: string;
  email: string;
  role: string;
  phoneNumber?: string;
  departmentId?: number;
  departmentName?: string;
  jobTitle?: string;
  workSchedule?: string;
  workLocation?: string;
  expiration: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  email: string;
  phoneNumber?: string;
  departmentId?: number | null;
  jobTitle?: string;
  workSchedule?: string;
  workLocation?: string;
}

export interface UpdateProfileResponse {
  message: string;
  profile: User;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  generatedOtp?: string;
  validitySeconds: number;
}
