import { z } from 'zod';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export class ValidationResult<T> {
  constructor(
    public success: boolean,
    public data?: T,
    public errors: ValidationError[] = []
  ) {}

  static success<T>(data: T): ValidationResult<T> {
    return new ValidationResult(true, data);
  }

  static failure<T>(errors: ValidationError[]): ValidationResult<T> {
    return new ValidationResult(false, undefined, errors);
  }
}

/**
 * Email validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Password strength validation
 */
export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0-100
  feedback: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score += 20;
  }

  if (password.length >= 12) {
    score += 10;
  }

  if (/[a-z]/.test(password)) {
    score += 15;
  } else {
    feedback.push('Include lowercase letters');
  }

  if (/[A-Z]/.test(password)) {
    score += 15;
  } else {
    feedback.push('Include uppercase letters');
  }

  if (/\d/.test(password)) {
    score += 15;
  } else {
    feedback.push('Include numbers');
  }

  if (/[^a-zA-Z\d]/.test(password)) {
    score += 15;
  } else {
    feedback.push('Include special characters');
  }

  // Bonus for variety
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.7) {
    score += 10;
  }

  return {
    valid: score >= 60 && feedback.length === 0,
    score: Math.min(100, score),
    feedback
  };
}

/**
 * Task validation schemas
 */
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const TaskStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export const TaskTypeSchema = z.enum(['general', 'code', 'documentation', 'analysis', 'deployment', 'testing']);

export const CreateTaskSchema = z.object({
  prompt: z.string().min(10).max(5000),
  type: TaskTypeSchema.optional().default('general'),
  priority: TaskPrioritySchema.optional().default('medium'),
  context: z.record(z.any()).optional(),
  dependencies: z.array(z.string()).optional(),
  estimatedDuration: z.number().positive().optional(),
  maxRetries: z.number().int().min(0).max(5).optional().default(3)
});

export const UpdateTaskSchema = z.object({
  prompt: z.string().min(10).max(5000).optional(),
  type: TaskTypeSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  status: TaskStatusSchema.optional(),
  context: z.record(z.any()).optional(),
  dependencies: z.array(z.string()).optional(),
  estimatedDuration: z.number().positive().optional()
});

/**
 * Agent validation schemas
 */
export const AgentConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum(['cli', 'api', 'code', 'documentation', 'analysis']),
  provider: z.string().min(1),
  version: z.string().min(1),
  capabilities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.any()).optional()
  })),
  endpoint: z.string().url().optional(),
  maxConcurrentTasks: z.number().int().positive().optional().default(5),
  timeout: z.number().positive().optional().default(30000),
  retryAttempts: z.number().int().min(0).max(5).optional().default(3),
  cost: z.object({
    currency: z.string().length(3),
    unit: z.enum(['request', 'minute', 'hour', 'day']),
    amount: z.number().positive()
  }).optional()
});

/**
 * User validation schemas
 */
export const CreateUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roles: z.array(z.string()).optional()
});

export const UpdateUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional()
});

/**
 * Knowledge validation schemas
 */
export const KnowledgeEntrySchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  type: z.enum(['best-practice', 'solution', 'snippet', 'documentation', 'lesson-learned']),
  tags: z.array(z.string().min(1).max(50)).max(20),
  category: z.string().min(1).max(100).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
  metadata: z.record(z.any()).optional()
});

/**
 * Generic validation helper
 */
export function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return ValidationResult.success(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors: ValidationError[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      return ValidationResult.failure(validationErrors);
    }
    
    return ValidationResult.failure([{
      field: 'unknown',
      message: 'Validation failed',
      code: 'VALIDATION_ERROR'
    }]);
  }
}

/**
 * Sanitization utilities
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeString(sanitized[key]);
    }
  }
  return sanitized;
}

/**
 * URL validation
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * ID validation
 */
export function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length >= 1 && id.length <= 100;
}