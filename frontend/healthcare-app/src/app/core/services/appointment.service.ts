import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Appointment, CreateAppointmentRequest, RescheduleAppointmentRequest, DoctorSchedule } from '../models/appointment.model';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private apiUrl = 'http://localhost:5000/api/healthcare/appointments';

  constructor(private http: HttpClient) {}

  getAppointments(doctorId?: number, patientId?: number, status?: string): Observable<Appointment[]> {
    let params = new HttpParams();
    if (doctorId) params = params.set('doctorId', doctorId.toString());
    if (patientId) params = params.set('patientId', patientId.toString());
    if (status) params = params.set('status', status);

    return this.http.get<Appointment[]>(this.apiUrl, { params });
  }

  getDoctorSchedule(doctorId: number, date?: string, durationMinutes?: number): Observable<DoctorSchedule> {
    let params = new HttpParams().set('doctorId', doctorId.toString());
    if (date) params = params.set('date', date);
    if (durationMinutes) params = params.set('durationMinutes', durationMinutes.toString());
    return this.http.get<DoctorSchedule>(`${this.apiUrl}/doctor-schedule`, { params });
  }

  getAppointmentById(appointmentId: number): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.apiUrl}/${appointmentId}`);
  }

  createAppointment(request: CreateAppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>(this.apiUrl, request);
  }

  // Exclusive Front Desk approval: Transitions appointment to "Approved"
  frontDeskApprove(appointmentId: number, notes?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${appointmentId}/approve`, { notes });
  }

  // Nurse marks appointment as "Done"
  markAsDone(appointmentId: number, notes?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${appointmentId}/done`, { notes });
  }

  // Nurse approves appointment to doctor (moves to NurseApproved) - legacy
  nurseApprove(appointmentId: number, notes?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${appointmentId}/nurse-approve`, { notes });
  }

  // Doctor confirms appointment (moves to DoctorConfirmed)
  doctorConfirm(appointmentId: number, notes?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${appointmentId}/doctor-confirm`, { notes });
  }

  // Reschedule appointment
  rescheduleAppointment(appointmentId: number, request: RescheduleAppointmentRequest): Observable<any> {
    return this.http.put(`${this.apiUrl}/${appointmentId}/reschedule`, request);
  }

  // Cancel appointment (e.g. Doctor declining rescheduled appointment)
  cancelAppointment(appointmentId: number, notes?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${appointmentId}/cancel`, { notes });
  }
}
