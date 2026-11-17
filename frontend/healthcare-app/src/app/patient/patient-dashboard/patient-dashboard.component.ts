import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { readValidQueryParam, writeQueryParam } from '../../core/utils/view-query.util';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';
import { PatientService } from '../../core/services/patient.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { Patient } from '../../core/models/patient.model';
import { Appointment, DoctorInfo, DoctorSlot } from '../../core/models/appointment.model';
import { User } from '../../core/models/user.model';
import { SharedModule } from '../../shared/shared.module';
import { AiService } from '../../core/services/ai.service';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss'
})
export class PatientDashboardComponent implements OnInit {
  currentUser: User | null = null;
  currentPatient: Patient | null = null;
  private readonly tabKeys = ['appointments', 'book', 'profile'] as const;
  activeTab: 0 | 1 | 2 = 0;
  isSubmitting = false;

  minDate = new Date();
  todayStr = new Date().toISOString().split('T')[0];

  doctors: DoctorInfo[] = [];
  appointments: Appointment[] = [];
  availableSlots: DoctorSlot[] = [];
  isLoadingSlots = false;

  bookingForm: FormGroup;
  patientDetailsForm: FormGroup;

  // AI Patient Features State
  showAiSummaryModal = false;
  showAiChatModal = false;
  aiPatientSummary = '';
  renderedAiPatientSummary: SafeHtml = '';
  isAiGeneratingSummary = false;
  aiSummaryError: string | null = null;

  userQuery = '';
  aiChatAnswer = '';
  renderedAiChatAnswer: SafeHtml = '';
  isAiChatting = false;
  aiChatError: string | null = null;

