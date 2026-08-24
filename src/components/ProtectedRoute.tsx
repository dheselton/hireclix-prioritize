import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { loading, access, pmUser } = useAuth();
  const location = useLocation();

  // Wait until we have a resolved member when approved — avoid empty briefing flash
  if (loading || access === 'loading' || (access === 'approved' && !pmUser)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (access === 'anonymous') {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  if (access === 'denied') {
    return <Navigate to="/auth?denied=1" replace />;
  }

  if (access === 'pending') {
    return <Navigate to="/auth?pending=1" replace />;
  }

  return <>{children}</>;
}
