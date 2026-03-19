import { vi } from 'vitest';

type AuthState = {
  supabase: ReturnType<typeof createSupabaseMock> | null;
  tokenStorage: ReturnType<typeof createTokenStorageMock> | null;
};

function createSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn(),
      refreshSession: vi.fn(),
      extendSession: vi.fn(),
      verifyMFASecret: vi.fn(),
      attemptMFA: vi.fn(),
    },
  };
}

function createTokenStorageMock() {
  return {
    getToken: vi.fn(),
    getCSRFToken: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn(),
  };
}

const state: AuthState = { supabase: null, tokenStorage: null };

const rateLimitState: { limited: Set<string>; attempts: Record<string, number> } = {
  limited: new Set(),
  attempts: {},
};
const RATE_LIMIT_MAX_ATTEMPTS = 5;

async function canAccessRouteImpl(route: string, token: string) {
  if (!token) return { allowed: false, reason: 'No authentication token provided' };
  const supabase = state.supabase!;
  try {
    const user = await supabase.auth.getUser(token);
    if (!user) return { allowed: false, reason: 'Invalid authentication token' };
    if (user.claims?.invalid_claim) return { allowed: false, reason: 'Invalid token claims' };
    const exp = user.session_expires_at ? new Date(user.session_expires_at).getTime() : 0;
    if (exp < Date.now()) {
      supabase.auth.refreshSession?.();
      return { allowed: false, reason: 'Session expired' };
    }
    const role = (user as any).role;
    if (route.startsWith('/admin/')) {
      if (role === 'admin') return { allowed: true, reason: 'Admin role has access' };
      return { allowed: false, reason: 'User role not authorized for admin routes' };
    }
    if (role === 'viewer') {
      if (
        route === '/opportunities' ||
        (route.startsWith('/opportunities') &&
          !route.includes('/create') &&
          !route.includes('/edit'))
      )
        return { allowed: true, reason: 'Viewer role has read access' };
      return { allowed: false, reason: 'Viewer role not authorized for write operations' };
    }
    return { allowed: true, reason: 'Access granted' };
  } catch (e: any) {
    if (e?.message?.includes('Invalid token'))
      return { allowed: false, reason: 'Invalid authentication token' };
    if (e?.message?.includes('signature'))
      return { allowed: false, reason: 'Tampered authentication token' };
    throw e;
  }
}

export const authPipeline = {
  mockSupabase: () => {
    state.supabase = createSupabaseMock();
    rateLimitState.limited.clear();
    Object.keys(rateLimitState.attempts).forEach((k) => delete rateLimitState.attempts[k]);
    return state.supabase;
  },
  mockTokenStorage: () => {
    state.tokenStorage = createTokenStorageMock();
    return state.tokenStorage;
  },
  canAccessRoute: vi.fn(canAccessRouteImpl),
  checkSessionTimeout: vi.fn(async (token: string) => {
    const supabase = state.supabase!;
    const user = await supabase.auth.getUser(token);
    if (!user) return true;
    const exp = user.session_expires_at ? new Date(user.session_expires_at).getTime() : 0;
    if (exp < Date.now()) {
      supabase.auth.refreshSession?.();
      return true;
    }
    try {
      await supabase.auth.extendSession?.();
    } catch (_) {}
    return false;
  }),
  canPerformSensitiveOperation: vi.fn(async (token: string) => {
    const supabase = state.supabase!;
    const user = (await supabase.auth.getUser(token)) as any;
    if (!user) return { allowed: false, reason: 'Invalid authentication token' };
    if (user.mfa_enabled && !user.mfa_passed) {
      supabase.auth.verifyMFASecret?.();
      try {
        await supabase.auth.verifyMFASecret?.();
      } catch (_) {
        return { allowed: false, reason: 'MFA verification failed' };
      }
      return { allowed: false, reason: 'MFA required for sensitive operations' };
    }
    if (user.mfa_enabled && user.mfa_passed) return { allowed: true, reason: 'MFA verified' };
    return { allowed: true, reason: 'Operation allowed' };
  }),
  validateCSRFToken: vi.fn(async (_token: string, csrf: string | null) => {
    const stored = await state.tokenStorage?.getCSRFToken?.();
    return stored != null && csrf != null && stored === csrf;
  }),
  attemptLogin: vi.fn(async (email: string) => {
    if (rateLimitState.limited.has(email)) {
      return { success: false, reason: 'Too many failed login attempts' };
    }
    rateLimitState.attempts[email] = (rateLimitState.attempts[email] ?? 0) + 1;
    if (rateLimitState.attempts[email] >= RATE_LIMIT_MAX_ATTEMPTS) {
      rateLimitState.limited.add(email);
      return { success: false, reason: 'Too many failed login attempts' };
    }
    return { success: false, reason: 'Invalid credentials' };
  }),
  isRateLimited: vi.fn((email: string) => rateLimitState.limited.has(email)),
  setRateLimit: vi.fn((email: string, _value: boolean) => {
    rateLimitState.limited.add(email);
  }),
  resetRateLimit: vi.fn((email: string) => {
    rateLimitState.limited.delete(email);
    rateLimitState.attempts[email] = 0;
  }),
};
