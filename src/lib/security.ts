// Client-side security utilities and rate limiting

export class ClientRateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000 // 1 minute
  ) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      console.warn(`Rate limit exceeded for ${key}`);
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

// Global rate limiter instances
export const apiRateLimiter = new ClientRateLimiter(50, 60000); // 50 requests per minute
export const authRateLimiter = new ClientRateLimiter(5, 300000); // 5 auth attempts per 5 minutes

// Security helpers
export const sanitizeUserInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

export const validateOrigin = (): boolean => {
  const allowedOrigins = [
    'https://preview--chapter-scribe-split.lovable.app',
    'https://chapter-scribe-split.lovable.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  return allowedOrigins.includes(window.location.origin);
};

// CSRF protection for forms
export const generateCSRFToken = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

// Secure session storage
export const secureStorage = {
  setItem: (key: string, value: string): void => {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      console.error('Secure storage failed:', error);
    }
  },
  
  getItem: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      console.error('Secure storage retrieval failed:', error);
      return null;
    }
  },
  
  removeItem: (key: string): void => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error('Secure storage removal failed:', error);
    }
  }
};