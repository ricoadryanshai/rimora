import { toast } from '@/hooks/use-toast';
import { ValidationError } from './validation';

// Error types for better categorization
export enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  AUTH = 'auth',
  DATABASE = 'database',
  UNKNOWN = 'unknown',
}

export interface AppError {
  message: string;
  category: ErrorCategory;
  field?: string;
  code?: string;
  retryable?: boolean;
}

// Error classification utility
export const classifyError = (error: unknown): AppError => {
  if (error instanceof ValidationError) {
    return {
      message: error.message,
      category: ErrorCategory.VALIDATION,
      field: error.field,
      retryable: false,
    };
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message);
    
    // Supabase/Database errors
    if (message.includes('duplicate key value') || message.includes('violates unique constraint')) {
      return {
        message: 'This entry already exists',
        category: ErrorCategory.DATABASE,
        retryable: false,
      };
    }
    
    if (message.includes('violates row-level security policy')) {
      return {
        message: 'You do not have permission to perform this action',
        category: ErrorCategory.AUTH,
        retryable: false,
      };
    }
    
    if (message.includes('JWT')) {
      return {
        message: 'Your session has expired. Please log in again.',
        category: ErrorCategory.AUTH,
        retryable: false,
      };
    }
    
    // Network errors
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return {
        message: 'Network connection error. Please check your internet connection.',
        category: ErrorCategory.NETWORK,
        retryable: true,
      };
    }
    
    if (message.includes('timeout')) {
      return {
        message: 'Request timed out. Please try again.',
        category: ErrorCategory.NETWORK,
        retryable: true,
      };
    }
    
    return {
      message,
      category: ErrorCategory.UNKNOWN,
      retryable: true,
    };
  }
  
  return {
    message: 'An unexpected error occurred',
    category: ErrorCategory.UNKNOWN,
    retryable: true,
  };
};

// Centralized error handler
export const handleError = (error: unknown, context?: string): AppError => {
  const appError = classifyError(error);
  
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context || 'App'}] Error:`, error);
  }
  
  // Show toast notification based on error category
  const variant = appError.category === ErrorCategory.VALIDATION ? 'destructive' : 'destructive';
  
  toast({
    title: getErrorTitle(appError.category),
    description: appError.message,
    variant,
  });
  
  return appError;
};

// Get appropriate error title based on category
const getErrorTitle = (category: ErrorCategory): string => {
  switch (category) {
    case ErrorCategory.VALIDATION:
      return 'Invalid Input';
    case ErrorCategory.NETWORK:
      return 'Connection Error';
    case ErrorCategory.AUTH:
      return 'Authentication Error';
    case ErrorCategory.DATABASE:
      return 'Database Error';
    default:
      return 'Error';
  }
};

// Retry wrapper for operations that might fail temporarily
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const appError = classifyError(error);
      
      // Don't retry if error is not retryable
      if (!appError.retryable || attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }
  
  throw lastError;
};

// Async error boundary handler
export const handleAsync = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, fn.name);
      return null;
    }
  };
};