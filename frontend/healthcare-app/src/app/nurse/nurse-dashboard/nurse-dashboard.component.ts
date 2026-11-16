import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { readValidQueryParam, writeQueryParam } from '../../core/utils/view-query.util';
import { PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';
import { PatientService } from '../../core/services/patient.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { Patient } from '../../core/models/patient.model';
import { Appointment, DoctorSlot } from '../../core/models/appointment.model';
import { DoctorLeave } from '../../core/models/doctor-leave.model';
import { DoctorLeaveService } from '../../core/services/doctor-leave.service';
import { User } from '../../core/models/user.model';
import { SharedModule } from '../../shared/shared.module';
import { EditStaffProfileModalComponent } from '../../shared/edit-staff-profile-modal/edit-staff-profile-modal.component';
import { AiService } from '../../core/services/ai.service';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-nurse-dashboard',
  standalone: true,
  imports: [
    SharedModule,
    EditStaffProfileModalComponent
  ],
  templateUrl: './nurse-dashboard.component.html',
  styleUrl: './nurse-dashboard.component.scss'
})
export class NurseDashboardComponent implements OnInit {
  currentUser: User | null = null;
  private readonly allowedViews = ['active-appointments', 'reschedule-appointments', 'done-appointments', 'my-patients', 'patients'] as const;
  currentView: 'active-appointments' | 'reschedule-appointments' | 'done-appointments' | 'my-patients' | 'patients' = 'active-appointments';

  // Patients pagination
  patients: Patient[] = [];
  totalPatients = 0;
  pageNumber = 1;
  pageSize = 10;
  searchTerm = '';
  isLoadingPatients = false;
  patientLoadError: string | null = null;
  patientColumns = ['id', 'name', 'contact', 'adhar', 'age', 'problem', 'actions'];

  // Appointments
  activeAppointments: Appointment[] = [];
  doneAppointments: Appointment[] = [];
  rescheduledAppointments: Appointment[] = [];
  scheduledAppointments: Appointment[] = [];

  // Reschedule Card / Modal State
  selectedApptForReschedule: Appointment | null = null;
  rescheduleDate: string = '';
  rescheduleTime: string = '';
  rescheduleReason: string = '';
  rescheduleSlots: DoctorSlot[] = [];
  isLoadingRescheduleSlots: boolean = false;
  isSubmittingReschedule: boolean = false;
  minRescheduleDate: string = '';
  currentDoctorLeaveForReschedule: DoctorLeave | null = null;

  // AI Summary State for Nurse Dashboard
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
    private cdr: ChangeDetectorRef,
    private doctorLeaveService: DoctorLeaveService
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.currentView = readValidQueryParam(this.route, 'view', this.allowedViews, 'active-appointments');
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
    this.minRescheduleDate = new Date().toISOString().split('T')[0];
    this.loadAppointments();
    this.doctorLeaveService.refreshAllLeaves();
    this.loadPatients();
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

