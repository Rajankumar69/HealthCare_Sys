import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminUsersResponse, AdminCreateUserRequest } from '../models/admin.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = '/api/auth/admin';

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<AdminUsersResponse> {
    return this.http.get<AdminUsersResponse>(`${this.apiUrl}/users`);
  }

  addUser(userData: AdminCreateUserRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/users`, userData);
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`);
  }

  getDepartments(): Observable<any[]> {
    return this.http.get<any[]>('/api/auth/departments');
  }
}
