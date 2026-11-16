export interface Patient {
  patientID: number;
  userId: number;
  prefix: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  gender?: string;
  phoneNumber: string;
  email: string;
  anyMedicalHistory?: string;
  problem?: string;
  adharNumber?: string;
  dateOfBirth: string;
  age: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string;
  deletedBy?: string;
  deletedDate?: string;
}

export interface PaginatedPatients {
  items: Patient[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface PatientVital {
  vitalId?: number;
  patientId: number;
  bloodPressure: string;
  heartRate: number;
  temperature: number;
  weight: number;
  bloodGroup?: string;
  recordedDate?: string;
  recordedBy?: string;
}

export interface PatientMedicalHistory {
  historyId?: number;
  patientId: number;
  condition: string;
  diagnosisDate?: string | null;
  treatment?: string | null;
  notes?: string | null;
  recordedDate?: string | null;
}

export interface PatientFullDetails {
  patientDetails: Patient;
  patientVitals: PatientVital[];
  patientMedicalHistory: PatientMedicalHistory[];
}
