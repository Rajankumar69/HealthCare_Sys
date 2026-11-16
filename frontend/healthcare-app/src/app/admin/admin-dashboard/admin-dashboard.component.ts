import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { readValidQueryParam, writeQueryParam } from '../../core/utils/view-query.util';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { AdminDoctor, AdminNurse, AdminPatient } from '../../core/models/admin.model';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    SharedModule,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private readonly allowedTabs = ['doctors', 'nurses', 'patients'] as const;
  activeTab: 'doctors' | 'nurses' | 'patients' = 'doctors';

  // Lists from Database
  doctors: AdminDoctor[] = [];
  nurses: AdminNurse[] = [];
  patients: AdminPatient[] = [];

  selectedDoctor: AdminDoctor | null = null;
  selectedNurse: AdminNurse | null = null;

  isLoading: boolean = false;
  showAddUserModal: boolean = false;
  isSavingUser: boolean = false;

  userForm: FormGroup;

  // Global Search & Assistant Chat State
  showGlobalSearchModal: boolean = false;
  chatInputQuery: string = '';
  isSearchingChat: boolean = false;
  chatMessages: Array<{
    isUser: boolean;
    text: string;
    formattedText?: SafeHtml;
    executionTimeMs?: number;
    timestamp: Date;
  }> = [];

  departments: { id: number; name: string }[] = [
    { id: 1, name: 'Cardiology' },
    { id: 2, name: 'Orthopedics' },
    { id: 3, name: 'Neurology' },
    { id: 4, name: 'Emergency Medicine' },
    { id: 5, name: 'General Medicine' }
  ];

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {
    this.userForm = this.fb.group({
      role: ['Doctor', Validators.required],
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phoneNumber: ['', Validators.required],
      departmentId: [1],
      gender: ['Male'],
      age: [30],
      dateOfBirth: [''],
      problem: [''],
      anyMedicalHistory: ['']
    });
  }

  ngOnInit(): void {
    this.activeTab = readValidQueryParam(this.route, 'tab', this.allowedTabs, 'doctors');
    this.loadUsers();
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.adminService.getDepartments().subscribe({
      next: (depts: any[]) => {
        if (depts && depts.length > 0) {
          this.departments = depts.map(d => ({
            id: d.departmentId || d.DepartmentId || d.id,
            name: d.departmentName || d.DepartmentName || d.name
          }));
          this.cdr.detectChanges();
        }
      },
      error: () => {
      }
    });
  }

  switchTab(tab: 'doctors' | 'nurses' | 'patients'): void {
    this.activeTab = tab;
    writeQueryParam(this.router, this.route, 'tab', tab);
    this.cdr.detectChanges();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.adminService.getAllUsers().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.doctors = res?.doctors || res?.Doctors || [];
        this.nurses = res?.nurses || res?.Nurses || [];
        this.patients = res?.patients || res?.Patients || [];

        const doctorIdParam = Number(this.route.snapshot.queryParamMap.get('doctorId'));
        const nurseIdParam = Number(this.route.snapshot.queryParamMap.get('nurseId'));

        if (this.doctors.length > 0) {
          this.selectedDoctor = this.doctors.find(d => d.userId === doctorIdParam) || this.doctors[0];
        }
        if (this.nurses.length > 0) {
          this.selectedNurse = this.nurses.find(n => n.userId === nurseIdParam) || this.nurses[0];
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.snackBar.open('Failed to load users from database.', 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  selectDoctor(doc: AdminDoctor): void {
    this.selectedDoctor = doc;
    writeQueryParam(this.router, this.route, 'doctorId', String(doc.userId));
    this.cdr.detectChanges();
  }

  selectNurse(nurse: AdminNurse): void {
    this.selectedNurse = nurse;
    writeQueryParam(this.router, this.route, 'nurseId', String(nurse.userId));
    this.cdr.detectChanges();
  }

  openAddUserModal(): void {
    const defaultDeptId = this.departments.length > 0 ? this.departments[0].id : 1;
    this.userForm.reset({
      role: 'Doctor',
      fullName: '',
      email: '',
      password: '',
      phoneNumber: '',
      departmentId: defaultDeptId,
      gender: 'Male',
      age: 30,
      dateOfBirth: '',
      problem: '',
      anyMedicalHistory: ''
    });
    this.showAddUserModal = true;
    this.cdr.detectChanges();
  }

  closeAddUserModal(): void {
    this.showAddUserModal = false;
    this.cdr.detectChanges();
  }

  submitNewUser(): void {
    if (this.userForm.invalid) {
      this.snackBar.open('Please fill all required fields correctly.', 'Close', { duration: 3000 });
      return;
    }

    this.isSavingUser = true;
    this.cdr.detectChanges();
    const formValue = { ...this.userForm.value };

    if (formValue.role === 'Patient') {
      formValue.departmentId = null;
    }

    this.adminService.addUser(formValue).subscribe({
      next: (res) => {
        this.isSavingUser = false;
        this.showAddUserModal = false;
        this.snackBar.open(res.message || 'User added successfully!', 'Close', { duration: 4000 });

        if (formValue.role === 'Doctor') this.activeTab = 'doctors';
        else if (formValue.role === 'Nurse') this.activeTab = 'nurses';
        else if (formValue.role === 'Patient') this.activeTab = 'patients';

        this.loadUsers();
      },
      error: (err) => {
        this.isSavingUser = false;
        const msg = err.error?.message || 'Error creating user.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  deleteUser(userId: number, role: string, name: string): void {
    const confirmed = confirm(`Are you sure you want to delete ${role} "${name}"?`);
    if (!confirmed) return;

    this.adminService.deleteUser(userId).subscribe({
      next: (res) => {
        this.snackBar.open(res.message || `${name} deleted successfully!`, 'Close', { duration: 4000 });
        this.loadUsers();
      },
      error: (err) => {
        const msg = err.error?.message || 'Failed to delete user.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  // ==========================================
  // GLOBAL SEARCH & ASSISTANT CHAT
  // ==========================================
  openGlobalSearchChat(): void {
    this.showGlobalSearchModal = true;
    if (this.chatMessages.length === 0) {
      const welcomeText = `Hello Admin! I am your **Global Search & Intelligence Assistant**.\n\nYou can ask me natural language questions like:\n- *"What are the number of patients Dr is attending?"*\n- *"Find patients with high fever"*\n- *"Who is prescribed Metformin?"*\n\nHow can I help you today?`;
      
      this.chatMessages.push({
        isUser: false,
        text: welcomeText,
        formattedText: this.sanitizer.bypassSecurityTrustHtml(marked.parse(welcomeText) as string),
        timestamp: new Date()
      });
    }
    this.cdr.detectChanges();
  }

  closeGlobalSearchChat(): void {
    this.showGlobalSearchModal = false;
    this.cdr.detectChanges();
  }

  applyQuickPrompt(promptText: string): void {
    this.chatInputQuery = promptText;
    this.sendGlobalSearchChat();
  }

  sendGlobalSearchChat(): void {
    const query = this.chatInputQuery?.trim();
    if (!query || this.isSearchingChat) return;

    this.chatMessages.push({
      isUser: true,
      text: query,
      timestamp: new Date()
    });

    this.chatInputQuery = '';
    this.isSearchingChat = true;
    this.cdr.detectChanges();

    const payload = { query };
    // Try ApiGateway Port 5000 first, fallback to direct GlobalSearchService Port 5030
    this.http.post<any>('http://localhost:5000/api/globalsearch/ask', payload).subscribe({
      next: (res) => {
        this.handleSearchChatResponse(res);
      },
      error: () => {
        this.http.post<any>('http://localhost:5030/api/globalsearch/ask', payload).subscribe({
          next: (res) => {
            this.handleSearchChatResponse(res);
          },
          error: () => {
            this.isSearchingChat = false;
            this.chatMessages.push({
              isUser: false,
              text: 'Unable to connect to GlobalSearchService. Please ensure Port 5030 or ApiGateway is running.',
              formattedText: this.sanitizer.bypassSecurityTrustHtml('⚠️ **Connection Error:** Unable to reach Global Search Service on Port 5030.'),
              timestamp: new Date()
            });
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  private handleSearchChatResponse(res: any): void {
    this.isSearchingChat = false;
    const rawAnswer = res?.answer || 'No results found.';
    const parsedHtml = marked.parse(rawAnswer) as string;

    this.chatMessages.push({
      isUser: false,
      text: rawAnswer,
      formattedText: this.sanitizer.bypassSecurityTrustHtml(parsedHtml),
      executionTimeMs: res?.executionTimeMs,
      timestamp: new Date()
    });
    this.cdr.detectChanges();
  }
}
