import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../models';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/** Thin wrapper around HttpClient that talks to the Express REST API. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = '/api';

  static toParams(query?: QueryParams): HttpParams {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
      });
    }
    return params;
  }

  get<T>(path: string, query?: QueryParams): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${path}`, { params: ApiService.toParams(query) });
  }

  /** Returns just the payload (most list/detail requests). */
  getData<T>(path: string, query?: QueryParams): Observable<T> {
    return this.get<T>(path, query).pipe(map((res) => res.data));
  }

  post<T>(path: string, body: unknown = {}): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${path}`, body);
  }

  put<T>(path: string, body: unknown = {}): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}${path}`, body);
  }

  patch<T>(path: string, body: unknown = {}): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(`${this.baseUrl}${path}`, body);
  }

  delete<T>(path: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}${path}`);
  }

  /** Multipart helper for defect image uploads. */
  postForm<T>(path: string, form: FormData): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${path}`, form);
  }

  putForm<T>(path: string, form: FormData): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}${path}`, form);
  }

  /** Fetches a binary report (xlsx / pdf) as a Blob. */
  download(path: string, query?: QueryParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${path}`, { params: ApiService.toParams(query), responseType: 'blob' });
  }
}
