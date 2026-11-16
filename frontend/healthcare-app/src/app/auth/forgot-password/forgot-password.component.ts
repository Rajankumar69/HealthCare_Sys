import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent implements OnDestroy {
  step: number = 1;
  isLoading: boolean = false;
  isVerifyingOtp: boolean = false;
  isOtpVerified: boolean = false;
  isResendingOtp: boolean = false;
  isSubmitting: boolean = false;
  timerSeconds: number = 30;
  timerInterval: any;
  receivedOtp: string | null = null;
  hidePassword = true;
  hideConfirm = true;

  emailForm: FormGroup;
  resetForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public dialogRef: MatDialogRef<ForgotPasswordComponent>
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.resetForm = this.fb.group({
      otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    const pw = g.get('newPassword')?.value;
    const cpw = g.get('confirmPassword')?.value;
    return pw === cpw ? null : { mismatch: true };
  }

  sendOtp(): void {
    if (this.emailForm.invalid) return;

    this.isLoading = true;
    const email = this.emailForm.value.email;

    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.receivedOtp = res.generatedOtp || null;
          this.step = 2;
          this.isOtpVerified = false;
          this.startTimer(res.validitySeconds || 30);
          this.cdr.detectChanges(); // Instant transition, zero delay

          if (res.generatedOtp) {
            this.snackBar.open(`Your OTP is: ${res.generatedOtp} (Valid for 30s)`, 'Close', { duration: 15000 });
          }
        } else {
          this.snackBar.open(res.message || 'Failed to generate OTP', 'Close', { duration: 4000 });
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.error?.message || 'Error communicating with server.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  onVerifyOtp(): void {
    const otp = this.resetForm.get('otp')?.value;
    const email = this.emailForm.get('email')?.value;
    if (!otp || otp.length !== 6) {
      this.snackBar.open('Please enter a valid 6-digit OTP.', 'Close', { duration: 3000 });
      return;
    }

    if (this.timerSeconds === 0) {
      this.snackBar.open('OTP has expired. Please request a new OTP.', 'Close', { duration: 3000 });
      return;
    }

    this.isVerifyingOtp = true;
    this.authService.verifyOtp(email, otp).subscribe({
      next: (res) => {
        this.isVerifyingOtp = false;
        this.isOtpVerified = true;
        this.snackBar.open('OTP verified successfully! Now set your new password.', 'OK', { duration: 4000 });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isVerifyingOtp = false;
        this.isOtpVerified = false;
        const msg = err.error?.message || 'Invalid OTP or OTP has expired.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  resendOtp(): void {
    if (this.timerSeconds > 0 || this.isResendingOtp || this.isOtpVerified) return;

    this.isResendingOtp = true;
    const email = this.emailForm.get('email')?.value;

    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.isResendingOtp = false;
        if (res.success) {
          this.receivedOtp = res.generatedOtp || null;
          this.resetForm.get('otp')?.reset('');
          this.isOtpVerified = false;
          this.startTimer(res.validitySeconds || 30);
          this.cdr.detectChanges();

          if (res.generatedOtp) {
            this.snackBar.open(`New OTP sent: ${res.generatedOtp} (Valid for 30s)`, 'Close', { duration: 15000 });
          } else {
            this.snackBar.open(res.message || 'New OTP generated successfully!', 'Close', { duration: 5000 });
          }
        } else {
          this.snackBar.open(res.message || 'Failed to generate new OTP', 'Close', { duration: 4000 });
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.isResendingOtp = false;
        const msg = err.error?.message || 'Error communicating with server.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  startTimer(seconds: number): void {
    this.stopTimer();
    this.timerSeconds = seconds;
    this.timerInterval = setInterval(() => {
      this.timerSeconds--;
      if (this.timerSeconds <= 0) {
        this.timerSeconds = 0;
        this.stopTimer();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  confirmReset(): void {
    if (!this.isOtpVerified) {
      this.snackBar.open('Please verify your OTP first.', 'Close', { duration: 3000 });
      return;
    }

    if (this.resetForm.invalid) return;

    this.isSubmitting = true;
    const payload = {
      email: this.emailForm.value.email,
      otp: this.resetForm.value.otp,
      newPassword: this.resetForm.value.newPassword,
      confirmPassword: this.resetForm.value.confirmPassword
    };

    this.authService.resetPassword(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.snackBar.open(res.message || 'Password successfully changed! You can now log in.', 'OK', { duration: 5000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err.error?.message || 'Failed to reset password. Please verify OTP.';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }
}