  setView(view: 'active-appointments' | 'reschedule-appointments' | 'done-appointments' | 'my-patients' | 'patients'): void {
    this.currentView = view;
    writeQueryParam(this.router, this.route, 'view', view);
    if (view === 'patients' || view === 'my-patients') {
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
        this.snackBar.open('Error loading patient directory.', 'Close', { duration: 3000 });
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

  loadAppointments(): void {
    this.appointmentService.getAppointments().subscribe({
      next: (res) => {
        const list = res || [];
        // Active appointments needing nursing vitals/care: Approved, DoctorConfirmed, Rescheduled, NurseApproved
        this.activeAppointments = list.filter(a => {
          const s = a.status?.toLowerCase();
          return s === 'approved' || s === 'doctorconfirmed' || s === 'rescheduled' || s === 'nurseapproved';
        });

        // Completed appointments
        this.doneAppointments = list.filter(a => a.status?.toLowerCase() === 'done');

        // Rescheduled
        this.rescheduledAppointments = list.filter(a => a.status?.toLowerCase() === 'rescheduled');

        this.scheduledAppointments = this.activeAppointments;

        this.cdr.detectChanges();
      }
    });
  }

  // Open the interactive date & time reschedule card for a patient
  openRescheduleCard(appt: Appointment): void {
    this.selectedApptForReschedule = appt;
    if (appt.appointmentDate) {
      const dt = appt.appointmentDate.split('T')[0];
      this.rescheduleDate = dt >= this.minRescheduleDate ? dt : this.minRescheduleDate;
    } else {
      this.rescheduleDate = this.minRescheduleDate;
    }
    this.rescheduleTime = appt.appointmentTime || '';
    this.rescheduleReason = '';
    this.loadRescheduleSlots();
    this.cdr.detectChanges();
  }

  onRescheduleDateChange(): void {
    if (this.rescheduleDate && this.rescheduleDate < this.minRescheduleDate) {
      this.rescheduleDate = this.minRescheduleDate;
      this.snackBar.open('Cannot pick a past date for rescheduling.', 'Close', { duration: 3000 });
    }
    this.loadRescheduleSlots();
  }

  loadRescheduleSlots(): void {
    if (!this.selectedApptForReschedule || !this.rescheduleDate) return;
    const docId = Number(this.selectedApptForReschedule.doctorId);
    this.currentDoctorLeaveForReschedule = this.doctorLeaveService.getDoctorLeaveForDate(
      docId,
      this.rescheduleDate
    );
    this.isLoadingRescheduleSlots = true;
    this.cdr.detectChanges();

    this.appointmentService.getDoctorSchedule(docId, this.rescheduleDate, 60).subscribe({
      next: (res) => {
        if (res && res.currentLeave) {
          this.currentDoctorLeaveForReschedule = res.currentLeave;
        } else if (!this.currentDoctorLeaveForReschedule) {
          this.currentDoctorLeaveForReschedule = this.doctorLeaveService.getDoctorLeaveForDate(docId, this.rescheduleDate);
        }
        this.rescheduleSlots = res?.slots || [];
        if (this.currentDoctorLeaveForReschedule && this.rescheduleSlots.length > 0) {
          this.rescheduleSlots.forEach(slot => {
            const leaveCheck = this.doctorLeaveService.isSlotBlockedByLeave(this.currentDoctorLeaveForReschedule, slot.slotLabel);
            if (leaveCheck.blocked) {
              slot.isBooked = true;
              slot.notes = leaveCheck.reason || 'Doctor on Leave';
            }
          });
        }
        this.isLoadingRescheduleSlots = false;

        const matching = this.rescheduleSlots.find(s => s.slotLabel === this.rescheduleTime);
        const isCurrentSlotAllowed = matching && (!matching.isBooked || matching.appointmentId === this.selectedApptForReschedule?.appointmentId);

        if (!isCurrentSlotAllowed) {
          const firstAvailable = this.rescheduleSlots.find(s => !s.isBooked || s.appointmentId === this.selectedApptForReschedule?.appointmentId);
          this.rescheduleTime = firstAvailable ? firstAvailable.slotLabel : '';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.rescheduleSlots = [];
        this.isLoadingRescheduleSlots = false;
        this.cdr.detectChanges();
      }
    });
  }

  isCurrentRescheduleSlotBooked(): boolean {
    if (this.currentDoctorLeaveForReschedule?.leaveCategory === 'future') return true;
    if (!this.rescheduleTime || this.rescheduleSlots.length === 0) return false;
    const matching = this.rescheduleSlots.find(s => s.slotLabel === this.rescheduleTime);
    if (!matching) return false;
    return matching.isBooked && matching.appointmentId !== this.selectedApptForReschedule?.appointmentId;
  }

  get availableSlotsCount(): number {
    return this.rescheduleSlots.filter(s => !s.isBooked || s.appointmentId === this.selectedApptForReschedule?.appointmentId).length;
  }

  closeRescheduleCard(): void {
    this.selectedApptForReschedule = null;
    this.rescheduleSlots = [];
    this.isLoadingRescheduleSlots = false;
    this.cdr.detectChanges();
  }

  submitReschedule(): void {
    if (!this.selectedApptForReschedule) return;

    if (!this.rescheduleDate || !this.rescheduleTime) {
      this.snackBar.open('Please select both a valid date and time slot.', 'Close', { duration: 3000 });
      return;
    }

    if (this.currentDoctorLeaveForReschedule?.leaveCategory === 'future') {
      this.snackBar.open(`Cannot reschedule: Dr. ${this.selectedApptForReschedule.doctorName} is on Leave on this date.`, 'Close', { duration: 4000 });
      return;
    }

    if (this.isCurrentRescheduleSlotBooked()) {
      this.snackBar.open('The selected time slot is already booked or doctor is on leave. Please choose an available time slot.', 'Close', { duration: 3500 });
      return;
    }

    const appt = this.selectedApptForReschedule;
    this.isSubmittingReschedule = true;
    const nurseTitle = this.currentUser?.fullName ? `Nurse ${this.currentUser.fullName}` : 'Nurse';
    const reasonText = this.rescheduleReason?.trim() 
      ? `${this.rescheduleReason.trim()} (Triage update by ${nurseTitle})`
      : `Slot adjusted by ${nurseTitle}`;

    this.appointmentService.rescheduleAppointment(appt.appointmentId, {
      newDate: this.rescheduleDate,
      newTime: this.rescheduleTime,
      reason: reasonText
    }).subscribe({
      next: () => {
        this.isSubmittingReschedule = false;
        this.snackBar.open(`Appointment for ${appt.patientName} successfully rescheduled and forwarded to Dr. ${appt.doctorName}!`, 'OK', { duration: 4000 });
        this.closeRescheduleCard();
        this.loadAppointments();
      },
      error: (err) => {
        this.isSubmittingReschedule = false;
        const msg = err.error?.message || 'Failed to reschedule appointment.';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
        this.loadRescheduleSlots();
        this.cdr.detectChanges();
      }
    });
  }

  // Nurse marks appointment as Done
  // Requirement: "nurses ke pass authority ho vo appointments ko done status de sake or reschedule kar sake"
  markAppointmentDone(appt: Appointment): void {
    const nurseTitle = this.currentUser?.fullName ? `Nurse ${this.currentUser.fullName}` : 'Nurse Staff';
    this.appointmentService.markAsDone(appt.appointmentId, `Clinical care completed by ${nurseTitle}`).subscribe({
      next: () => {
        this.snackBar.open(`Appointment for ${appt.patientName} marked as Done!`, 'OK', { duration: 3500 });
        this.loadAppointments();
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = err.error?.message || 'Failed to update appointment status to Done.';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
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

  // Nurse Shift Work Summary (Work Done & Pending Work)
  openNurseShiftReport(): void {
    this.selectedPatientForAi = null;
    this.showAiModal = true;
    this.isAiGenerating = true;
    this.aiSummary = '';
    this.renderedAiSummary = '';
    this.aiError = null;
    this.cdr.detectChanges();

    this.aiService.streamNurseShiftSummary(
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
        this.aiError = err?.message || 'Failed to generate Shift Handover Report.';
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
}