  constructor(
    private authService: AuthService,
    private patientService: PatientService,
    private appointmentService: AppointmentService,
    private aiService: AiService,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUser = this.authService.currentUserValue;

    this.bookingForm = this.fb.group({
      doctorId: ['', Validators.required],
      appointmentDate: [new Date(), Validators.required],
      durationMinutes: [30, Validators.required],
      appointmentTime: ['', Validators.required],
      reason: ['', Validators.required],
      medicalHistory: [''],
      treatment: ['']
    });

    this.patientDetailsForm = this.fb.group({
      prefix: ['Mr.', Validators.required],
      firstName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s]+$/)]],
      lastName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s]+$/)]],
      gender: ['Male', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      adharNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{12}$/)]],
      dateOfBirth: [new Date('1995-01-01'), Validators.required],
      age: [31, [Validators.required, Validators.min(0)]]
    });
  }

  sanitizePatientName(field: 'firstName' | 'lastName'): void {
    const val = this.patientDetailsForm.get(field)?.value || '';
    const clean = val.replace(/[^a-zA-Z\s]/g, '');
    if (clean !== val) {
      this.patientDetailsForm.get(field)?.setValue(clean, { emitEvent: false });
    }
  }

  sanitizePatientPhone(): void {
    const val = this.patientDetailsForm.get('phoneNumber')?.value || '';
    const clean = val.replace(/[^0-9]/g, '').slice(0, 10);
    if (clean !== val) {
      this.patientDetailsForm.get('phoneNumber')?.setValue(clean, { emitEvent: false });
    }
  }

  sanitizePatientAdhar(): void {
    const val = this.patientDetailsForm.get('adharNumber')?.value || '';
    const clean = val.replace(/[^0-9]/g, '').slice(0, 12);
    if (clean !== val) {
      this.patientDetailsForm.get('adharNumber')?.setValue(clean, { emitEvent: false });
    }
  }

  ngOnInit(): void {
    const initialTabKey = readValidQueryParam(this.route, 'tab', this.tabKeys, 'appointments');
    this.activeTab = this.tabKeys.indexOf(initialTabKey) as 0 | 1 | 2;
    this.loadProfile();
    this.loadDoctors();

    this.bookingForm.get('doctorId')?.valueChanges.subscribe(() => this.loadDoctorAvailableSlots());
    this.bookingForm.get('appointmentDate')?.valueChanges.subscribe(() => this.loadDoctorAvailableSlots());
    this.bookingForm.get('durationMinutes')?.valueChanges.subscribe(() => this.loadDoctorAvailableSlots());
  }

  setActiveTab(tab: 0 | 1 | 2): void {
    this.activeTab = tab;
    writeQueryParam(this.router, this.route, 'tab', this.tabKeys[tab]);
    this.cdr.detectChanges();
  }

  loadProfile(): void {
    if (!this.currentUser) return;

    this.patientService.getPatientByUserId(this.currentUser.userId).subscribe({
      next: (p) => {
        this.currentPatient = p;
        this.patientDetailsForm.patchValue({
          prefix: p.prefix || 'Mr.',
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender || 'Male',
          phoneNumber: p.phoneNumber,
          email: p.email,
          adharNumber: p.adharNumber,
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : new Date('1995-01-01'),
          age: p.age
        });
        if (p.anyMedicalHistory) {
          this.bookingForm.patchValue({ medicalHistory: p.anyMedicalHistory });
        }
        this.loadAppointments();
        this.cdr.detectChanges();
      },
      error: () => {
        // Patient profile not yet created -> prefill with user info and prompt to edit
        const names = (this.currentUser?.fullName || '').split(' ');
        this.patientDetailsForm.patchValue({
          firstName: names[0] || '',
          lastName: names.slice(1).join(' ') || '',
          email: this.currentUser?.email || '',
          phoneNumber: this.currentUser?.phoneNumber || '',
          gender: 'Male'
        });
        this.setActiveTab(2);
        this.cdr.detectChanges();
      }
    });
  }

  loadDoctors(): void {
    this.authService.getDoctors().subscribe({
      next: (docs) => {
        this.doctors = docs || [];
        if (this.doctors.length > 0 && !this.bookingForm.get('doctorId')?.value) {
          this.bookingForm.patchValue({ doctorId: this.doctors[0].userId });
          this.loadDoctorAvailableSlots();
        }
        this.cdr.detectChanges();
      }
    });
  }

  onDurationChange(duration: number): void {
    this.bookingForm.patchValue({ durationMinutes: duration });
    this.loadDoctorAvailableSlots();
  }

  loadDoctorAvailableSlots(): void {
    const docId = this.bookingForm.get('doctorId')?.value;
    const dateVal = this.bookingForm.get('appointmentDate')?.value;
    const duration = this.bookingForm.get('durationMinutes')?.value || 30;

    if (!docId || !dateVal) {
      this.availableSlots = [];
      return;
    }

    const formattedDate = this.formatDateForPayload(dateVal);
    this.isLoadingSlots = true;
    this.cdr.detectChanges();

    this.appointmentService.getDoctorSchedule(Number(docId), formattedDate, Number(duration)).subscribe({
      next: (res) => {
        this.availableSlots = res?.slots || [];
        this.isLoadingSlots = false;

        const currentSlot = this.bookingForm.get('appointmentTime')?.value;
        const matching = this.availableSlots.find(s => s.slotLabel === currentSlot);
        if (matching && matching.isBooked) {
          this.bookingForm.patchValue({ appointmentTime: '' });
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.availableSlots = [];
        this.isLoadingSlots = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadAppointments(): void {
    if (!this.currentPatient) return;

    this.appointmentService.getAppointments(undefined, this.currentPatient.patientID).subscribe({
      next: (res) => {
        this.appointments = res || [];
        this.cdr.detectChanges();
      }
    });
  }

  calculateAge(): void {
    const dobVal = this.patientDetailsForm.get('dateOfBirth')?.value;
    if (dobVal) {
      const dob = new Date(dobVal);
      if (!isNaN(dob.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        this.patientDetailsForm.patchValue({ age: Math.max(0, age) });
      }
    }
  }

  openEditProfile(): void {
    this.setActiveTab(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getInitials(): string {
    const p = this.currentPatient;
    if (!p) {
      const name = this.currentUser?.fullName || 'P';
      return name.slice(0, 2).toUpperCase();
    }
    const f = p.firstName ? p.firstName[0] : '';
    const l = p.lastName ? p.lastName[0] : '';
    return (f + l).toUpperCase() || 'PT';
  }

  formatDateForPayload(val: any): string {
    if (!val) return this.todayStr;
    if (val instanceof Date) {
      const year = val.getFullYear();
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const day = String(val.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof val === 'string' && val.includes('T')) {
      return val.split('T')[0];
    }
    return String(val);
  }

  onSaveProfile(): void {
    if (this.patientDetailsForm.invalid) return;

    this.isSubmitting = true;
    const formVal = {
      ...this.patientDetailsForm.value,
      problem: this.currentPatient?.problem || null,
      anyMedicalHistory: this.currentPatient?.anyMedicalHistory || null
    };
    formVal.dateOfBirth = this.formatDateForPayload(formVal.dateOfBirth);

    if (this.currentPatient) {
      // Update existing patient
      this.patientService.updatePatient(this.currentPatient.patientID, formVal).subscribe({
        next: (updated) => {
          this.isSubmitting = false;
          this.currentPatient = { ...this.currentPatient, ...updated };
          if (this.currentUser) {
            this.currentUser.fullName = `${updated.prefix} ${updated.firstName} ${updated.lastName}`.trim();
          }
          this.snackBar.open('Personal details updated successfully! Changes reflected in sidebar.', 'OK', { duration: 3500 });
          this.setActiveTab(0);
          this.cdr.detectChanges();
        },
        error: () => {
          this.isSubmitting = false;
          this.snackBar.open('Error saving profile.', 'Close', { duration: 3000 });
          this.cdr.detectChanges();
        }
      });
    } else {
      // Create new patient record linked to current user
      const createPayload = {
        userId: this.currentUser?.userId,
        ...formVal
      };
      this.patientService.createPatient(createPayload).subscribe({
        next: (created) => {
          this.isSubmitting = false;
          this.currentPatient = created;
          if (this.currentUser) {
            this.currentUser.fullName = `${created.prefix} ${created.firstName} ${created.lastName}`.trim();
          }
          this.snackBar.open('Profile details saved successfully!', 'OK', { duration: 3500 });
          this.setActiveTab(0);
          this.cdr.detectChanges();
        },
        error: () => {
          this.isSubmitting = false;
          this.snackBar.open('Failed to save profile.', 'Close', { duration: 3000 });
          this.cdr.detectChanges();
        }
      });
    }
  }

  get openSlotsCount(): number {
    return this.availableSlots.filter(s => !s.isBooked).length;
  }

  isSelectedSlotOpen(): boolean {
    const chosen = this.bookingForm.get('appointmentTime')?.value;
    if (!chosen) return false;
    const match = this.availableSlots.find(s => s.slotLabel === chosen);
    return !!match && !match.isBooked;
  }

  onBookAppointment(): void {
    if (this.bookingForm.invalid) return;

    if (this.openSlotsCount === 0 || !this.isSelectedSlotOpen()) {
      this.snackBar.open('Appointments can only be placed when a slot is open. Please select an available slot.', 'Close', { duration: 4000 });
      return;
    }

    if (!this.currentPatient) {
      this.snackBar.open('Please fill out your personal profile details first.', 'OK', { duration: 4000 });
      this.setActiveTab(2);
      return;
    }

    this.isSubmitting = true;
    const formVal = this.bookingForm.value;
    const formattedDate = this.formatDateForPayload(formVal.appointmentDate);

    const payload = {
      patientId: this.currentPatient.patientID,
      doctorId: Number(formVal.doctorId),
      appointmentDate: formattedDate,
      appointmentTime: formVal.appointmentTime,
      reason: formVal.reason,
      medicalHistory: formVal.medicalHistory,
      treatment: formVal.treatment
    };

    this.appointmentService.createAppointment(payload).subscribe({
      next: (appt) => {
        this.isSubmitting = false;
        this.snackBar.open('Appointment booked and confirmed! Your time slot is reserved.', 'OK', { duration: 4000 });

        // Update local patient chief problem & medical history so it immediately reflects in personal details and profile
        if (this.currentPatient) {
          if (payload.reason) {
            this.currentPatient.problem = payload.reason;
            this.patientDetailsForm.patchValue({ problem: payload.reason });
          }
          if (payload.medicalHistory) {
            if (!this.currentPatient.anyMedicalHistory) {
              this.currentPatient.anyMedicalHistory = payload.medicalHistory;
            } else if (!this.currentPatient.anyMedicalHistory.includes(payload.medicalHistory)) {
              this.currentPatient.anyMedicalHistory += `; ${payload.medicalHistory}`;
            }
            this.patientDetailsForm.patchValue({ anyMedicalHistory: this.currentPatient.anyMedicalHistory });
          }
        }

        this.bookingForm.reset({
          doctorId: '',
          appointmentDate: new Date(),
          durationMinutes: 30,
          appointmentTime: '',
          reason: '',
          medicalHistory: this.currentPatient?.anyMedicalHistory || '',
          treatment: ''
        });
        this.setActiveTab(0);
        this.loadAppointments();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err?.error?.message || 'Could not book appointment. Please choose an open time slot.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.loadDoctorAvailableSlots();
        this.cdr.detectChanges();
      }
    });
  }


  isStepCompleted(status: string, step: number): boolean {
    const s = status?.toLowerCase();
    if (s === 'cancelled') return false;
    if (step === 1) return true;
    if (step === 2) return s === 'done';
    return false;
  }

  getStatusColorClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'requested':
      case 'approved':
        return 'status-approved';
      case 'doctorconfirmed': return 'status-confirmed';
      case 'rescheduled': return 'status-rescheduled';
      case 'done': return 'status-approved';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-approved';
    }
  }

  getStatusDisplayName(status: string): string {
    switch (status?.toLowerCase()) {
      case 'requested':
      case 'approved':
      case 'doctorconfirmed':
        return 'Confirmed (Slot Booked)';
      case 'rescheduled': return 'Rescheduled';
      case 'done': return 'Consultation Completed (Done)';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }

  openAiPatientSummary(): void {
    const patientId = this.currentPatient?.patientID || (this.currentPatient as any)?.patientId;
    if (!patientId) {
      this.snackBar.open('Please make sure your patient profile is saved first.', 'Close', { duration: 3000 });
      return;
    }
    this.showAiSummaryModal = true;
    this.isAiGeneratingSummary = true;
    this.aiPatientSummary = '';
    this.renderedAiPatientSummary = '';
    this.aiSummaryError = null;
    this.cdr.detectChanges();

    this.aiService.streamPatientSummary(
      patientId,
      (chunk: string) => {
        this.aiPatientSummary += chunk;
        try {
          const parsed = marked.parse(this.aiPatientSummary);
          const html = typeof parsed === 'string' ? parsed : String(parsed);
          this.renderedAiPatientSummary = this.sanitizer.bypassSecurityTrustHtml(html);
        } catch {
          this.renderedAiPatientSummary = this.sanitizer.bypassSecurityTrustHtml(this.aiPatientSummary);
        }
        this.cdr.detectChanges();
      },
      () => {
        this.isAiGeneratingSummary = false;
        try {
          const parsed = marked.parse(this.aiPatientSummary);
          const html = typeof parsed === 'string' ? parsed : String(parsed);
          this.renderedAiPatientSummary = this.sanitizer.bypassSecurityTrustHtml(html);
        } catch {
          this.renderedAiPatientSummary = this.sanitizer.bypassSecurityTrustHtml(this.aiPatientSummary);
        }
        this.cdr.detectChanges();
      },
      (err: any) => {
        this.isAiGeneratingSummary = false;
        this.aiSummaryError = err?.message || 'Failed to generate your health summary.';
        this.cdr.detectChanges();
      }
    );
  }

  closeAiSummaryModal(): void {
    this.showAiSummaryModal = false;
  }

  openAiChatModal(): void {
    const patientId = this.currentPatient?.patientID || (this.currentPatient as any)?.patientId;
    if (!patientId) {
      this.snackBar.open('Please make sure your patient profile is saved first.', 'Close', { duration: 3000 });
      return;
    }
    this.showAiChatModal = true;
    this.userQuery = '';
    this.aiChatAnswer = '';
    this.renderedAiChatAnswer = '';
    this.aiChatError = null;
    this.cdr.detectChanges();
  }

  closeAiChatModal(): void {
    this.showAiChatModal = false;
  }

  askAiQuery(): void {
    const patientId = this.currentPatient?.patientID || (this.currentPatient as any)?.patientId;
    if (!this.userQuery.trim() || !patientId || this.isAiChatting) return;

    this.isAiChatting = true;
    this.aiChatAnswer = '';
    this.renderedAiChatAnswer = '';
    this.aiChatError = null;
    this.cdr.detectChanges();

    this.aiService.streamPatientChat(
      patientId,
      this.userQuery.trim(),
      (chunk: string) => {
        this.aiChatAnswer += chunk;
        try {
          const parsed = marked.parse(this.aiChatAnswer);
          const html = typeof parsed === 'string' ? parsed : String(parsed);
          this.renderedAiChatAnswer = this.sanitizer.bypassSecurityTrustHtml(html);
        } catch {
          this.renderedAiChatAnswer = this.sanitizer.bypassSecurityTrustHtml(this.aiChatAnswer);
        }
        this.cdr.detectChanges();
      },
      () => {
        this.isAiChatting = false;
        try {
          const parsed = marked.parse(this.aiChatAnswer);
          const html = typeof parsed === 'string' ? parsed : String(parsed);
          this.renderedAiChatAnswer = this.sanitizer.bypassSecurityTrustHtml(html);
        } catch {
          this.renderedAiChatAnswer = this.sanitizer.bypassSecurityTrustHtml(this.aiChatAnswer);
        }
        this.cdr.detectChanges();
      },
      (err: any) => {
        this.isAiChatting = false;
        this.aiChatError = err?.message || 'Failed to get answer from AI.';
        this.cdr.detectChanges();
      }
    );
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
