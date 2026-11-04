import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-login',
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

          <h1>Production planning &amp; quality control, unified.</h1>
          <p class="lead">
            Plan production orders, allocate machines and materials, inspect batches and track defects —
            with live factory visibility across every shift.
          </p>

          <div class="hero-features">
            <div class="hero-feature">
              <i class="bi bi-diagram-3"></i>
              <div><strong>Production planning &amp; scheduling</strong><span>Order → machine → shift level planning with conflict detection</span></div>
            </div>
            <div class="hero-feature">
              <i class="bi bi-clipboard2-check"></i>
              <div><strong>Quality inspections</strong><span>Parameter level pass/fail with automatic defect percentages</span></div>
            </div>
            <div class="hero-feature">
              <i class="bi bi-boxes"></i>
              <div><strong>Inventory &amp; machines</strong><span>Low-stock alerts, consumption tracking and maintenance logs</span></div>
            </div>
          </div>
        </div>

        <div class="hero-stats">
          <div><strong>13</strong><span>Production orders</span></div>
          <div><strong>94%</strong><span>Quality pass rate</span></div>
          <div><strong>6</strong><span>Machines tracked</span></div>
          <div><strong>12</strong><span>Shop floor staff</span></div>
        </div>
      </section>

      <section class="auth-form-side">
        <div class="auth-card">
          <h2>Sign in to your workspace</h2>
          <p class="sub">Use your company credentials to access the plant dashboard.</p>

          @if (errorMessage()) {
            <div class="alert-strip danger"><i class="bi bi-exclamation-octagon-fill"></i><span>{{ errorMessage() }}</span></div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div style="margin-bottom:14px">
              <label class="form-label" for="email">Work email <span class="req">*</span></label>
              <input id="email" type="email" class="form-control" formControlName="email" placeholder="you@manufacture.com"
                     [class.is-invalid]="invalid('email')" autocomplete="username" />
              @if (invalid('email')) { <div class="invalid-feedback">{{ errorFor('email') }}</div> }
            </div>

            <div style="margin-bottom:8px">
              <label class="form-label" for="password">Password <span class="req">*</span></label>
              <div style="position:relative">
                <input id="password" [type]="showPassword() ? 'text' : 'password'" class="form-control" formControlName="password"
                       placeholder="••••••••" [class.is-invalid]="invalid('password')" autocomplete="current-password" />
                <button type="button" class="btn-ghost" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer;color:#7A8AA5"
                        (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                  <i class="bi" [class.bi-eye]="!showPassword()" [class.bi-eye-slash]="showPassword()"></i>
                </button>
              </div>
              @if (invalid('password')) { <div class="invalid-feedback">{{ errorFor('password') }}</div> }
            </div>

            <button type="submit" class="btn btn-primary w-100" style="margin-top:14px;justify-content:center;height:44px" [disabled]="loading()">
              @if (loading()) { <span class="spinner"></span> Signing in… } @else { <i class="bi bi-box-arrow-in-right"></i> Sign in }
            </button>
          </form>

          <div style="text-align:center;font-size:12.8px;color:#5A6B87;margin-top:16px">
            New to the plant system? <a routerLink="/register" style="font-weight:600">Create an account</a>
          </div>

          <div class="demo-creds">
            <div class="dc-title">Demo accounts — click to autofill</div>
            @for (cred of demoAccounts; track cred.email) {
              <div class="demo-row" (click)="fill(cred)">
                <strong>{{ cred.role }}</strong>
                <code>{{ cred.email }}</code>
              </div>
            }
          </div>
        </div>
      </section>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly demoAccounts = [
    { role: 'Admin', email: 'admin@manufacture.com', password: 'Admin@123' },
    { role: 'Production Manager', email: 'manager@manufacture.com', password: 'Manager@123' },
    { role: 'QC Inspector', email: 'qc@manufacture.com', password: 'Qc@123' },
    { role: 'Inventory Manager', email: 'inventory@manufacture.com', password: 'Inventory@123' },
    { role: 'Machine Operator', email: 'operator@manufacture.com', password: 'Operator@123' },
  ];

  fill(cred: { email: string; password: string }): void {
    this.form.setValue({ email: cred.email, password: cred.password });
    this.errorMessage.set('');
  }

  invalid(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  errorFor(field: 'email' | 'password'): string {
    const control = this.form.controls[field];
    if (control.hasError('required')) return 'This field is required.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('minlength')) return 'Password must be at least 6 characters.';
    return 'Invalid value.';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.toast.success('Signed in', res.message ?? `Welcome back, ${res.data.user.name}.`);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Unable to sign in. Please try again.');
      },
    });
  }
}
