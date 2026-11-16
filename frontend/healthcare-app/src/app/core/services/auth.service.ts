import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User, LoginResponse, ForgotPasswordResponse, UpdateProfileRequest, UpdateProfileResponse } from '../models/user.model';
import { DoctorInfo } from '../models/appointment.model';
export type { DoctorInfo };

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000/api/auth';
  
  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        const user: User = {
          userId: res.userId,
          fullName: res.fullName,
          email: res.email,
          role: res.role,
          phoneNumber: res.phoneNumber,
          departmentId: res.departmentId,
          departmentName: res.departmentName,
          jobTitle: res.jobTitle,
          workSchedule: res.workSchedule,
          workLocation: res.workLocation,
          token: res.token
        };
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('token', res.token);
        this.currentUserSubject.next(user);
      })
    );
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/forgot-password`, { email });
  }

  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-otp`, { email, otp });
  }

  resetPassword(payload: { email: string; otp: string; newPassword: string; confirmPassword: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-reset-password`, payload);
  }

  getDoctors(): Observable<DoctorInfo[]> {
    return this.http.get<DoctorInfo[]>(`${this.apiUrl}/doctors`);
  }

  getDepartments(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/departments`);
  }

  getUserProfile(userId: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${userId}`).pipe(
      tap(profile => this.mergeAndPersistUser(profile))
    );
  }

  updateUserProfile(userId: number, payload: UpdateProfileRequest): Observable<UpdateProfileResponse> {
    return this.http.put<UpdateProfileResponse>(`${this.apiUrl}/users/${userId}/profile`, payload).pipe(
      tap(res => {
        if (res?.profile) {
          this.mergeAndPersistUser(res.profile);
        }
      })
    );
  }

  private mergeAndPersistUser(profile: Partial<User>): void {
    const existing = this.currentUserSubject.value;
    const merged: User = {
      ...(existing || ({} as User)),
      ...profile,
      token: existing?.token || localStorage.getItem('token') || undefined
    };
    localStorage.setItem('currentUser', JSON.stringify(merged));
    this.currentUserSubject.next(merged);
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
  }

  private getUserFromStorage(): User | null {
    const stored = localStorage.getItem('currentUser');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  hasRole(role: string): boolean {
    const user = this.currentUserValue;
    return !!user && user.role?.toLowerCase() === role.toLowerCase();
  }
}
