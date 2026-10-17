export interface LogContext {
  [key: string]: any;
}

export class PrivacyLogger {
  private static readonly REDACTED_KEYS = new Set([
    'password',
    'passwordhash',
    'token',
    'accesstoken',
    'refreshtoken',
    'authorization',
    'secret',
    'jwt',
    'apikey',
  ]);

  public static maskEmail(email: string): string {
    const emailRegex = /^([^@\s]+)@([^@\s]+\.[^@\s]+)$/;
    const match = email.match(emailRegex);
    if (!match) return '[INVALID_EMAIL]';

    const [_, user, domain] = match;
    if (user.length <= 2) {
      return `${user[0]}***@${domain}`;
    }
    return `${user[0]}***${user.at(-1)}@${domain}`;
  }

  public static maskPhone(phone: string): string {
    const cleaned = phone.replace(/\s+/g, '');
    if (cleaned.length < 7) return '***';
    return `${cleaned.slice(0, 3)}***${cleaned.slice(-2)}`;
  }

  public static sanitizeString(text: string): string {
    if (typeof text !== 'string') {
      return typeof text === 'undefined' ? '' : String(text);
    }
    let sanitized: string = text;

    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
    sanitized = sanitized.replace(emailRegex, (match) => this.maskEmail(match));

    const jwtRegex = /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g;
    sanitized = sanitized.replace(jwtRegex, '[REDACTED_JWT]');

    const inlineSecretRegex = /(password|token|secret)\s*[:=]\s*["']?([^"',\s}]+)["']?/gi;
    sanitized = sanitized.replace(inlineSecretRegex, '$1=[REDACTED]');

    return sanitized;
  }

  // --- ДЕКОМПОЗОВАНІ ХЕЛПЕРИ ДЛЯ ЗНИЖЕННЯ СКЛАДНОСТІ (Clean Code) ---

  /**
   * Helper: обробка екземплярів помилок Error (Cognitive: 1, Cyclomatic: 2)
   */
  private static sanitizeError(error: Error): Record<string, any> {
    return {
      name: error.name,
      message: this.sanitizeString(error.message),
      stack: error.stack ? this.sanitizeString(error.stack) : undefined,
    };
  }

  /**
   * Helper: визначення значення конкретної властивості (Cognitive: 2, Cyclomatic: 4)
   * Усуває вкладеність і ланцюжки if-else всередині циклу
   */
  private static sanitizePropertyValue(key: string, value: any): any {
    const lowerKey = key.toLowerCase();

    if (this.REDACTED_KEYS.has(lowerKey)) {
      return '[REDACTED]';
    }
    if (lowerKey.includes('email') && typeof value === 'string') {
      return this.maskEmail(value);
    }
    if (lowerKey.includes('phone') && typeof value === 'string') {
      return this.maskPhone(value);
    }
    return this.sanitizeObject(value);
  }

  /**
   * Helper: обробка пласких об'єктів (Cognitive: 1, Cyclomatic: 2)
   */
  private static sanitizePlainObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = this.sanitizePropertyValue(key, value);
    }
    return sanitized;
  }

  /**
   * Головний метод маршрутизації типів (Guard Clauses / Early Return)
   * Показники після рефакторингу:
   * Cyclomatic Complexity: 5 (було 14)
   * Cognitive Complexity: 4 (було 17)
   */
  public static sanitizeObject(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeObject(item));
    }
    if (data instanceof Error) {
      return this.sanitizeError(data);
    }
    if (typeof data === 'object') {
      return this.sanitizePlainObject(data);
    }
    return data;
  }

  // --- МЕТОДИ ЛОГУВАННЯ ---

  public static info(message: string, context?: LogContext): string {
    const formatted = this.formatOutput('INFO', message, context);
    console.log(formatted);
    return formatted;
  }

  public static warn(message: string, context?: LogContext): string {
    const formatted = this.formatOutput('WARN', message, context);
    console.warn(formatted);
    return formatted;
  }

  public static error(message: string, errorOrContext?: any): string {
    const formatted = this.formatOutput('ERROR', message, errorOrContext);
    console.error(formatted);
    return formatted;
  }

  private static formatOutput(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const cleanMessage = this.sanitizeString(message);
    const cleanMeta = meta ? this.sanitizeObject(meta) : undefined;

    return JSON.stringify({
      timestamp,
      level,
      message: cleanMessage,
      ...(cleanMeta ? { context: cleanMeta } : {}),
    });
  }
}