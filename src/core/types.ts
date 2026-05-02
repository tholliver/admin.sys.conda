import type { LogLevel } from "@/core/api-handler";

export type APIResponse<T> = {
    success: boolean
    message: string
    data?: T
    errors?: string[]
}

export type APIError = {
    success: false
    message: string
    errors?: string[]
}

export interface SuccessResponse<T> {
    success: true;
    message: string;
    data: T;
}

export interface ErrorResponse extends APIError {
    code?: string;
    details?: unknown;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export interface LogContext {
    userId?: string;
    requestId?: string;
    endpoint?: string;
    method?: string;
    ip?: string;
    userAgent?: string;
    [key: string]: unknown;
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: Error;
}
