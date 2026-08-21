import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const { user, loading, access, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const denied = params.get('denied') === '1';
  const oauthError = params.get('error_description') || params.get('error');
  const [callbackWaitExpired, setCallbackWaitExpired] = useState(false);
  const nextPath = useMemo(() => {
    const raw = params.get('next');
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
    return raw;
  }, [params]);

  useEffect(() => {
    if (!loading && access === 'approved') {
      navigate(nextPath, { replace: true });
    }
  }, [access, loading, navigate, nextPath]);

  useEffect(() => {
    if (!oauthError) return;
    toast({
      title: 'Sign in failed',
      description: oauthError,
      variant: 'destructive',
    });
  }, [oauthError, toast]);

  useEffect(() => {
    if (!params.has('code') || oauthError) return;
    const t = window.setTimeout(() => setCallbackWaitExpired(true), 12000);
    return () => window.clearTimeout(t);
  }, [params, oauthError]);

  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Stay on spinner while PKCE code is exchanged (avoid showing Sign in mid-callback)
  if (
    loading ||
    (params.has('code') && access === 'anonymous' && !oauthError && !callbackWaitExpired)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold tracking-tight">
            HireClix Prioritize
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {denied || access === 'denied'
              ? 'HireClix Prioritize is only available with a HireClix Google account.'
              : 'Sign in with your HireClix Google account'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(denied || access === 'denied') && user ? (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Signed in as <span className="font-medium text-foreground">{user.email}</span>.
                Use your <code>@hireclix.com</code> Google account to continue.
              </p>
              <Button onClick={() => void signOut()} variant="outline" className="w-full h-12">
                Sign out and try another account
              </Button>
            </>
          ) : (
            <Button
              onClick={handleGoogleSignIn}
              variant="outline"
              className="w-full h-12 text-base font-medium gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
