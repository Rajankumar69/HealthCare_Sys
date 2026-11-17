import { Component, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import { PatientService } from '../../core/services/patient.service';
import { ForgotPasswordComponent } from '../forgot-password/forgot-password.component';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  activeTab = 0;
  isLoading = false;
  hidePassword = true;

  hideRegPassword = true;

  loginForm: FormGroup;
  registerForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private patientService: PatientService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.registerForm = this.fb.group({
      prefix: ['Mr.', [Validators.required]],
      firstName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s]+$/)]],
      lastName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s]+$/)]],
      age: ['', [Validators.required, Validators.min(0), Validators.max(125)]],
      dob: [null, [Validators.required]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      adharNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{12}$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  sanitizeName(field: 'firstName' | 'lastName'): void {
    const val = this.registerForm.get(field)?.value || '';
    const clean = val.replace(/[^a-zA-Z\s]/g, '');
    if (clean !== val) {
      this.registerForm.get(field)?.setValue(clean, { emitEvent: false });
    }
  }

  sanitizePhone(): void {
    const val = this.registerForm.get('phoneNumber')?.value || '';
    const clean = val.replace(/[^0-9]/g, '').slice(0, 10);
    if (clean !== val) {
      this.registerForm.get('phoneNumber')?.setValue(clean, { emitEvent: false });
    }
  }

  sanitizeAdhar(): void {
    const val = this.registerForm.get('adharNumber')?.value || '';
    const clean = val.replace(/[^0-9]/g, '').slice(0, 12);
    if (clean !== val) {
      this.registerForm.get('adharNumber')?.setValue(clean, { emitEvent: false });
    }
  }

  onDobChange(event: any): void {
    const val = event.value;
    if (val) {
      const birthDate = new Date(val);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      if (calculatedAge >= 0 && calculatedAge <= 125) {
        this.registerForm.patchValue({ age: calculatedAge });
      }
    }
  }

  fillQuickLogin(email: string, pass: string): void {
    // Clear any previous stale session or token before switching demo accounts
    this.authService.logout();
    this.loginForm.patchValue({ email, password: pass });
    this.onLogin();
  }

  onLogin(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.authService.login(this.loginForm.value).subscribe({
      next: (user) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
          this.snackBar.open(`Welcome back, ${user.fullName}!`, 'OK', { duration: 3000 });
          
          // Role-based redirect
          const role = user.role.toLowerCase();
          if (role === 'admin') {
            this.router.navigate(['/admin']);
          } else if (role === 'doctor') {
            this.router.navigate(['/doctor']);
          } else if (role === 'nurse') {
            this.router.navigate(['/nurse']);
          } else if (role === 'frontdesk' || role === 'front desk') {
            this.router.navigate(['/frontdesk']);
          } else {
            this.router.navigate(['/patient']);
          }
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
          const msg = err.error?.message || 'Login failed. Please verify credentials.';
          this.snackBar.open(msg, 'Close', { duration: 4000 });
        });
      }
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid) return;

    this.isLoading = true;
    const val = this.registerForm.value;
    const regEmail = (val.email || '').trim();
    const regPassword = val.password || '';
    const cleanFirstName = (val.firstName || '').replace(/[^a-zA-Z\s]/g, '').trim();
    const cleanLastName = (val.lastName || '').replace(/[^a-zA-Z\s]/g, '').trim();
    const cleanPhone = (val.phoneNumber || '').replace(/[^0-9]/g, '').slice(0, 10);
    const cleanAdhar = (val.adharNumber || '').replace(/[^0-9]/g, '').slice(0, 12);
    const fullName = `${val.prefix} ${cleanFirstName} ${cleanLastName}`.trim();

    // Requirement: New registration will always be the patient
    const authPayload = {
      fullName: fullName,
      email: regEmail,
      password: regPassword,
      role: 'Patient',
      phoneNumber: cleanPhone
    };

    this.authService.register(authPayload).subscribe({
      next: (res) => {
        let dobString = '2000-01-01';
        if (val.dob) {
          const d = new Date(val.dob);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dobString = `${y}-${m}-${day}`;
        }

        const patientPayload = {
          userId: res.userId,
          prefix: val.prefix || 'Mr.',
          firstName: cleanFirstName,
          lastName: cleanLastName,
          phoneNumber: cleanPhone,
          email: regEmail,
          gender: (val.prefix === 'Mrs.' || val.prefix === 'Ms.') ? 'Female' : 'Male',
          dateOfBirth: dobString,
          age: Number(val.age) || 0,
          adharNumber: cleanAdhar,
          problem: '',
          anyMedicalHistory: ''
        };

        this.patientService.createPatient(patientPayload).subscribe({
          next: () => {
            this.finishRegistration(regEmail, regPassword);
          },
          error: () => {
            this.finishRegistration(regEmail, regPassword);
          }
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
          const msg = err.error?.message || 'Registration failed. Please check your details.';
          this.snackBar.open(msg, 'Close', { duration: 4000 });
        });
      }
    });
  }

  private finishRegistration(email?: string, password?: string): void {
    this.ngZone.run(() => {
      this.isLoading = false;
      this.activeTab = 0;
      if (email && password) {
        this.loginForm.patchValue({ email, password });
      }
      this.registerForm.reset({
        prefix: 'Mr.'
      });
      this.cdr.detectChanges();
      this.snackBar.open('Registration completed! Please sign in.', 'OK', { duration: 4000 });
    });
  }

  openForgotPassword(): void {
    this.dialog.open(ForgotPasswordComponent, {
      width: '460px',
      disableClose: false
    });
  }
}
