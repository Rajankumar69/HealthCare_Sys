import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const expectedRoles: string[] = route.data?.['roles'] || [];

  const currentUser = authService.currentUserValue;
  if (!currentUser) {
    router.navigate(['/login']);
    return false;
  }

  if (expectedRoles.length === 0 || expectedRoles.map(r => r.toLowerCase()).includes(currentUser.role.toLowerCase())) {
    return true;
  }

  // Not authorized for this role -> redirect to their appropriate dashboard
  if (currentUser.role.toLowerCase() === 'admin') {
    router.navigate(['/admin']);
  } else if (currentUser.role.toLowerCase() === 'doctor') {
    router.navigate(['/doctor']);
  } else if (currentUser.role.toLowerCase() === 'nurse') {
    router.navigate(['/nurse']);
  } else if (currentUser.role.toLowerCase() === 'frontdesk' || currentUser.role.toLowerCase() === 'front desk') {
    router.navigate(['/frontdesk']);
  } else {
    router.navigate(['/patient']);
  }

  return false;
};
