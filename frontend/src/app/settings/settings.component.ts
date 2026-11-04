import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { DepartmentService, UserService } from '../core/services/user.service';
import { LookupService } from '../core/services/lookup.service';
import { ToastService } from '../core/services/toast.service';
import { ConfirmService } from '../shared/components/confirm.service';
import { Department, User } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { StatusBadgeComponent } from '../shared/components/status-badge.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';
import { UserFormComponent } from './user-form.component';
import { DepartmentFormComponent } from './department-form.component';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, DatePipe, PageHeaderComponent, StatusBadgeComponent, EmptyStateComponent, UserFormComponent, DepartmentFormComponent],
  template: `
    <app-page-header title="Settings" subtitle="Profile, role based users, departments and system information" />

    <div class="panel">
      <div class="tabs-line">
        <div class="tab-item" [class.active]="tab() === 'profile'" (click)="tab.set('profile')"><i class="bi bi-person-circle"></i> My profile</div>
        @if (isAdmin()) {
          <div class="tab-item" [class.active]="tab() === 'users'" (click)="tab.set('users'); loadUsers()"><i class="bi bi-people"></i> Users <span class="count">{{ users().length }}</span></div>
          <div class="tab-item" [class.active]="tab() === 'departments'" (click)="tab.set('departments'); loadDepartments()"><i class="bi bi-building"></i> Departments</div>
        }
        <div class="tab-item" [class.active]="tab() === 'system'" (click)="tab.set('system')"><i class="bi bi-info-circle"></i> System</div>
      </div>

      @if (tab() === 'profile') {
        <div class="panel-body" style="display:grid;grid-template-columns:1fr 1fr;gap:22px" class="profile-grid">
          <div>
            <h3 style="font-size:15px;margin-bottom:14px">Account information</h3>
            <div style="margin-bottom:13px">
              <label class="form-label">Full name</label>
              <input class="form-control" [(ngModel)]="profile.name" />
            </div>
            <div style="margin-bottom:13px">
              <label class="form-label">Email (read only)</label>
              <input class="form-control" [value]="auth.user()?.email" readonly style="background:#F7F9FD" />
            </div>
            <div style="margin-bottom:13px">
              <label class="form-label">Phone</label>
              <input class="form-control" [(ngModel)]="profile.phone" />
            </div>
            <div style="margin-bottom:16px">
              <label class="form-label">Department</label>
              <select class="form-select" [(ngModel)]="profile.department">
                <option value="">Unassigned</option>
                @for (dept of departments(); track dept._id) { <option [value]="dept._id">{{ dept.name }}</option> }
              </select>
            </div>
            <button class="btn btn-primary" (click)="saveProfile()" [disabled]="saving()">
              <i class="bi bi-check2"></i> Save profile
            </button>
          </div>

          <div>
            <h3 style="font-size:15px;margin-bottom:14px">Change password</h3>
            <div style="margin-bottom:13px">
              <label class="form-label">Current password</label>
              <input type="password" class="form-control" [(ngModel)]="password.current" />
            </div>
            <div style="margin-bottom:13px">
              <label class="form-label">New password</label>
              <input type="password" class="form-control" [(ngModel)]="password.next" placeholder="Min 6 characters" />
            </div>
            <div style="margin-bottom:16px">
              <label class="form-label">Confirm new password</label>
              <input type="password" class="form-control" [(ngModel)]="password.confirm" />
            </div>
            <button class="btn btn-navy" (click)="changePassword()" [disabled]="saving()">
              <i class="bi bi-shield-lock"></i> Update password
            </button>

            <div class="alert-strip info" style="margin-top:20px">
              <i class="bi bi-person-badge-fill"></i>
              <div>
                <strong>Signed in as {{ auth.user()?.role }}</strong><br />
                <span style="font-size:12px">{{ permissionSummary() }}</span>
              </div>
            </div>
          </div>
        </div>
      }

      @if (tab() === 'users') {
        <div class="toolbar">
          <div class="search-box">
            <i class="bi bi-search"></i>
            <input class="form-control" placeholder="Search users…" [(ngModel)]="userSearch" (ngModelChange)="loadUsers()" />
          </div>
          <div class="toolbar-spacer"></div>
          <button class="btn btn-primary btn-sm" (click)="openUserForm()"><i class="bi bi-person-plus"></i> Create User</button>
        </div>
        <div class="table-shell">
          <table class="erp-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Last login</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody>
              @for (user of users(); track user._id) {
                <tr>
                  <td>
                    <div class="d-flex align-center gap-2">
                      <div class="avatar sm">{{ initials(user.name) }}</div>
                      <span class="cell-strong">{{ user.name }}</span>
                    </div>
                  </td>
                  <td>{{ user.email }}</td>
                  <td><span class="b-chip">{{ user.role }}</span></td>
                  <td>{{ departmentName(user) }}</td>
                  <td>{{ user.lastLogin ? (user.lastLogin | date: 'dd MMM yy, HH:mm') : 'Never' }}</td>
                  <td><app-status-badge [status]="user.isActive === false ? 'Inactive' : 'Active'" /></td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-outline btn-icon" (click)="editUser(user)" title="Edit"><i class="bi bi-pencil"></i></button>
                      <button class="btn btn-outline btn-icon" style="color:#D93A3A" (click)="removeUser(user)" title="Delete"><i class="bi bi-trash3"></i></button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7"><app-empty-state icon="bi-people" title="No users" message="Create user accounts for your plant team." /></td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'departments') {
        <div class="toolbar">
          <div class="toolbar-spacer"></div>
          <button class="btn btn-primary btn-sm" (click)="openDepartmentForm()"><i class="bi bi-plus-lg"></i> Create Department</button>
        </div>
        <div class="table-shell">
          <table class="erp-table">
            <thead><tr><th>Code</th><th>Department</th><th>Head</th><th>Location</th><th>Description</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody>
              @for (dept of departmentList(); track dept._id) {
                <tr>
                  <td class="cell-mono">{{ dept.code }}</td>
                  <td class="cell-strong">{{ dept.name }}</td>
                  <td>{{ dept.head || '—' }}</td>
                  <td>{{ dept.location }}</td>
                  <td><span style="font-size:12.4px;color:#7A8AA5">{{ dept.description }}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-outline btn-icon" (click)="editDepartment(dept)"><i class="bi bi-pencil"></i></button>
                      <button class="btn btn-outline btn-icon" style="color:#D93A3A" (click)="removeDepartment(dept)"><i class="bi bi-trash3"></i></button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6"><app-empty-state icon="bi-building" title="No departments" message="Create production departments." /></td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'system') {
        <div class="panel-body">
          <div class="kv-grid" style="margin-bottom:20px">
            <div class="kv-item"><label>Application</label><div>Manufacturing Production Planning &amp; QC System</div></div>
            <div class="kv-item"><label>Version</label><div>1.0.0</div></div>
            <div class="kv-item"><label>API</label><div>/api (Express + MongoDB)</div></div>
            <div class="kv-item"><label>Database</label><div>MongoDB · manufacturing_erp</div></div>
            <div class="kv-item"><label>Plant</label><div>Plant 1 · Aurangabad</div></div>
            <div class="kv-item"><label>Signed in</label><div>{{ auth.user()?.name }} ({{ auth.user()?.role }})</div></div>
          </div>

          <h3 style="font-size:14.5px;margin-bottom:10px">Role permissions matrix</h3>
          <div class="table-shell" style="border:1px solid #E2E8F2;border-radius:11px">
            <table class="erp-table">
              <thead><tr><th>Role</th><th>Permissions</th></tr></thead>
              <tbody>
                @for (role of permissionRows(); track role.name) {
                  <tr>
                    <td class="cell-strong" style="white-space:nowrap">{{ role.name }}</td>
                    <td>
                      @for (permission of role.permissions; track permission) {
                        <span class="b-chip" style="margin:0 3px 3px 0">{{ permission }}</span>
                      }
                      @if (!role.permissions.length) { <span class="cell-muted">Full system access</span> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <app-user-form [open]="userFormOpen()" [user]="editingUser()" (closed)="userFormOpen.set(false)" (saved)="loadUsers()" />
    <app-department-form [open]="departmentFormOpen()" [department]="editingDepartment()" (closed)="departmentFormOpen.set(false)" (saved)="loadDepartments()" />
  `,
  styles: [`@media (max-width: 900px) { .profile-grid { grid-template-columns: 1fr !important; } }`],
})
export class SettingsComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly usersApi = inject(UserService);
  private readonly departmentsApi = inject(DepartmentService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly tab = signal<'profile' | 'users' | 'departments' | 'system'>('profile');
  readonly users = signal<User[]>([]);
  readonly departmentList = signal<Department[]>([]);
  readonly departments = this.lookups.departments;
  readonly saving = signal(false);
  readonly userFormOpen = signal(false);
  readonly departmentFormOpen = signal(false);
  readonly editingUser = signal<User | null>(null);
  readonly editingDepartment = signal<Department | null>(null);
  readonly permissions = signal<Record<string, string[]>>({});

  userSearch = '';
  profile = { name: '', phone: '', department: '' };
  password = { current: '', next: '', confirm: '' };

  readonly isAdmin = () => this.auth.hasRole('Admin');
  readonly permissionRows = () => Object.entries(this.permissions()).map(([name, permissions]) => ({ name, permissions }));

  readonly permissionSummary = () => {
    const list = this.auth.user()?.permissions ?? [];
    if (list.includes('*')) return 'This role has full system access across all modules.';
    return `Access to ${list.length} module permissions across production, quality and inventory.`;
  };

  ngOnInit(): void {
    this.lookups.loadDepartments().subscribe((list) => this.departmentList.set(list));
    const user = this.auth.user();
    if (user) {
      this.profile = {
        name: user.name,
        phone: user.phone ?? '',
        department: typeof user.department === 'object' ? user.department?._id ?? '' : '',
      };
    }
    this.usersApi.roles().subscribe({ next: (data) => this.permissions.set(data.permissions ?? {}) });
  }

  saveProfile(): void {
    if (!this.profile.name.trim()) {
      this.toast.warning('Name required', 'Please enter your full name.');
      return;
    }
    this.saving.set(true);
    this.auth
      .updateProfile({ name: this.profile.name, phone: this.profile.phone, department: this.profile.department || undefined })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.toast.success('Profile updated', res.message);
        },
        error: () => this.saving.set(false),
      });
  }

  changePassword(): void {
    if (!this.password.current || !this.password.next) {
      this.toast.warning('Incomplete form', 'Enter your current and new password.');
      return;
    }
    if (this.password.next.length < 6) {
      this.toast.warning('Weak password', 'New password must be at least 6 characters.');
      return;
    }
    if (this.password.next !== this.password.confirm) {
      this.toast.warning('Passwords differ', 'New password and confirmation do not match.');
      return;
    }
    this.saving.set(true);
    this.auth.changePassword(this.password.current, this.password.next).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.password = { current: '', next: '', confirm: '' };
        this.toast.success('Password changed', res.message);
      },
      error: () => this.saving.set(false),
    });
  }

  loadUsers(): void {
    this.usersApi.list({ limit: 100, search: this.userSearch || undefined }).subscribe({ next: (res) => this.users.set(res.data) });
  }

  loadDepartments(): void {
    this.lookups.loadDepartments(true).subscribe((list) => this.departmentList.set(list));
  }

  openUserForm(): void {
    this.editingUser.set(null);
    this.userFormOpen.set(true);
  }

  editUser(user: User): void {
    this.editingUser.set(user);
    this.userFormOpen.set(true);
  }

  openDepartmentForm(): void {
    this.editingDepartment.set(null);
    this.departmentFormOpen.set(true);
  }

  editDepartment(department: Department): void {
    this.editingDepartment.set(department);
    this.departmentFormOpen.set(true);
  }

  async removeUser(user: User): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete ${user.name}?`,
      message: 'The user will immediately lose access to the ERP workspace.',
      confirmLabel: 'Delete user',
      danger: true,
    });
    if (!confirmed) return;
    this.usersApi.remove(user._id).subscribe({
      next: (res) => {
        this.toast.success('User deleted', res.message);
        this.loadUsers();
      },
    });
  }

  async removeDepartment(department: Department): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete ${department.name}?`,
      message: 'Departments with employees assigned cannot be deleted.',
      confirmLabel: 'Delete department',
      danger: true,
    });
    if (!confirmed) return;
    this.departmentsApi.remove(department._id).subscribe({
      next: (res) => {
        this.toast.success('Department deleted', res.message);
        this.loadDepartments();
      },
    });
  }

  departmentName(user: User): string {
    return typeof user.department === 'object' && user.department ? user.department.name : '—';
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  }
}
