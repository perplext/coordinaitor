import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff, Database } from 'lucide-react';

interface FallbackProps {
  type: 'offline' | 'error' | 'maintenance' | 'degraded';
  message?: string;
  onRetry?: () => void;
  showDetails?: boolean;
  details?: string;
}

export const Fallback: React.FC<FallbackProps> = ({
  type,
  message,
  onRetry,
  showDetails = false,
  details,
}) => {
  const configs = {
    offline: {
      icon: WifiOff,
      title: 'You\'re Offline',
      defaultMessage: 'Please check your internet connection and try again.',
      color: 'text-gray-500',
      bgColor: 'bg-gray-50',
    },
    error: {
      icon: AlertTriangle,
      title: 'Something Went Wrong',
      defaultMessage: 'We encountered an error while loading this content.',
      color: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    maintenance: {
      icon: Database,
      title: 'Under Maintenance',
      defaultMessage: 'We\'re performing scheduled maintenance. Please check back soon.',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
    },
    degraded: {
      icon: AlertTriangle,
      title: 'Limited Functionality',
      defaultMessage: 'Some features may be unavailable. We\'re working to restore full service.',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="text-center max-w-md">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${config.bgColor} mb-4`}>
          <Icon className={`w-8 h-8 ${config.color}`} />
        </div>
        
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          {config.title}
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message || config.defaultMessage}
        </p>

        {showDetails && details && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              Show details
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto">
              {details}
            </pre>
          </details>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

// Loading fallback with skeleton
export const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div className="animate-pulse p-8">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
      </div>
      <p className="text-center text-gray-500 dark:text-gray-400 mt-8">{message}</p>
    </div>
  );
};

// Offline detector component
export const OfflineDetector: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return <Fallback type="offline" />;
  }

  return <>{children}</>;
};

// Feature flag fallback
export const FeatureFallback: React.FC<{
  feature: string;
  isEnabled: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ feature, isEnabled, children, fallback }) => {
  if (!isEnabled) {
    return (
      <>
        {fallback || (
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {feature} is currently unavailable
            </p>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
};

// Graceful degradation wrapper
export const GracefulDegradation: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
}> = ({ children, fallback, onError }) => {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(new Error(event.message));
      if (onError) {
        onError(new Error(event.message));
      }
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [onError]);

  if (hasError) {
    return (
      <>
        {fallback || (
          <Fallback
            type="degraded"
            message={error?.message}
            onRetry={() => {
              setHasError(false);
              setError(null);
            }}
          />
        )}
      </>
    );
  }

  return <>{children}</>;
};