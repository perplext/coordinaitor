import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

interface ErrorInfo {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
  retry?: () => Promise<any>;
}

interface UseErrorHandlerOptions {
  onError?: (error: ErrorInfo) => void;
  fallbackPath?: string;
  showToast?: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    onError,
    fallbackPath = '/error',
    showToast = true,
    autoRetry = false,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  const navigate = useNavigate();
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryCount = useRef(0);

  const handleError = useCallback((error: any, retry?: () => Promise<any>) => {
    console.error('Error caught:', error);

    const errorInfo: ErrorInfo = {
      message: error.message || 'An unexpected error occurred',
      code: error.code,
      statusCode: error.response?.status || error.statusCode,
      details: error.response?.data || error.details,
      retry,
    };

    setError(errorInfo);

    // Call custom error handler if provided
    if (onError) {
      onError(errorInfo);
    }

    // Show toast notification
    if (showToast) {
      if (errorInfo.statusCode === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
        return;
      } else if (errorInfo.statusCode === 403) {
        toast.error('You don\'t have permission to perform this action.');
      } else if (errorInfo.statusCode === 404) {
        toast.error('The requested resource was not found.');
      } else if (errorInfo.statusCode >= 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(errorInfo.message);
      }
    }

    // Auto retry if enabled and retry function provided
    if (autoRetry && retry && retryCount.current < maxRetries) {
      retryCount.current++;
      setIsRetrying(true);
      
      setTimeout(async () => {
        try {
          await retry();
          setError(null);
          retryCount.current = 0;
          toast.success('Operation completed successfully');
        } catch (retryError) {
          handleError(retryError, retry);
        } finally {
          setIsRetrying(false);
        }
      }, retryDelay * retryCount.current);
    }

    // Navigate to fallback path for critical errors
    if (errorInfo.statusCode === 500 && !retry) {
      navigate(fallbackPath, { state: { error: errorInfo } });
    }
  }, [onError, showToast, autoRetry, maxRetries, retryDelay, navigate, fallbackPath]);

  const clearError = useCallback(() => {
    setError(null);
    retryCount.current = 0;
  }, []);

  const retry = useCallback(async () => {
    if (error?.retry) {
      setIsRetrying(true);
      try {
        await error.retry();
        clearError();
        toast.success('Operation completed successfully');
      } catch (retryError) {
        handleError(retryError, error.retry);
      } finally {
        setIsRetrying(false);
      }
    }
  }, [error, clearError, handleError]);

  // Reset retry count when error changes
  useEffect(() => {
    if (!error) {
      retryCount.current = 0;
    }
  }, [error]);

  return {
    error,
    isRetrying,
    handleError,
    clearError,
    retry,
    retryCount: retryCount.current,
  };
}

// Hook for async operations with error handling
export function useAsyncError() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const throwError = useCallback((error: Error) => {
    setError(error);
  }, []);

  return throwError;
}

// Hook for handling API errors
export function useApiErrorHandler() {
  const { handleError } = useErrorHandler({
    showToast: true,
    autoRetry: true,
    maxRetries: 2,
  });

  const handleApiError = useCallback((error: any) => {
    // Extract meaningful error message from API response
    let message = 'An error occurred';
    
    if (error.response?.data?.message) {
      message = error.response.data.message;
    } else if (error.response?.data?.error) {
      message = error.response.data.error;
    } else if (error.message) {
      message = error.message;
    }

    const enhancedError = {
      ...error,
      message,
    };

    handleError(enhancedError);
  }, [handleError]);

  return handleApiError;
}

// Hook for handling form errors
export function useFormErrorHandler() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleFormError = useCallback((error: any) => {
    if (error.response?.data?.errors) {
      // Handle validation errors
      const errors = error.response.data.errors;
      
      if (Array.isArray(errors)) {
        // Array of errors
        const errorMap: Record<string, string> = {};
        errors.forEach((err: any) => {
          if (err.field) {
            errorMap[err.field] = err.message;
          }
        });
        setFieldErrors(errorMap);
      } else if (typeof errors === 'object') {
        // Object with field names as keys
        setFieldErrors(errors);
      }
    } else {
      // General error
      toast.error(error.message || 'Form submission failed');
    }
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  return {
    fieldErrors,
    handleFormError,
    clearFieldError,
    clearAllErrors,
  };
}