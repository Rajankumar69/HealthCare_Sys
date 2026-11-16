export interface DoctorLeave {
  leaveId: number | string;
  doctorId: number;
  doctorName?: string;
  leaveCategory: 'future' | 'half-day' | 'short'; // future = full-day / multi-day, half-day = morning/afternoon, short = 1-3 hours
  leaveType: string; // 'Annual Leave' | 'Medical Leave' | 'Casual Leave' | 'Conference / CME' | 'Personal / Emergency'
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (same as startDate for single/half-day)
  halfDaySession?: 'Morning' | 'Afternoon'; // 'Morning' (09:00 AM - 01:00 PM), 'Afternoon' (02:00 PM - 05:00 PM)
  startTime?: string; // e.g. "10:00 AM"
  endTime?: string;   // e.g. "01:00 PM"
  reason: string;
  createdAt?: string;
  status: 'Approved' | 'Active' | 'Cancelled';
}
