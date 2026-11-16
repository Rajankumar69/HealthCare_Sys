import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PatientService } from '../../core/services/patient.service';
import { AuthService } from '../../core/services/auth.service';
import { AiService } from '../../core/services/ai.service';
import { PatientFullDetails, PatientVital, PatientMedicalHistory } from '../../core/models/patient.model';
import { User } from '../../core/models/user.model';
import { SharedModule } from '../shared.module';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-patient-details-page',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './patient-details-page.component.html',
  styleUrl: './patient-details-page.component.scss'
})
export class PatientDetailsPageComponent implements OnInit {
  patientId!: number;
  appointmentId?: number;
  details: PatientFullDetails | null = null;
  currentUser: User | null = null;

  isLoading = true;
  isSaving = false;
  errorMessage: string | null = null;

  showVitalForm = false;
  showHistoryForm = false;

  vitalColumns = ['recordedDate', 'bloodPressure', 'heartRate', 'temperature', 'weight', 'bloodGroup', 'recordedBy'];
  bloodGroups = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

  // AI Summary State
  aiSummary: string = '';
  renderedAiSummary: SafeHtml = '';
  isAiGenerating: boolean = false;
  aiError: string | null = null;
  showAiPanel: boolean = false;

  vitalForm: FormGroup;
  historyForm: FormGroup;

