import { DoctorLeaveService } from '../../core/services/doctor-leave.service';
import { DoctorLeave } from '../../core/models/doctor-leave.model';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { readValidQueryParam, writeQueryParam } from '../../core/utils/view-query.util';
import { PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';
import { PatientService } from '../../core/services/patient.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { Patient } from '../../core/models/patient.model';
import { Appointment } from '../../core/models/appointment.model';
import { User } from '../../core/models/user.model';
import { SharedModule } from '../../shared/shared.module';
import { EditStaffProfileModalComponent } from '../../shared/edit-staff-profile-modal/edit-staff-profile-modal.component';
import { AiService } from '../../core/services/ai.service';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  imports: [
    SharedModule,
    EditStaffProfileModalComponent
  ],
  templateUrl: './doctor-dashboard.component.html',
  styleUrl: './doctor-dashboard.component.scss'
})
export class DoctorDashboardComponent implements OnInit {
  currentUser: User | null = null;
  private readonly allowedViews = ['appointments', 'rescheduled', 'my-patients', 'leave'] as const;
  currentView: 'appointments' | 'rescheduled' | 'my-patients' | 'leave' = 'appointments';

  // Leave Management State
  leaveSubTab: 'future' | 'short' = 'future';
  minLeaveDate: string = new Date().toISOString().split('T')[0];
  futureStartDate: string = '';
  futureEndDate: string = '';
  futureLeaveType: string = 'Annual Leave';
  futureReason: string = '';

  shortDate: string = '';
  shortLeaveMode: 'half-morning' | 'half-afternoon' | 'short-custom' = 'half-morning';
  shortStartTime: string = '10:00 AM';
  shortEndTime: string = '01:00 PM';
  shortReason: string = '';

  futureLeaves: DoctorLeave[] = [];
  shortLeaves: DoctorLeave[] = [];
  isSubmittingLeave: boolean = false;

  // Patients pagination state
  patients: Patient[] = [];
  totalPatients = 0;
  pageNumber = 1;
  pageSize = 10;
  searchTerm = '';
  isLoadingPatients = false;
  patientLoadError: string | null = null;
  patientColumns = ['id', 'name', 'contact', 'adhar', 'age', 'problem', 'actions'];

  // Appointments State
  allAppointments: Appointment[] = [];
  newAppointments: Appointment[] = [];
  rescheduledAppointments: Appointment[] = [];
  filteredDayAppointments: Appointment[] = [];

  // Day Filter State (Requirement: Doctor dashboard appointments organized by day with top-corner selector)
  selectedDayFilter: 'today' | 'tomorrow' | 'custom' | 'all' = 'today';
  selectedDate: string = '';
  selectedDayLabel: string = 'Today';
  appointmentStatusSubFilter: 'all' | 'confirmed' | 'rescheduled' | 'done' = 'all';

  // AI Summary State for Dashboard
  selectedPatientForAi: Patient | null = null;
  aiSummary: string = '';
  renderedAiSummary: SafeHtml = '';
  isAiGenerating = false;
  aiError: string | null = null;
  showAiModal = false;
  showEditProfileModal = false;

