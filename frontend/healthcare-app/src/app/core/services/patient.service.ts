import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Patient, PaginatedPatients, PatientFullDetails, PatientVital, PatientMedicalHistory } from '../models/patient.model';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  // Routes through the centralized API Gateway on Port 5000
  private apiUrl = '/api/healthcare/patients';

  constructor(private http: HttpClient) {}

  getPaginatedPatients(pageNumber: number = 1, pageSize: number = 10, searchTerm?: string): Observable<PaginatedPatients> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (searchTerm && searchTerm.trim().length > 0) {
      params = params.set('searchTerm', searchTerm.trim());
    }

    return this.http.get<PaginatedPatients>(this.apiUrl, { params });
  }

  getPatientById(patientId: number): Observable<Patient> {
    return this.http.get<Patient>(`${this.apiUrl}/${patientId}`);
  }

  getPatientByUserId(userId: number): Observable<Patient> {
    return this.http.get<Patient>(`${this.apiUrl}/user/${userId}`);
  }

  getPatientFullDetails(patientId: number, appointmentId?: number): Observable<PatientFullDetails> {
    const params: any = {};
    if (appointmentId) {
      params.appointmentId = appointmentId;
    }
    return this.http.get<PatientFullDetails>(`${this.apiUrl}/${patientId}/full-details`, { params });
  }

  createPatient(patient: any): Observable<Patient> {
    return this.http.post<Patient>(this.apiUrl, patient);
  }

  updatePatient(patientId: number, patient: any): Observable<Patient> {
    return this.http.put<Patient>(`${this.apiUrl}/${patientId}`, patient);
  }

  softDeletePatient(patientId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${patientId}`);
  }

  addVital(patientId: number, vital: PatientVital): Observable<PatientVital> {
    return this.http.post<PatientVital>(`${this.apiUrl}/${patientId}/vitals`, vital);
  }

  addMedicalHistory(patientId: number, history: PatientMedicalHistory): Observable<PatientMedicalHistory> {
    return this.http.post<PatientMedicalHistory>(`${this.apiUrl}/${patientId}/medical-history`, history);
  }
}
