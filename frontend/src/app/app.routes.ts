import { Routes } from '@angular/router';
import { authGuard, permissionGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login.component').then((m) => m.LoginComponent),
    title: 'Sign in · Manufacturing ERP',
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register.component').then((m) => m.RegisterComponent),
    title: 'Create account · Manufacturing ERP',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Dashboard · Manufacturing ERP',
      },
      {
        path: 'production',
        loadComponent: () => import('./production/production-list.component').then((m) => m.ProductionListComponent),
        title: 'Production Planning · Manufacturing ERP',
      },
      {
        path: 'production/:id',
        loadComponent: () => import('./production/production-detail.component').then((m) => m.ProductionDetailComponent),
        title: 'Production Order · Manufacturing ERP',
      },
      {
        path: 'scheduling',
        loadComponent: () => import('./scheduling/scheduling.component').then((m) => m.SchedulingComponent),
        title: 'Production Scheduling · Manufacturing ERP',
      },
      {
        path: 'inventory',
        loadComponent: () => import('./inventory/inventory.component').then((m) => m.InventoryComponent),
        title: 'Inventory Management · Manufacturing ERP',
      },
      {
        path: 'quality-control',
        loadComponent: () => import('./quality-control/quality-control.component').then((m) => m.QualityControlComponent),
        title: 'Quality Control · Manufacturing ERP',
      },
      {
        path: 'defects',
        loadComponent: () => import('./defects/defects.component').then((m) => m.DefectsComponent),
        title: 'Defect Management · Manufacturing ERP',
      },
      {
        path: 'machines',
        loadComponent: () => import('./machines/machines.component').then((m) => m.MachinesComponent),
        title: 'Machine Management · Manufacturing ERP',
      },
      {
        path: 'employees',
        loadComponent: () => import('./employees/employees.component').then((m) => m.EmployeesComponent),
        title: 'Employee Management · Manufacturing ERP',
      },
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports.component').then((m) => m.ReportsComponent),
        title: 'Reports & Analytics · Manufacturing ERP',
      },
      {
        path: 'notifications',
        loadComponent: () => import('./notifications/notifications.component').then((m) => m.NotificationsComponent),
        title: 'Notifications · Manufacturing ERP',
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then((m) => m.SettingsComponent),
        title: 'Settings · Manufacturing ERP',
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

export { authGuard, permissionGuard, roleGuard };
