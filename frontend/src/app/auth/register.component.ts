import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { UserService } from '../core/services/user.service';
import { Department, Role } from '../core/models';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrap">
      <section class="auth-hero">
        <div>
          <div class="d-flex align-center gap-2" style="margin-bottom:34px">
            <div class="brand-mark"><i class="bi bi-gear-wide-connected"></i></div>
            <div class="brand-text">
              <span class="brand-title" style="font-size:16px">ManuCore ERP</span>
              <span class="brand-sub">Manufacturing Suite</span>
            </div>
          </div>
          <h1>Join your plant's digital workspace.</h1>
          <p class="lead">Create an account to raise production tasks, record inspections or manage the shop floor.</p>

          <div class="hero-features">
            <div class="hero-feature">
              <i class="bi bi-shield-lock"></i>
              <div><strong>Role based access</strong><span>Every role sees only the modules and actions it needs</span></div>
            </div>
            <div class="hero-feature">
              <i class="bi bi-activity"></i>
              <div><strong>Live factory data</strong><span>Dashboards update from real production, quality and stock records</span></div>
            </div>
          </div>
        </div>
        <div class="hero-stats">
          <div><strong>5</strong><span>Predefined roles</span></div>
          <div><strong>12</strong><span>Modules</span></div>
        </div>
      </section>

      <section class="auth-form-side">
        <div class="auth-card">
          <h2>Create your account</h2>
          <p class="sub">Self-registered accounts start with the Machine Operator role — an administrator can elevate access.</p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div style="margin-bottom:13px">
              <label class="form-label">Full name <span class="req">*</span></label>
              <input class="form-control" formControlName="name" placeholder="e.g. Rahul Sharma" [class.is-invalid]="invalid('name')" />
              @if (invalid('name')) { <div class="invalid-feedback">Please enter your full name (min 2 characters).</div> }
            </div>

            <div style="margin-bottom:13px">
              <label class="form-label">Work email <span class="req">*</span></label>
              <input type="email" class="form-control" formControlName="email" placeholder="you@manufacture.com" [class.is-invalid]="invalid('email')" />
              @if (invalid('email')) { <div class="invalid-feedback">Enter a valid email address.</div> }
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:13px">
              <div>
                <label class="form-label">Phone</label>
                <input class="form-control" formControlName="phone" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label class="form-label">Department</label>
                <select class="form-select" formControlName="department">
                  <option value="">Unassigned</option>
                  @for (dept of departments(); track dept._id) { <option [value]="dept._id">{{ dept.name }}</option> }
                </select>
              </div>
            </div>

            <div style="margin-bottom:13px">
              <label class="form-label">Requested role</label>
              <select class="form-select" formControlName="role">
                @for (role of roles(); track role) { <option [value]="role">{{ role }}</option> }
              </select>
              <div class="form-hint">Elevated roles require administrator approval after signup.</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:6px">
              <div>
                <label class="form-label">Password <span class="req">*</span></label>
                <input type="password" class="form-control" formControlName="password" placeholder="Min 6 characters" [class.is-invalid]="invalid('password')" />
                @if (invalid('password')) { <div class="invalid-feedback">At least 6 characters.</div> }
              </div>
              <div>
                <label class="form-label">Confirm password <span class="req">*</span></label>
                <input type="password" class="form-control" formControlName="confirmPassword" [class.is-invalid]="invalid('confirmPassword')" />
                @if (invalid('confirmPassword')) { <div class="invalid-feedback">Passwords must match.</div> }
              </div>
            </div>

            <button type="submit" class="btn btn-primary w-100" style="margin-top:16px;justify-content:center;height:44px" [disabled]="loading()">
              @if (loading()) { <span class="spinner"></span> Creating account… } @else { <i class="bi bi-person-plus"></i> Create account }
            </button>
          </form>

          <div style="text-align:center;font-size:12.8px;color:#5A6B87;margin-top:16px">
            Already registered? <a routerLink="/login" style="font-weight:600">Sign in instead</a>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly departments = signal<Department[]>([]);
  readonly roles = signal<Role[]>(['Machine Operator', 'Production Manager', 'Quality Control Inspector', 'Inventory Manager']);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    department: [''],
    role: ['Machine Operator' as Role],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.users.roles().subscribe({
      next: (data) => {
        this.departments.set(data.departments ?? []);
        if (data.roles?.length) this.roles.set(data.roles.filter((r) => r !== 'Admin'));
      },
    });
  }

  invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.password !== value.confirmPassword) {
      this.form.get('confirmPassword')?.setErrors({ mismatch: true });
      return;
    }

    this.loading.set(true);
    this.auth
      .register({
        name: value.name,
        email: value.email,
        password: value.password,
        phone: value.phone,
        department: value.department || undefined,
        role: value.role,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.toast.success('Account created', 'Welcome to ManuCore ERP.');
          this.router.navigateByUrl('/dashboard');
        },
        error: () => this.loading.set(false),
      });
  }
}