  constructor(
    private authService: AuthService,
    private patientService: PatientService,
    private appointmentService: AppointmentService,
    private aiService: AiService,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private doctorLeaveService: DoctorLeaveService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.currentView = readValidQueryParam(this.route, 'view', this.allowedViews, 'appointments');
    this.initDayFilter();
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser = user;
        this.cdr.detectChanges();
      }
    });
    if (this.currentUser?.userId) {
      this.authService.getUserProfile(this.currentUser.userId).subscribe({
        error: () => {}
      });
    }
    this.loadAppointments();
    this.loadPatients();
    this.loadDoctorLeaves();
  }

  openEditProfileModal(): void {
    this.showEditProfileModal = true;
    this.cdr.detectChanges();
  }

  closeEditProfileModal(): void {
    this.showEditProfileModal = false;
    this.cdr.detectChanges();
  }

  onProfileSaved(updated: User): void {
    this.currentUser = updated;
    this.cdr.detectChanges();
  }

  setView(view: 'appointments' | 'rescheduled' | 'my-patients' | 'leave'): void {
    this.currentView = view;
    writeQueryParam(this.router, this.route, 'view', view);
    if (view === 'leave') {
      this.loadDoctorLeaves();
    } else if (view === 'my-patients') {
      this.loadPatients();
    } else {
      this.loadAppointments();
    }
    this.cdr.detectChanges();
  }

  loadPatients(): void {
    this.isLoadingPatients = true;
    this.patientLoadError = null;
    this.cdr.detectChanges();

    this.patientService.getPaginatedPatients(this.pageNumber, this.pageSize, this.searchTerm).subscribe({
      next: (res) => {
        this.patients = res.items || [];
        this.totalPatients = res.totalCount || 0;
        this.isLoadingPatients = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingPatients = false;
        this.patientLoadError = 'Could not retrieve patient records. Please verify the backend microservices are running on port 5000.';
        this.snackBar.open('Error loading patients from backend.', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  private searchDebounceTimer: any;

  onSearch(): void {
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.pageNumber = 1;
    this.loadPatients();
  }

  onSearchInput(): void {
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.pageNumber = 1;
      this.loadPatients();
    }, 350);
  }

  clearSearch(): void {
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchTerm = '';
    this.pageNumber = 1;
    this.loadPatients();
  }

  onPageChange(event: PageEvent): void {
    this.pageNumber = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadPatients();
  }

  private formatDateToIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getTodayString(): string {
    return this.formatDateToIso(new Date());
  }

  getTomorrowString(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return this.formatDateToIso(d);
  }

  initDayFilter(): void {
    if (!this.selectedDate) {
      this.selectedDate = this.getTodayString();
    }
    this.updateDayLabel();
  }

  setDayFilter(filter: 'today' | 'tomorrow' | 'custom' | 'all', customDate?: string): void {
    this.selectedDayFilter = filter;
    if (filter === 'today') {
      this.selectedDate = this.getTodayString();
    } else if (filter === 'tomorrow') {
      this.selectedDate = this.getTomorrowString();
    } else if (filter === 'custom' && customDate) {
      this.selectedDate = customDate;
    }
    this.updateDayLabel();
    this.applyDayFilter();
    this.cdr.detectChanges();
  }

  onCustomDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input?.value) {
      this.selectedDate = input.value;
      this.selectedDayFilter = 'custom';
      this.updateDayLabel();
      this.applyDayFilter();
      this.cdr.detectChanges();
    }
  }

  goToPreviousDay(): void {
    const baseDate = this.selectedDate ? new Date(this.selectedDate + 'T00:00:00') : new Date();
    baseDate.setDate(baseDate.getDate() - 1);
    this.selectedDate = this.formatDateToIso(baseDate);
    this.selectedDayFilter = this.selectedDate === this.getTodayString() ? 'today' : 'custom';
    this.updateDayLabel();
    this.applyDayFilter();
    this.cdr.detectChanges();
  }

  goToNextDay(): void {
    const baseDate = this.selectedDate ? new Date(this.selectedDate + 'T00:00:00') : new Date();
    baseDate.setDate(baseDate.getDate() + 1);
    this.selectedDate = this.formatDateToIso(baseDate);
    this.selectedDayFilter = this.selectedDate === this.getTodayString() 
      ? 'today' 
      : (this.selectedDate === this.getTomorrowString() ? 'tomorrow' : 'custom');
    this.updateDayLabel();
    this.applyDayFilter();
    this.cdr.detectChanges();
  }

  private updateDayLabel(): void {
    if (this.selectedDayFilter === 'all') {
      this.selectedDayLabel = 'All Scheduled Days';
      return;
    }
    if (this.selectedDayFilter === 'today') {
      const now = new Date();
      this.selectedDayLabel = `Today (${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })})`;
      return;
    }
    if (this.selectedDayFilter === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      this.selectedDayLabel = `Tomorrow (${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })})`;
      return;
    }
    if (this.selectedDate) {
      const d = new Date(this.selectedDate + 'T00:00:00');
      this.selectedDayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      this.selectedDayLabel = 'Selected Date';
    }
  }

  setAppointmentStatusSubFilter(status: 'all' | 'confirmed' | 'rescheduled' | 'done'): void {
    this.appointmentStatusSubFilter = status;
    this.applyDayFilter();
    this.cdr.detectChanges();
  }

  private getApptDateKey(dateStr: any): string {
    if (!dateStr) return '';
    if (typeof dateStr === 'string') {
      return dateStr.split('T')[0];
    }
    return this.formatDateToIso(new Date(dateStr));
  }

  private parseTimeToMinutes(timeStr?: string): number {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return 0;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  applyDayFilter(): void {
    let list = [...this.allAppointments];

    // Day filter
    if (this.selectedDayFilter !== 'all') {
      const targetDate = this.selectedDate || this.getTodayString();
      list = list.filter(a => this.getApptDateKey(a.appointmentDate) === targetDate);
    }

    // Status subfilter
    if (this.appointmentStatusSubFilter === 'confirmed') {
      list = list.filter(a => {
        const s = a.status?.toLowerCase();
        return s === 'approved' || s === 'doctorconfirmed' || s === 'nurseapproved';
      });
    } else if (this.appointmentStatusSubFilter === 'rescheduled') {
      list = list.filter(a => a.status?.toLowerCase() === 'rescheduled');
    } else if (this.appointmentStatusSubFilter === 'done') {
      list = list.filter(a => a.status?.toLowerCase() === 'done');
    }

    // Sort chronologically by time
    list.sort((a, b) => {
      const dateDiff = (a.appointmentDate || '').localeCompare(b.appointmentDate || '');
      if (dateDiff !== 0) return dateDiff;
      return this.parseTimeToMinutes(a.appointmentTime) - this.parseTimeToMinutes(b.appointmentTime);
    });

    this.filteredDayAppointments = list;
  }

  loadAppointments(): void {
    const doctorId = this.currentUser?.userId;

    this.appointmentService.getAppointments(doctorId).subscribe({
      next: (res) => {
        const list = res || [];
        this.allAppointments = list;
        this.newAppointments = list.filter(a => {
          const s = a.status?.toLowerCase();
          return s === 'doctorconfirmed' || s === 'approved' || s === 'nurseapproved';
        });
        this.rescheduledAppointments = list.filter(a => a.status?.toLowerCase() === 'rescheduled');
        this.applyDayFilter();
        this.cdr.detectChanges();
      }
    });
  }

  openAiSummaryForAppt(appt: Appointment): void {
    const dummyPatient: Patient = {
      patientID: appt.patientId,
      userId: 0,
      prefix: '',
      firstName: appt.patientName,
      lastName: '',
      phoneNumber: appt.patientPhone,
      email: appt.patientEmail,
      dateOfBirth: '',
      age: 0,
      gender: '',
      adharNumber: '',
      problem: appt.reason || '',
      anyMedicalHistory: '',
      isDeleted: false,
      createdAt: new Date().toISOString()
    };
    this.openAiSummary(dummyPatient);
  }

  navigateToPatientDetails(patientId: number, appointmentId?: number): void {
    if (appointmentId) {
      this.router.navigate(['/patient-details', patientId], { queryParams: { appointmentId } });
    } else {
      this.router.navigate(['/patient-details', patientId]);
    }
  }

  openPatientInNewTab(patientId: number, appointmentId?: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const queryParams = appointmentId ? { appointmentId } : undefined;
    const url = this.router.serializeUrl(this.router.createUrlTree(['/patient-details', patientId], { queryParams }));
    window.open(url, '_blank');
  }

  openPatientDetails(patient: Patient): void {
    this.navigateToPatientDetails(patient.patientID);
  }

  viewPatientById(patientId: number, appointmentId?: number): void {
    this.navigateToPatientDetails(patientId, appointmentId);
  }

  confirmDoctorAppointment(appt: Appointment): void {
    this.appointmentService.doctorConfirm(appt.appointmentId, 'Confirmed by Dr. ' + (this.currentUser?.fullName || 'Doctor')).subscribe({
      next: () => {
        this.snackBar.open('Appointment confirmed successfully!', 'OK', { duration: 3000 });
        this.loadAppointments();
      },
      error: () => {
        this.snackBar.open('Failed to confirm appointment.', 'Close', { duration: 3000 });
      }
    });
  }

  cancelDoctorAppointment(appt: Appointment): void {
    if (confirm(`Are you sure you want to cancel the rescheduled appointment for ${appt.patientName}?`)) {
      this.appointmentService.cancelAppointment(appt.appointmentId, 'Declined/Cancelled by Dr. ' + (this.currentUser?.fullName || 'Doctor')).subscribe({
        next: () => {
          this.snackBar.open('Appointment cancelled successfully.', 'OK', { duration: 3000 });
          this.loadAppointments();
        },
        error: () => {
          this.snackBar.open('Failed to cancel appointment.', 'Close', { duration: 3000 });
        }
      });
    }
  }

  confirmSoftDelete(patient: Patient): void {
    const confirmed = confirm(`Are you sure you want to soft-delete patient ${patient.firstName} ${patient.lastName}?\n\nNote: The record will be safely archived without losing clinical history.`);
    if (confirmed) {
      this.patientService.softDeletePatient(patient.patientID).subscribe({
        next: (res) => {
          this.snackBar.open(res?.message || `Patient ${patient.firstName} ${patient.lastName} successfully soft-deleted.`, 'OK', { duration: 3500 });
          this.loadPatients();
        },
        error: (err) => {
          const msg = err.error?.message || 'Failed to delete patient.';
          this.snackBar.open(msg, 'Close', { duration: 3500 });
        }
      });
    }
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'requested': return 'status-requested';
      case 'nurseapproved': return 'status-approved';
      case 'doctorconfirmed': return 'status-confirmed';
      case 'rescheduled': return 'status-rescheduled';
      default: return '';
    }
  }

  openAiSummary(patient: Patient): void {
    this.selectedPatientForAi = patient;
    this.showAiModal = true;
    this.isAiGenerating = true;
    this.aiSummary = '';
    this.renderedAiSummary = '';
    this.aiError = null;
    this.cdr.detectChanges();

    this.aiService.streamPatientSummary(
      patient.patientID,
      (chunk: string) => {
        this.aiSummary += chunk;
        const html = marked.parse(this.aiSummary) as string;
        this.renderedAiSummary = this.sanitizer.bypassSecurityTrustHtml(html);
        this.cdr.detectChanges();
      },
      () => {
        this.isAiGenerating = false;
        const html = marked.parse(this.aiSummary) as string;
        this.renderedAiSummary = this.sanitizer.bypassSecurityTrustHtml(html);
        this.cdr.detectChanges();
      },
      (err: any) => {
        this.isAiGenerating = false;
        this.aiError = err?.message || 'Failed to generate AI summary.';
        this.cdr.detectChanges();
      }
    );
  }

  closeAiModal(): void {
    this.showAiModal = false;
    this.selectedPatientForAi = null;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // ==========================================
  // DOCTOR LEAVE MANAGEMENT
  // ==========================================
  setLeaveSubTab(tab: 'future' | 'short'): void {
    this.leaveSubTab = tab;
    this.cdr.detectChanges();
  }

  loadDoctorLeaves(): void {
    const doctorId = Number(this.currentUser?.userId || 1);
    this.doctorLeaveService.getDoctorLeaves(doctorId).subscribe({
      next: (leaves) => {
        const active = leaves.filter(l => l.status !== 'Cancelled');
        this.futureLeaves = active.filter(l => l.leaveCategory === 'future');
        this.shortLeaves = active.filter(l => l.leaveCategory === 'half-day' || l.leaveCategory === 'short');
        this.cdr.detectChanges();
      }
    });
  }

  onFutureStartDateChange(): void {
    if (this.futureStartDate && (!this.futureEndDate || this.futureEndDate < this.futureStartDate)) {
      this.futureEndDate = this.futureStartDate;
    }
    this.cdr.detectChanges();
  }

  applyFutureLeave(): void {
    if (!this.futureStartDate || !this.futureEndDate || !this.futureReason.trim()) {
      this.snackBar.open('Please fill out all required fields for future leave.', 'Close', { duration: 3000 });
      return;
    }

    if (this.futureEndDate < this.futureStartDate) {
      this.snackBar.open('To Date cannot be earlier than From Date.', 'Close', { duration: 3000 });
      return;
    }

    this.isSubmittingLeave = true;
    const doctorId = Number(this.currentUser?.userId || 1);
    const doctorName = this.currentUser?.fullName || 'Dr. Sarah Johnson (MD, Cardiology)';

    this.doctorLeaveService.applyLeave({
      doctorId,
      doctorName,
      leaveCategory: 'future',
      leaveType: this.futureLeaveType,
      startDate: this.futureStartDate,
      endDate: this.futureEndDate,
      reason: this.futureReason.trim()
    }).subscribe({
      next: () => {
        this.isSubmittingLeave = false;
        this.snackBar.open(`Future leave successfully applied from ${this.futureStartDate} to ${this.futureEndDate}. Front Desk & Nursing will block slots.`, 'OK', { duration: 4000 });
        this.futureStartDate = '';
        this.futureEndDate = '';
        this.futureReason = '';
        this.loadDoctorLeaves();
      },
      error: () => {
        this.isSubmittingLeave = false;
        this.snackBar.open('Error applying for leave.', 'Close', { duration: 3000 });
      }
    });
  }

  applyShortLeave(): void {
    if (!this.shortDate || !this.shortReason.trim()) {
      this.snackBar.open('Please select a date and specify reason for short / half-day leave.', 'Close', { duration: 3000 });
      return;
    }

    this.isSubmittingLeave = true;
    const doctorId = Number(this.currentUser?.userId || 1);
    const doctorName = this.currentUser?.fullName || 'Dr. Sarah Johnson (MD, Cardiology)';

    let category: 'half-day' | 'short' = 'half-day';
    let session: 'Morning' | 'Afternoon' | undefined = undefined;
    let sTime: string | undefined = undefined;
    let eTime: string | undefined = undefined;

    if (this.shortLeaveMode === 'half-morning') {
      category = 'half-day';
      session = 'Morning';
      sTime = '09:00 AM';
      eTime = '01:00 PM';
    } else if (this.shortLeaveMode === 'half-afternoon') {
      category = 'half-day';
      session = 'Afternoon';
      sTime = '02:00 PM';
      eTime = '05:00 PM';
    } else {
      category = 'short';
      sTime = this.shortStartTime;
      eTime = this.shortEndTime;
    }

    this.doctorLeaveService.applyLeave({
      doctorId,
      doctorName,
      leaveCategory: category,
      leaveType: category === 'half-day' ? `Half-Day (${session})` : 'Short Leave',
      startDate: this.shortDate,
      endDate: this.shortDate,
      halfDaySession: session,
      startTime: sTime,
      endTime: eTime,
      reason: this.shortReason.trim()
    }).subscribe({
      next: () => {
        this.isSubmittingLeave = false;
        this.snackBar.open(`Short/Half-day leave applied for ${this.shortDate}. Affected consultation slots are blocked.`, 'OK', { duration: 4000 });
        this.shortDate = '';
        this.shortReason = '';
        this.loadDoctorLeaves();
      },
      error: () => {
        this.isSubmittingLeave = false;
        this.snackBar.open('Error applying for short leave.', 'Close', { duration: 3000 });
      }
    });
  }

  cancelDoctorLeave(leaveId: number | string): void {
    this.doctorLeaveService.cancelLeave(leaveId).subscribe({
      next: () => {
        this.snackBar.open('Leave request has been cancelled. Slots are now open.', 'OK', { duration: 3500 });
        this.loadDoctorLeaves();
      }
    });
  }

}
