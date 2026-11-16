import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { 
    path: 'login', 
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent) 
  },
  { 
    path: 'admin', 
    loadComponent: () => import('./admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Admin'] }
  },
  { 
    path: 'frontdesk', 
    loadComponent: () => import('./frontdesk/frontdesk-dashboard/frontdesk-dashboard.component').then(m => m.FrontdeskDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['FrontDesk'] }
  },
  { 
    path: 'doctor', 
    loadComponent: () => import('./doctor/doctor-dashboard/doctor-dashboard.component').then(m => m.DoctorDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Doctor'] }
  },
  { 
    path: 'nurse', 
    loadComponent: () => import('./nurse/nurse-dashboard/nurse-dashboard.component').then(m => m.NurseDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Nurse'] }
  },
  { 
    path: 'patient', 
    loadComponent: () => import('./patient/patient-dashboard/patient-dashboard.component').then(m => m.PatientDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Patient'] }
  },
  {
    path: 'patient-details/:id',
    loadComponent: () => import('./shared/patient-details-page/patient-details-page.component').then(m => m.PatientDetailsPageComponent),
    canActivate: [authGuard]
  },
  {
    path: 'patient_details/:id',
    loadComponent: () => import('./shared/patient-details-page/patient-details-page.component').then(m => m.PatientDetailsPageComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'login' }
];
