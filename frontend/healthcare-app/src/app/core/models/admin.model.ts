export interface AdminDoctorPatient {
  patientId: number;
  patientName: string;
  email: string;
  phoneNumber?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  status?: string;
  reason?: string;
}

export interface AdminDoctor {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  departmentName?: string;
  isActive: boolean;
  patients: AdminDoctorPatient[];
}

export interface AdminNursePatient {
  patientId: number;
  patientName: string;
  email: string;
  phoneNumber?: string;
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  recordedDate?: string;
}

export interface AdminNurse {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  departmentName?: string;
  isActive: boolean;
  patients: AdminNursePatient[];
}

export interface AdminPatient {
  patientId: number;
  userId?: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  gender?: string;
  age: number;
  dateOfBirth?: string;
  problem?: string;
  anyMedicalHistory?: string;
  isActive: boolean;
  assignedDoctor?: string;
  appointmentDate?: string;
  appointmentStatus?: string;
}

export interface AdminUsersResponse {
  doctors: AdminDoctor[];
  nurses: AdminNurse[];
  patients: AdminPatient[];
}

export interface AdminCreateUserRequest {
  role: 'Doctor' | 'Nurse' | 'Patient';
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  departmentId?: number;
  gender?: string;
  age?: number;
  dateOfBirth?: string;
  problem?: string;
  anyMedicalHistory?: string;
  adharNumber?: string;
}
