import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ReportData } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly api = inject(ApiService);

  types(): Observable<{ key: string; title: string }[]> {
    return this.api.getData('/reports/types');
  }

  preview(type: string, query: QueryParams): Observable<ReportData> {
    return this.api.getData<ReportData>(`/reports/${type}`, query);
  }

  download(type: string, format: 'xlsx' | 'pdf', query: QueryParams): Observable<Blob> {
    return this.api.download(`/reports/${type}/download`, { ...query, format });
  }

  /** Saves a downloaded report to disk. */
  saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
