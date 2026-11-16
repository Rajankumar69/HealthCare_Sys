import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { DoctorLeave } from '../models/doctor-leave.model';

@Injectable({
  providedIn: 'root'
})
export class DoctorLeaveService {
  private readonly baseUrl = 'http://localhost:5000/api/healthcare/appointments/doctor-leaves';
  private leavesSubject = new BehaviorSubject<DoctorLeave[]>([]);
  public leaves$ = this.leavesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.refreshAllLeaves();
  }

  public refreshAllLeaves(): void {
    this.http.get<DoctorLeave[]>(this.baseUrl).pipe(
      catchError(err => {
        console.warn('Could not load leaves from backend database, using cached/empty', err);
        return of([]);
      })
    ).subscribe(leaves => {
      if (leaves && leaves.length > 0) {
        this.leavesSubject.next(leaves);
      }
    });
  }

  getDoctorLeaves(doctorId?: number): Observable<DoctorLeave[]> {
    let params = new HttpParams();
    if (doctorId && doctorId > 0) {
      params = params.set('doctorId', doctorId.toString());
    }

    return this.http.get<DoctorLeave[]>(this.baseUrl, { params }).pipe(
      tap(leaves => {
        const current = this.leavesSubject.value;
        // Merge or replace leaves
        const otherDocs = current.filter(l => doctorId && Number(l.doctorId) !== Number(doctorId));
        this.leavesSubject.next([...otherDocs, ...leaves]);
      }),
      catchError(err => {
        console.warn('Failed to fetch doctor leaves from backend', err);
        const filtered = this.leavesSubject.value.filter(
          l => (!doctorId || Number(l.doctorId) === Number(doctorId)) && l.status !== 'Cancelled'
        );
        return of(filtered);
      })
    );
  }

  applyLeave(leave: {
    doctorId: number;
    doctorName?: string;
    leaveCategory: 'future' | 'half-day' | 'short';
    leaveType: string;
    startDate: string;
    endDate: string;
    halfDaySession?: 'Morning' | 'Afternoon';
    startTime?: string;
    endTime?: string;
    reason: string;
  }): Observable<DoctorLeave> {
    return this.http.post<DoctorLeave>(this.baseUrl, leave).pipe(
      tap(created => {
        const current = this.leavesSubject.value;
        this.leavesSubject.next([created, ...current]);
      })
    );
  }

  cancelLeave(leaveId: number | string): Observable<any> {
    return this.http.put(`${this.baseUrl}/${leaveId}/cancel`, {}).pipe(
      tap(() => {
        const updated = this.leavesSubject.value.map(l =>
          l.leaveId == leaveId ? { ...l, status: 'Cancelled' as const } : l
        );
        this.leavesSubject.next(updated);
      })
    );
  }

  /**
   * Checks if doctor is on leave on a given date (YYYY-MM-DD or ISO string)
   */
  getDoctorLeaveForDate(doctorId: number | string | null | undefined, dateStr: string | null | undefined): DoctorLeave | null {
    if (!doctorId || !dateStr) return null;
    const numDocId = Number(doctorId);
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();

    const activeLeaves = this.leavesSubject.value.filter(
      l => Number(l.doctorId) === numDocId && l.status !== 'Cancelled'
    );

    for (const leave of activeLeaves) {
      const s = leave.startDate ? (leave.startDate.includes('T') ? leave.startDate.split('T')[0] : leave.startDate) : '';
      const e = leave.endDate ? (leave.endDate.includes('T') ? leave.endDate.split('T')[0] : leave.endDate) : s;

      if (cleanDate >= s && cleanDate <= e) {
        return leave;
      }
    }
    return null;
  }

  /**
   * Helper to check if a specific timeslot (e.g. "09:00 AM - 10:00 AM") is blocked by a doctor leave
   */
  isSlotBlockedByLeave(leave: DoctorLeave | null, slotLabel: string): { blocked: boolean; reason?: string } {
    if (!leave) return { blocked: false };

    // Full day / future leave blocks all slots of the day
    if (leave.leaveCategory === 'future') {
      return {
        blocked: true,
        reason: `Doctor on Full Day Leave (${leave.leaveType})`
      };
    }

    // Half day morning: 09:00 AM - 01:00 PM
    if (leave.leaveCategory === 'half-day' && leave.halfDaySession === 'Morning') {
      const isMorning = slotLabel.includes('AM') || slotLabel.startsWith('12:');
      if (isMorning) {
        return {
          blocked: true,
          reason: `Doctor on Morning Half-Day Leave (${leave.leaveType})`
        };
      }
      return { blocked: false };
    }

    // Half day afternoon: 02:00 PM - 05:00 PM
    if (leave.leaveCategory === 'half-day' && leave.halfDaySession === 'Afternoon') {
      const isAfternoon = slotLabel.includes('PM') && !slotLabel.startsWith('12:');
      if (isAfternoon) {
        return {
          blocked: true,
          reason: `Doctor on Afternoon Half-Day Leave (${leave.leaveType})`
        };
      }
      return { blocked: false };
    }

    // Short leave: checks interval overlap
    if (leave.leaveCategory === 'short' && leave.startTime && leave.endTime) {
      if (this.areTimeIntervalsOverlapping(slotLabel, `${leave.startTime} - ${leave.endTime}`)) {
        return {
          blocked: true,
          reason: `Doctor on Short Leave (${leave.startTime} - ${leave.endTime})`
        };
      }
    }

    return { blocked: false };
  }

  private areTimeIntervalsOverlapping(slotInterval: string, leaveInterval: string): boolean {
    try {
      const [slotStart, slotEnd] = this.parseInterval(slotInterval);
      const [leaveStart, leaveEnd] = this.parseInterval(leaveInterval);
      return Math.max(slotStart, leaveStart) < Math.min(slotEnd, leaveEnd);
    } catch {
      return false;
    }
  }

  private parseInterval(interval: string): [number, number] {
    const parts = interval.split('-').map(p => p.trim());
    const startM = this.parseTimeToMinutes(parts[0]);
    const endM = parts.length > 1 ? this.parseTimeToMinutes(parts[1]) : startM + 60;
    return [startM, endM];
  }

  private parseTimeToMinutes(timeStr: string): number {
    const upper = timeStr.toUpperCase();
    const isPm = upper.includes('PM');
    const isAm = upper.includes('AM');
    const clean = upper.replace('AM', '').replace('PM', '').trim();
    const [hStr, mStr] = clean.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr ? parseInt(mStr, 10) : 0;
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
    return h * 60 + m;
  }
}
