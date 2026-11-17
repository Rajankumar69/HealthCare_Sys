import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SharedModule } from '../shared.module';
import { AuthService } from '../../core/services/auth.service';
import { Department, UpdateProfileRequest, User } from '../../core/models/user.model';

@Component({
  selector: 'app-edit-staff-profile-modal',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './edit-staff-profile-modal.component.html',
  styleUrl: './edit-staff-profile-modal.component.scss'
})
export class EditStaffProfileModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() user: User | null = null;
  @Input() theme: 'doctor' | 'nurse' = 'doctor';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<User>();

  departments: Department[] = [];
  isSaving = false;
  errorMessage: string | null = null;

  form: UpdateProfileRequest = {
    fullName: '',
    email: '',
    phoneNumber: '',
    departmentId: null,
    jobTitle: '',
    workLocation: ''
  };

  constructor(
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['isOpen'] || changes['user']) && this.isOpen && this.user) {
      this.errorMessage = null;
      this.populateForm(this.user);
      if (this.departments.length === 0) {
        this.loadDepartments();
      }
      this.cdr.detectChanges();
    }
  }

  private populateForm(user: User): void {
    const isDoctor = this.theme === 'doctor';
    this.form = {
      fullName: user.fullName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      departmentId: user.departmentId ?? null,
      jobTitle: user.jobTitle || (isDoctor
        ? `${user.departmentName || 'General Medicine'} Specialist`
        : 'Senior Registered Nurse (RN)'),
      workLocation: user.workLocation || (isDoctor
        ? 'Room 402, Wing B'
        : 'Triage Desk & Vitals Station')
    };
  }

  private loadDepartments(): void {
    this.authService.getDepartments().subscribe({
      next: (depts) => {
        this.departments = depts || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.departments = [];
        this.cdr.detectChanges();
      }
    });
  }

  onCancel(): void {
    if (this.isSaving) return;
    this.closed.emit();
  }

  sanitizeFullName(): void {
    if (this.form.fullName) {
      this.form.fullName = this.form.fullName.replace(/[^a-zA-Z\s]/g, '');
    }
  }

  sanitizePhone(): void {
    if (this.form.phoneNumber) {
      this.form.phoneNumber = this.form.phoneNumber.replace(/[^0-9]/g, '').slice(0, 10);
    }
  }

  onSubmit(): void {
    if (!this.user) return;

    const fullName = this.form.fullName?.trim();
    const email = this.form.email?.trim();
    if (!fullName || !email) {
      this.errorMessage = 'Full name and email are required.';
      this.cdr.detectChanges();
      return;
    }

    if (!/^[a-zA-Z\s]+$/.test(fullName)) {
      this.errorMessage = 'Full name can only contain letters and spaces (no symbols or numbers).';
      this.cdr.detectChanges();
      return;
    }

    const cleanPhone = this.form.phoneNumber ? this.form.phoneNumber.replace(/[^0-9]/g, '').trim() : '';
    if (cleanPhone && cleanPhone.length !== 10) {
      this.errorMessage = 'Phone number must be exactly 10 digits (no symbols allowed).';
      this.cdr.detectChanges();
      return;
    }

    this.isSaving = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    const payload: UpdateProfileRequest = {
      fullName,
      email,
      phoneNumber: cleanPhone || undefined,
      departmentId: this.form.departmentId ? Number(this.form.departmentId) : null,
      jobTitle: this.form.jobTitle?.trim() || undefined,
      workLocation: this.form.workLocation?.trim() || undefined
    };

    this.authService.updateUserProfile(this.user.userId, payload).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.snackBar.open(res?.message || 'Profile details updated successfully!', 'Close', { duration: 3000 });
        if (res?.profile) {
          this.saved.emit(res.profile);
        }
        this.closed.emit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err?.error?.message || 'Could not update profile details. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }
}
