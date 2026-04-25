import type {
  APIError,
  ErrorResponse,
  LogContext,
  LogEntry,
  SuccessResponse,
} from "@/types/api";
import z from "zod/v4";
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
}

export const Messages = {
  SUCCESS: "Operación exitosa",
  VALIDATION_ERROR: "Error en la validación de datos",
  NOT_FOUND: (resource: string = "Recurso") => `${resource} no encontrado`,
  UNAUTHORIZED: "No autorizado",
  FORBIDDEN: "Prohibido",
  CONFLICT: "Conflicto de datos",
  UNPROCESSABLE: "Entidad no procesable",
  SERVER_ERROR: "Error interno del servidor",
};

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

export const ParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,50}$/, "Invalid driver ID format")
    .transform((val) => parseInt(val, 10)),
});

export class ApiResponseHandler {
  private static readonly JSON_HEADERS = { "Content-Type": "application/json" };

  // Generic response builder
  private static buildResponse<T>(
    data: T | null,
    message: string,
    status: HttpStatus,
    success: boolean,
    code?: string,
    errors?: string[],
  ): Response {
    const response: Record<string, unknown> = {
      success,
      message,
      ...(data !== null && { data }),
      ...(code && { code }),
      ...(errors && { errors }),
    };

    return new Response(JSON.stringify(response), {
      status,
      headers: this.JSON_HEADERS,
    });
  }

  // Generic file response builder
  private static buildFileResponse(
    buffer: Buffer | Uint8Array,
    filename: string,
    mimeType: string,
    status: HttpStatus,
    inline: boolean = false,
  ): Response {
    const disposition = inline ? "inline" : "attachment";
    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Content-Length": buffer.length.toString(),
    };

    return new Response(new Uint8Array(buffer), { status, headers });
  }

  // Success responses
  static success<T>(
    data?: T,
    message: string = "Operation successful",
    status: HttpStatus = HttpStatus.OK,
  ): Response {
    return this.buildResponse(data ?? null, message, status, true);
  }

  static error(
    message: string = Messages.SERVER_ERROR,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    code?: string,
    errors?: string[],
  ): Response {
    return this.buildResponse(null, message, status, false, code, errors);
  }

  // File responses
  static file(
    buffer: Buffer | Uint8Array,
    filename: string,
    mimeType: string = "application/octet-stream",
    status: HttpStatus = HttpStatus.OK,
  ): Response {
    return this.buildFileResponse(buffer, filename, mimeType, status, false);
  }

  static excel(
    buffer: Buffer | Uint8Array,
    filename: string = "export.xlsx",
    status: HttpStatus = HttpStatus.OK,
  ): Response {
    return this.buildFileResponse(
      buffer,
      filename,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      status,
      false,
    );
  }

  static pdf(
    buffer: Buffer | Uint8Array,
    filename: string = "document.pdf",
    status: HttpStatus = HttpStatus.OK,
  ): Response {
    return this.buildFileResponse(
      buffer,
      filename,
      "application/pdf",
      status,
      false,
    );
  }

  static csv(
    buffer: Buffer | Uint8Array,
    filename: string = "data.csv",
    status: HttpStatus = HttpStatus.OK,
  ): Response {
    return this.buildFileResponse(buffer, filename, "text/csv", status, false);
  }

  static image(
    buffer: Buffer | Uint8Array,
    filename: string,
    mimeType:
      | "image/png"
      | "image/jpeg"
      | "image/gif"
      | "image/webp" = "image/png",
    status: HttpStatus = HttpStatus.OK,
  ): Response {
    return this.buildFileResponse(buffer, filename, mimeType, status, true);
  }

  // Error shortcuts
  static validationError(errors: string[]): Response {
    return this.error(
      Messages.VALIDATION_ERROR,
      HttpStatus.BAD_REQUEST,
      "VALIDATION_ERROR",
      errors,
    );
  }

  static notFound(resource: string = "Recurso"): Response {
    return this.error(
      Messages.NOT_FOUND(resource),
      HttpStatus.NOT_FOUND,
      "NOT_FOUND",
    );
  }

  static conflict(message: string = Messages.CONFLICT): Response {
    return this.error(message, HttpStatus.CONFLICT, "CONFLICT");
  }

  static unprocessable(message: string = Messages.UNPROCESSABLE): Response {
    return this.error(
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      "UNPROCESSABLE_ENTITY",
    );
  }

  static unauthorized(message: string = Messages.UNAUTHORIZED): Response {
    return this.error(message, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
  }

  static forbidden(message: string = Messages.FORBIDDEN): Response {
    return this.error(message, HttpStatus.FORBIDDEN, "FORBIDDEN");
  }
}

export class Logger {
  private static instance: Logger;
  private context: LogContext = {};

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // Set global context that will be included in all logs
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  // Clear global context
  clearContext(): void {
    this.context = {};
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry;

    const logData = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(context && Object.keys(context).length > 0 && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    return JSON.stringify(logData, null, 2);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      error,
    };

    const formattedLog = this.formatLogEntry(entry);

    // In production, you might want to send this to a logging service
    // For now, we'll use console methods
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedLog);
        break;
      default:
        console.log(formattedLog);
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // API-specific logging methods
  apiRequest(method: string, endpoint: string, context?: LogContext): void {
    this.info(`${method} ${endpoint} - Request initiated`, {
      method,
      endpoint,
      ...context,
    });
  }

  apiResponse(
    method: string,
    endpoint: string,
    status: number,
    duration?: number,
    context?: LogContext,
  ): void {
    this.info(`${method} ${endpoint} - Response ${status}`, {
      method,
      endpoint,
      status,
      ...(duration && { duration: `${duration}ms` }),
      ...context,
    });
  }

  apiError(
    method: string,
    endpoint: string,
    error: Error,
    context?: LogContext,
  ): void {
    this.error(`${method} ${endpoint} - API Error`, error, {
      method,
      endpoint,
      ...context,
    });
  }

  dbQuery(query: string, duration?: number, context?: LogContext): void {
    this.debug("Database query executed", {
      query,
      ...(duration && { duration: `${duration}ms` }),
      ...context,
    });
  }

  dbError(query: string, error: Error, context?: LogContext): void {
    this.error("Database query failed", error, {
      query,
      ...context,
    });
  }
}

// Utility function to create a logger instance with request context
export function createRequestLogger(request: Request): Logger {
  const logger = Logger.getInstance();
  const url = new URL(request.url);

  logger.setContext({
    requestId: crypto.randomUUID(),
    method: request.method,
    endpoint: url.pathname,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  return logger;
}
