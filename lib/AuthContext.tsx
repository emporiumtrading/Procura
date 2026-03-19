import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient, User, Session, AuthError } from '@supabase/supabase-js';
import { api } from './api';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('FATAL: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in environment.');
}

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      // Security Note: localStorage is used for session storage per Supabase SDK design.
      // Ensure strict CSP headers to mitigate XSS risks.
      storage: localStorage,
      storageKey: 'procura-auth-token',
    },
    global: {
      headers: {
        'X-Client-Info': 'procura-app',
      },
    },
  }
);

// Types
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const getE2EMockUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  // Security: E2E bypass only when explicitly enabled for test builds (VITE_E2E_TEST_MODE=1).
  // Production deployments must never set this.
  if (import.meta.env.PROD && import.meta.env.VITE_E2E_TEST_MODE !== '1') return null;
  if (window.location.search.includes('e2e=1') || window.location.hash.includes('e2e=1')) {
    return {
      id: 'e2e-user',
      email: 'e2e@test.com',
      app_metadata: {},
      user_metadata: { role: 'user' },
      aud: 'authenticated',
      created_at: '',
    } as User;
  }
  return null;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const e2eUser = getE2EMockUser();
  const [user, setUser] = useState<User | null>(e2eUser);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(() => (e2eUser !== null ? false : true));

  // Fail-fast if Supabase is not configured and we are NOT in an E2E bypass context.
  if (!supabaseConfigured && !e2eUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="text-center max-w-md p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Required</h1>
          <p className="text-gray-600">
            VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your environment variables.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (e2eUser !== null) return;

    let cancelled = false;
    const safetyTimeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('Auth initialization timed out after 10s. Continuing without session.');
        setLoading(false);
      }
    }, 10000);

    const initSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.access_token) {
          api.setToken(session.access_token);
        } else {
          api.clearToken();
        }
      } catch {
        // Session initialization failed - user will need to log in
      } finally {
        if (!cancelled) {
          clearTimeout(safetyTimeout);
          setLoading(false);
        }
      }
    };

    initSession();

    // Listen for auth changes
    // CRITICAL: This callback must be synchronous (no await) because the
    // Supabase client awaits all onAuthStateChange callbacks internally.
    // Any hanging async call here blocks signInWithPassword from resolving.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.access_token) {
        api.setToken(session.access_token);
      } else {
        api.clearToken();
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting sign in...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Sign in error:', error.message);
        return { error };
      }

      if (data.session) {
        console.log('✅ Login successful');
        setSession(data.session);
        setUser(data.user);
        api.setToken(data.session.access_token);
      }

      return { error };
    } catch (err: any) {
      console.error('❌ Sign in exception:', err);
      return { error: { message: err.message || 'Authentication failed' } as AuthError };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/#/dashboard`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    api.clearToken();
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/reset-password`,
    });
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