  get latestBloodGroup(): string | null {
    if (!this.details?.patientVitals || this.details.patientVitals.length === 0) return null;
    const item = this.details.patientVitals.find(v => !!v.bloodGroup);
    return item ? item.bloodGroup! : null;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private patientService: PatientService,
    private authService: AuthService,
    private aiService: AiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUser = this.authService.currentUserValue;

    this.vitalForm = this.fb.group({
      bloodPressure: ['120/80', Validators.required],
      heartRate: [72, [Validators.required, Validators.min(30), Validators.max(250)]],
      temperature: [98.6, [Validators.required, Validators.min(90), Validators.max(115)]],
      weight: [70.0, [Validators.required, Validators.min(5), Validators.max(350)]],
      bloodGroup: ['O+', Validators.required]
    });

    this.historyForm = this.fb.group({
      condition: ['', Validators.required],
      diagnosisDate: [''],
      treatment: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam && !isNaN(Number(idParam))) {
        this.patientId = Number(idParam);
      } else {
        this.isLoading = false;
        this.errorMessage = 'No valid Patient ID was provided in the URL.';
        this.cdr.detectChanges();
        return;
      }

      this.route.queryParamMap.subscribe(qParams => {
        const apptParam = qParams.get('appointmentId');
        if (apptParam && !isNaN(Number(apptParam))) {
          this.appointmentId = Number(apptParam);
        } else {
          this.appointmentId = undefined;
        }
        this.loadPatientDetails();
      });
    });
  }

  get canEditRecords(): boolean {
    const role = this.currentUser?.role?.toLowerCase();
    return role === 'doctor' || role === 'nurse';
  }

  get canAddMedicalHistory(): boolean {
    const role = this.currentUser?.role?.toLowerCase();
    return role === 'nurse' || role === 'patient';
  }

  loadPatientDetails(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    console.log(`[PatientDetailsPage] Fetching patient #${this.patientId} (appt #${this.appointmentId}) from API Gateway...`);

    this.patientService.getPatientFullDetails(this.patientId, this.appointmentId).subscribe({
      next: (res) => {
        console.log(`[PatientDetailsPage] Received patient #${this.patientId} details:`, res);
        this.details = {
          patientDetails: res?.patientDetails || {} as any,
          patientVitals: res?.patientVitals || [],
          patientMedicalHistory: res?.patientMedicalHistory || []
        };
        if (this.latestBloodGroup) {
          this.vitalForm.patchValue({ bloodGroup: this.latestBloodGroup });
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(`[PatientDetailsPage] Error fetching patient #${this.patientId}:`, err);
        this.isLoading = false;
        if (err.status === 404) {
          this.errorMessage = `Patient with ID #${this.patientId} was not found or has been soft-deleted.`;
        } else {
          this.errorMessage = 'Failed to connect to the Healthcare API service. Please verify that the microservices are running on port 5000.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  generateAiSummary(): void {
    if (!this.patientId) return;
    this.showAiPanel = true;
    this.isAiGenerating = true;
    this.aiSummary = '';
    this.renderedAiSummary = '';
    this.aiError = null;
    this.cdr.detectChanges();

    this.aiService.streamPatientSummary(
      this.patientId,
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

  closeAiPanel(): void {
    this.showAiPanel = false;
  }

  getInitials(): string {
    if (!this.details?.patientDetails) return 'P';
    const first = this.details.patientDetails.firstName?.[0] || '';
    const last = this.details.patientDetails.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'P';
  }

  toggleVitalForm(): void {
    this.showVitalForm = !this.showVitalForm;
    if (this.showVitalForm) {
      this.showHistoryForm = false;
    }
    this.cdr.detectChanges();
  }

  toggleHistoryForm(): void {
    this.showHistoryForm = !this.showHistoryForm;
    if (this.showHistoryForm) {
      this.showVitalForm = false;
    }
    this.cdr.detectChanges();
  }

  submitVital(): void {
    if (this.vitalForm.invalid || !this.details) return;

    this.isSaving = true;
    const payload: PatientVital = {
      patientId: this.details.patientDetails.patientID,
      bloodPressure: this.vitalForm.value.bloodPressure,
      heartRate: Number(this.vitalForm.value.heartRate),
      temperature: Number(this.vitalForm.value.temperature),
      weight: Number(this.vitalForm.value.weight),
      bloodGroup: this.vitalForm.value.bloodGroup,
      recordedBy: this.currentUser?.fullName || (this.currentUser?.role === 'Doctor' ? 'Dr. Physician' : 'Nurse Staff')
    };

    this.patientService.addVital(this.details.patientDetails.patientID, payload).subscribe({
      next: (newVital) => {
        this.details!.patientVitals = [newVital, ...(this.details!.patientVitals || [])];
        this.showVitalForm = false;
        this.isSaving = false;
        this.vitalForm.reset({ bloodPressure: '120/80', heartRate: 72, temperature: 98.6, weight: 70, bloodGroup: payload.bloodGroup });
        this.snackBar.open('Vitals logged successfully.', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSaving = false;
        this.snackBar.open('Failed to save vital entry.', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  submitHistory(): void {
    if (this.historyForm.invalid || !this.details) return;

    this.isSaving = true;
    let diagDate = this.historyForm.value.diagnosisDate;
    if (diagDate instanceof Date) {
      const year = diagDate.getFullYear();
      const month = String(diagDate.getMonth() + 1).padStart(2, '0');
      const day = String(diagDate.getDate()).padStart(2, '0');
      diagDate = `${year}-${month}-${day}`;
    }

    const payload: PatientMedicalHistory = {
      patientId: this.details.patientDetails.patientID,
      condition: this.historyForm.value.condition,
      diagnosisDate: diagDate || null,
      treatment: this.historyForm.value.treatment,
      notes: this.historyForm.value.notes
    };

    this.patientService.addMedicalHistory(this.details.patientDetails.patientID, payload).subscribe({
      next: (newHist) => {
        this.details!.patientMedicalHistory = [newHist, ...(this.details!.patientMedicalHistory || [])];
        this.showHistoryForm = false;
        this.isSaving = false;
        this.historyForm.reset();
        this.snackBar.open('Medical history entry added successfully.', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSaving = false;
        this.snackBar.open('Failed to save medical history entry.', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  goBack(): void {
    // Navigate back to the respective portal based on user role
    const role = this.currentUser?.role?.toLowerCase();
    if (role === 'doctor') {
      this.router.navigate(['/doctor']);
    } else if (role === 'nurse') {
      this.router.navigate(['/nurse']);
    } else if (role === 'frontdesk' || role === 'front desk') {
      this.router.navigate(['/frontdesk']);
    } else if (role === 'patient') {
      this.router.navigate(['/patient']);
    } else {
      this.location.back();
    }
  }
}
