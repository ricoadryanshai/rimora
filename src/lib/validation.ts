import { z } from 'zod';

// Input validation schemas
export const wordReplacementSchema = z.object({
  original_word: z
    .string()
    .min(1, 'Original word is required')
    .max(500, 'Original word cannot exceed 500 characters')
    .refine(
      (val) => !val.match(/[<>'"]/),
      'Words cannot contain HTML or script characters'
    )
    .transform((val) => val.trim()),
  replacement_word: z
    .string()
    .min(1, 'Replacement word is required')
    .max(500, 'Replacement word cannot exceed 500 characters')
    .refine(
      (val) => !val.match(/[<>'"]/),
      'Words cannot contain HTML or script characters'
    )
    .transform((val) => val.trim()),
});

export const glossaryNameSchema = z
  .string()
  .min(1, 'Glossary name is required')
  .max(100, 'Glossary name cannot exceed 100 characters')
  .refine(
    (val) => !val.match(/[<>'"]/),
    'Name cannot contain HTML or script characters'
  )
  .transform((val) => val.trim());

export const csvImportSchema = z.object({
  data: z
    .array(
      z.object({
        original_word: z.string(),
        replacement_word: z.string(),
      })
    )
    .min(1, 'CSV must contain at least one valid row')
    .max(10000, 'CSV cannot contain more than 10,000 rows'),
});

// Validation utilities
export type WordReplacementInput = z.infer<typeof wordReplacementSchema>;
export type GlossaryNameInput = z.infer<typeof glossaryNameSchema>;
export type CsvImportInput = z.infer<typeof csvImportSchema>;

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Safe validation helper
export const validateInput = <T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fieldName?: string
): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(firstError.message, fieldName || firstError.path.join('.'));
    }
    throw error;
  }
};

// Input sanitization utilities
export const sanitizeText = (input: string): string => {
  return input
    .trim()
    .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
    .replace(/\s+/g, ' '); // Normalize whitespace
};

export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// Rate limiting utilities
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }
  
  reset(key: string): void {
    this.requests.delete(key);
  }
}