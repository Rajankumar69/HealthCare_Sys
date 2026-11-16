import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { readValidQueryParam, writeQueryParam } from '../../core/utils/view-query.util';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { AuthService } from '../../core/services/auth.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { PatientService } from '../../core/services/patient.service';
import { User } from '../../core/models/user.model';
import { Appointment, DoctorInfo, DoctorSchedule, DoctorSlot } from '../../core/models/appointment.model';
import { DoctorLeave } from '../../core/models/doctor-leave.model';
import { DoctorLeaveService } from '../../core/services/doctor-leave.service';
import { Patient } from '../../core/models/patient.model';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-frontdesk-dashboard',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './frontdesk-dashboard.component.html',
  styleUrls: ['./frontdesk-dashboard.component.scss']
})
export class FrontdeskDashboardComponent implements OnInit {
  currentUser: User | null = null;
  private readonly allowedViews = ['chart', 'all-appointments', 'patients'] as const;
  currentView: 'chart' | 'all-appointments' | 'patients' = 'chart';

  // Doctors & Schedule
  doctors: DoctorInfo[] = [];
  selectedDoctorId: number | null = null;
  selectedDate: string = '';
  minBookingDate: string = '';
  doctorSchedule: DoctorSchedule | null = null;
  selectedDuration: number = 60;
  isLoadingSchedule = false;
  currentDoctorLeave: DoctorLeave | null = null;
  currentModalDoctorLeave: DoctorLeave | null = null;
  currentRescheduleDoctorLeave: DoctorLeave | null = null;

  // Appointment Lists
  allAppointments: Appointment[] = [];
  filteredAppointments: Appointment[] = [];
  filterStatus: string = 'ALL';
  apptSearchTerm: string = '';

  // Patient Directory
  patients: Patient[] = [];
  totalPatients = 0;
  patientPageNumber = 1;
  patientPageSize = 10;
  patientSearchTerm = '';
  isLoadingPatients = false;
  patientColumns = ['id', 'name', 'contact', 'age', 'gender', 'problem', 'actions'];

  // Quick Booking Modal State
  showBookingModal = false;
  isSubmittingBooking = false;
  bookingForm: FormGroup;
  modalSlots: DoctorSlot[] = [];
  isLoadingModalSlots = false;

  // Reschedule Modal State
  selectedApptForReschedule: Appointment | null = null;
  rescheduleDate: string = '';
  rescheduleTime: string = '09:00 AM - 10:00 AM';
  rescheduleReason: string = '';
  isSubmittingReschedule = false;
  rescheduleSlots: DoctorSlot[] = [];
  isLoadingRescheduleSlots = false;

  standardSlots: string[] = [
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM',
    '02:00 PM - 03:00 PM',
    '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM'
  ];

