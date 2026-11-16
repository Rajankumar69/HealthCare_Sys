export interface Appointment {
  appointmentId: number;
  patientId: number;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  doctorId: number;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  reason?: string;
  status: 'Requested' | 'Approved' | 'NurseApproved' | 'DoctorConfirmed' | 'Rescheduled' | 'Done' | 'Cancelled' | string;
  notes?: string;
  createdAt: string;
}

export interface DoctorSlot {
  slotLabel: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  appointmentId?: number;
  patientId?: number;
  patientName?: string;
  patientPhone?: string;
  reason?: string;
  status: string;
  notes?: string;
}

export interface DoctorSchedule {
  doctorId: number;
  doctorName: string;
  date: string;
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
  currentLeave?: any;
  slots: DoctorSlot[];
}

export interface CreateAppointmentRequest {
  patientId: number;
  doctorId: number;
  appointmentDate: string;
  appointmentTime: string;
  reason?: string;
  medicalHistory?: string;
  treatment?: string;
  notes?: string;
}

export interface RescheduleAppointmentRequest {
  newDate: string;
  newTime: string;
  reason?: string;
}

export interface DoctorInfo {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  departmentId?: number;
  departmentName?: string;
}