  constructor(
    private authService: AuthService,
    private appointmentService: AppointmentService,
    private patientService: PatientService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private doctorLeaveService: DoctorLeaveService
  ) {
    this.currentUser = this.authService.currentUserValue;

    this.bookingForm = this.fb.group({
      patientId: ['', Validators.required],
      doctorId: ['', Validators.required],
      appointmentDate: ['', Validators.required],
      appointmentTime: ['', Validators.required],
      reason: ['', Validators.required],
      notes: ['']
    });

    this.bookingForm.get('doctorId')?.valueChanges.subscribe(() => {
      if (this.showBookingModal) {
        this.loadModalSlots();
      }
    });

    this.bookingForm.get('appointmentDate')?.valueChanges.subscribe(() => {
      if (this.showBookingModal) {
        this.loadModalSlots();
      }
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    const role = this.currentUser?.role?.toLowerCase();
    if (!this.currentUser || (role !== 'frontdesk' && role !== 'front desk')) {
      this.snackBar.open('Session expired or not logged in as Front Desk. Please sign in with frontdesk@hospital.com', 'Login', { duration: 4500 });
      this.authService.logout();
      this.router.navigate(['/login']);
      return;
    }

    this.currentView = readValidQueryParam(this.route, 'view', this.allowedViews, 'chart');
    const today = new Date().toISOString().split('T')[0];
    this.selectedDate = today;
    this.minBookingDate = today;
    this.bookingForm.patchValue({ appointmentDate: today });

    this.loadDoctors();
    this.doctorLeaveService.refreshAllLeaves();
    this.loadAllAppointments();
    this.loadPatients();
  }

  setView(view: 'chart' | 'all-appointments' | 'patients'): void {
    this.currentView = view;
    writeQueryParam(this.router, this.route, 'view', view);
    if (view === 'chart') {
      this.loadSchedule();
    } else if (view === 'all-appointments') {
      this.loadAllAppointments();
    } else if (view === 'patients') {
      this.loadPatients();
    }
    this.cdr.detectChanges();
  }

  loadDoctors(): void {
    this.authService.getDoctors().subscribe({
      next: (docs) => {
        this.doctors = docs || [];
        if (this.doctors.length > 0 && !this.selectedDoctorId) {
          this.selectedDoctorId = this.doctors[0].userId;
          this.bookingForm.patchValue({ doctorId: this.selectedDoctorId });
          this.loadSchedule();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Unable to load doctors list.', 'Close', { duration: 3000 });
      }
    });
  }

  onDoctorChange(docId: number): void {
    this.selectedDoctorId = Number(docId);
    this.loadSchedule();
  }

  onDateChange(newDate: string): void {
    this.selectedDate = newDate;
    this.loadSchedule();
  }

  onDurationChange(duration: number): void {
    this.selectedDuration = duration;
    this.loadSchedule();
  }

  loadSchedule(): void {
    if (!this.selectedDoctorId) return;

    this.isLoadingSchedule = true;
    const docId = Number(this.selectedDoctorId);
    this.currentDoctorLeave = this.doctorLeaveService.getDoctorLeaveForDate(docId, this.selectedDate);
    this.cdr.detectChanges();

    this.appointmentService.getDoctorSchedule(docId, this.selectedDate, this.selectedDuration).subscribe({
      next: (sched) => {
        if (sched && sched.currentLeave) {
          this.currentDoctorLeave = sched.currentLeave;
        } else if (!this.currentDoctorLeave) {
          this.currentDoctorLeave = this.doctorLeaveService.getDoctorLeaveForDate(docId, this.selectedDate);
        }

        if (sched && sched.slots && this.currentDoctorLeave) {
          sched.slots.forEach(slot => {
            const leaveCheck = this.doctorLeaveService.isSlotBlockedByLeave(this.currentDoctorLeave, slot.slotLabel);
            if (leaveCheck.blocked) {
              slot.isBooked = true;
              slot.status = 'DoctorOnLeave';
              slot.notes = leaveCheck.reason || 'Doctor on Leave';
            }
          });
          sched.bookedSlots = sched.slots.filter(s => s.isBooked).length;
          sched.availableSlots = sched.slots.filter(s => !s.isBooked).length;
        }
        this.doctorSchedule = sched;
        this.isLoadingSchedule = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingSchedule = false;
        this.snackBar.open('Failed to load doctor schedule.', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  loadAllAppointments(): void {
    this.appointmentService.getAppointments().subscribe({
      next: (res) => {
        this.allAppointments = res || [];
        this.applyApptFilter();
        this.cdr.detectChanges();
      }
    });
  }

  applyApptFilter(): void {
    let list = this.allAppointments;

    if (this.filterStatus !== 'ALL') {
      list = list.filter(a => a.status?.toLowerCase() === this.filterStatus.toLowerCase());
    }

    if (this.apptSearchTerm.trim()) {
      const term = this.apptSearchTerm.trim().toLowerCase();
      list = list.filter(a => 
        a.patientName?.toLowerCase().includes(term) ||
        a.doctorName?.toLowerCase().includes(term) ||
        a.reason?.toLowerCase().includes(term) ||
        a.appointmentTime?.toLowerCase().includes(term)
      );
    }

    this.filteredAppointments = list;
    this.cdr.detectChanges();
  }

  setFilterStatus(status: string): void {
    this.filterStatus = status;
    this.applyApptFilter();
  }

  // Cancel appointment (frees the slot immediately)
  cancelAppointment(appt: Appointment | { appointmentId: number; patientName?: string }): void {
    const pName = appt.patientName || 'this patient';
    if (!confirm(`Are you sure you want to cancel the appointment for ${pName}? The time slot will immediately become FREE and bookable.`)) {
      return;
    }

    const frontDeskUser = this.currentUser?.fullName || 'Front Desk Staff';
    this.appointmentService.cancelAppointment(appt.appointmentId, `Cancelled at Front Desk by ${frontDeskUser}`).subscribe({
      next: () => {
        this.snackBar.open(`Appointment cancelled. The time slot is now FREE and bookable.`, 'OK', { duration: 3500 });
        this.loadSchedule();
        this.loadAllAppointments();
      },
      error: (err) => {
        const msg = err.error?.message || 'Failed to cancel appointment.';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      }
    });
  }

  isDoctorOnFullDayLeave(): boolean {
    if (!this.currentDoctorLeave) return false;
    return this.currentDoctorLeave.leaveCategory === 'future' || !this.currentDoctorLeave.leaveCategory;
  }

  getSelectedDoctorName(): string {
    const doc = this.doctors.find(d => d.userId === this.selectedDoctorId);
    return doc?.fullName || this.doctorSchedule?.doctorName || 'Doctor';
  }

  // ==========================================
  // QUICK BOOKING FOR FREE TIME SLOTS
  // ==========================================
  loadModalSlots(): void {
    const docId = this.bookingForm.get('doctorId')?.value;
    const dateVal = this.bookingForm.get('appointmentDate')?.value;
    if (!docId || !dateVal) {
      this.modalSlots = [];
      this.currentModalDoctorLeave = null;
      return;
    }

    this.currentModalDoctorLeave = this.doctorLeaveService.getDoctorLeaveForDate(Number(docId), dateVal);
    this.isLoadingModalSlots = true;
    this.cdr.detectChanges();

    this.appointmentService.getDoctorSchedule(Number(docId), dateVal, 60).subscribe({
      next: (res) => {
        this.modalSlots = res?.slots || [];
        if (this.currentModalDoctorLeave && this.modalSlots.length > 0) {
          this.modalSlots.forEach(slot => {
            const leaveCheck = this.doctorLeaveService.isSlotBlockedByLeave(this.currentModalDoctorLeave, slot.slotLabel);
            if (leaveCheck.blocked) {
              slot.isBooked = true;
              slot.notes = leaveCheck.reason || 'Doctor on Leave';
            }
          });
        }
        this.isLoadingModalSlots = false;

        const currentChosen = this.bookingForm.get('appointmentTime')?.value;
        const matching = this.modalSlots.find(s => s.slotLabel === currentChosen);

        // If no slot is chosen or currently chosen slot is already booked, auto-select first available slot
        if (!currentChosen || (matching && matching.isBooked)) {
          const firstAvailable = this.modalSlots.find(s => !s.isBooked);
          this.bookingForm.patchValue({ appointmentTime: firstAvailable ? firstAvailable.slotLabel : '' });
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.modalSlots = [];
        this.isLoadingModalSlots = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectModalSlot(slot: DoctorSlot): void {
    if (slot.isBooked) return;
    this.bookingForm.patchValue({ appointmentTime: slot.slotLabel });
    this.cdr.detectChanges();
  }

  selectRescheduleSlot(slot: DoctorSlot): void {
    if (slot.isBooked) return;
    this.rescheduleTime = slot.slotLabel;
    this.cdr.detectChanges();
  }

  getAvailableModalSlotsCount(): number {
    return this.modalSlots.filter(s => !s.isBooked).length;
  }

  getBookedModalSlotsCount(): number {
    return this.modalSlots.filter(s => s.isBooked).length;
  }

  isCurrentSelectedSlotBooked(): boolean {
    const chosen = this.bookingForm.get('appointmentTime')?.value;
    if (!chosen || this.modalSlots.length === 0) return false;
    const matching = this.modalSlots.find(s => s.slotLabel === chosen);
    return matching ? matching.isBooked : false;
  }

  openBookingForSlot(slot: DoctorSlot): void {
    this.bookingForm.patchValue({
      doctorId: this.selectedDoctorId,
      appointmentDate: this.selectedDate,
      appointmentTime: slot.slotLabel,
      reason: '',
      notes: ''
    });
    this.loadModalSlots();
    this.showBookingModal = true;
    this.cdr.detectChanges();
  }

  openGenericBooking(): void {
    const defaultDocId = this.selectedDoctorId || (this.doctors[0]?.userId ?? '');
    const defaultDate = this.selectedDate || this.minBookingDate;
    this.bookingForm.reset({
      doctorId: defaultDocId,
      appointmentDate: defaultDate,
      appointmentTime: '',
      patientId: '',
      reason: '',
      notes: ''
    });
    this.loadModalSlots();
    this.showBookingModal = true;
    this.cdr.detectChanges();
  }

  closeBookingModal(): void {
    this.showBookingModal = false;
    this.cdr.detectChanges();
  }

  submitBooking(): void {
    if (this.bookingForm.invalid || this.isCurrentSelectedSlotBooked()) {
      return;
    }

    this.isSubmittingBooking = true;
    const val = this.bookingForm.value;

    const payload = {
      patientId: Number(val.patientId),
      doctorId: Number(val.doctorId),
      appointmentDate: val.appointmentDate,
      appointmentTime: val.appointmentTime,
      reason: val.reason?.trim() || 'Front Desk Booked Appointment',
      notes: val.notes?.trim() ? `Front Desk: ${val.notes.trim()}` : 'Booked via Front Desk'
    };

    this.appointmentService.createAppointment(payload).subscribe({
      next: (created) => {
        this.isSubmittingBooking = false;
        this.showBookingModal = false;
        this.snackBar.open(`Appointment booked successfully! Slot reserved.`, 'OK', { duration: 3500 });
        this.loadSchedule();
        this.loadAllAppointments();
      },
      error: (err) => {
        this.isSubmittingBooking = false;
        const msg = err.error?.message || '';
        // Requirement 2: Do NOT show "is already booked" alert snackbar
        if (msg && !msg.toLowerCase().includes('already booked')) {
          this.snackBar.open(msg || 'Failed to book slot.', 'Close', { duration: 4000 });
        }
        this.loadModalSlots();
        this.cdr.detectChanges();
      }
    });
  }

  // ==========================================
  // RESCHEDULE MODAL
  // ==========================================
  loadRescheduleSlots(): void {
    if (!this.selectedApptForReschedule || !this.rescheduleDate) return;
    this.currentRescheduleDoctorLeave = this.doctorLeaveService.getDoctorLeaveForDate(this.selectedApptForReschedule.doctorId, this.rescheduleDate);
    this.isLoadingRescheduleSlots = true;
    this.cdr.detectChanges();

    this.appointmentService.getDoctorSchedule(this.selectedApptForReschedule.doctorId, this.rescheduleDate, 60).subscribe({
      next: (res) => {
        this.rescheduleSlots = res?.slots || [];
        if (this.currentRescheduleDoctorLeave && this.rescheduleSlots.length > 0) {
          this.rescheduleSlots.forEach(slot => {
            const leaveCheck = this.doctorLeaveService.isSlotBlockedByLeave(this.currentRescheduleDoctorLeave, slot.slotLabel);
            if (leaveCheck.blocked) {
              slot.isBooked = true;
              slot.notes = leaveCheck.reason || 'Doctor on Leave';
            }
          });
        }
        this.isLoadingRescheduleSlots = false;
        const matching = this.rescheduleSlots.find(s => s.slotLabel === this.rescheduleTime);
        if (matching && matching.isBooked) {
          const firstAvailable = this.rescheduleSlots.find(s => !s.isBooked);
          if (firstAvailable) {
            this.rescheduleTime = firstAvailable.slotLabel;
          }
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
    if (!this.rescheduleTime || this.rescheduleSlots.length === 0) return false;
    const matching = this.rescheduleSlots.find(s => s.slotLabel === this.rescheduleTime);
    return matching ? matching.isBooked : false;
  }

  openRescheduleModal(appt: Appointment): void {
    this.selectedApptForReschedule = appt;
    this.rescheduleDate = appt.appointmentDate?.split('T')[0] || this.minBookingDate;
    this.rescheduleTime = appt.appointmentTime || '09:00 AM - 10:00 AM';
    this.rescheduleReason = '';
    this.loadRescheduleSlots();
    this.cdr.detectChanges();
  }

  onRescheduleDateChange(): void {
    this.loadRescheduleSlots();
  }

  closeRescheduleModal(): void {
    this.selectedApptForReschedule = null;
    this.cdr.detectChanges();
  }

  submitReschedule(): void {
    if (!this.selectedApptForReschedule || this.isCurrentRescheduleSlotBooked()) return;

    this.isSubmittingReschedule = true;
    const appt = this.selectedApptForReschedule;

    this.appointmentService.rescheduleAppointment(appt.appointmentId, {
      newDate: this.rescheduleDate,
      newTime: this.rescheduleTime,
      reason: this.rescheduleReason?.trim() || 'Rescheduled by Front Desk'
    }).subscribe({
      next: () => {
        this.isSubmittingReschedule = false;
        this.closeRescheduleModal();
        this.snackBar.open(`Appointment for ${appt.patientName} successfully rescheduled!`, 'OK', { duration: 3500 });
        this.loadSchedule();
        this.loadAllAppointments();
      },
      error: (err) => {
        this.isSubmittingReschedule = false;
        const msg = err.error?.message || '';
        // Requirement 2: Do NOT show "is already booked" alert snackbar
        if (msg && !msg.toLowerCase().includes('already booked')) {
          this.snackBar.open(msg || 'Failed to reschedule.', 'Close', { duration: 4000 });
        }
        this.loadRescheduleSlots();
        this.cdr.detectChanges();
      }
    });
  }

  // ==========================================
  // PATIENT DIRECTORY
  // ==========================================
  loadPatients(): void {
    this.isLoadingPatients = true;
    this.cdr.detectChanges();

    this.patientService.getPaginatedPatients(this.patientPageNumber, this.patientPageSize, this.patientSearchTerm).subscribe({
      next: (res) => {
        this.patients = res.items || [];
        this.totalPatients = res.totalCount || 0;
        this.isLoadingPatients = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingPatients = false;
        this.snackBar.open('Error loading patient list.', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  onPatientSearch(): void {
    this.patientPageNumber = 1;
    this.loadPatients();
  }

  onPatientPageChange(event: PageEvent): void {
    this.patientPageNumber = event.pageIndex + 1;
    this.patientPageSize = event.pageSize;
    this.loadPatients();
  }

  viewPatientDetails(patientId: number, appointmentId?: number): void {
    if (appointmentId) {
      this.router.navigate(['/patient-details', patientId], { queryParams: { appointmentId } });
    } else {
      this.router.navigate(['/patient-details', patientId]);
    }
  }



  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'requested': return 'status-requested';
      case 'approved': return 'status-approved';
      case 'doctorconfirmed': return 'status-confirmed';
      case 'rescheduled': return 'status-rescheduled';
      case 'done': return 'status-done';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-default';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
