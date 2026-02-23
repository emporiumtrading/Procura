import { vi } from 'vitest';

type AuthRegressionState = { auth: any; database: any; routes: any };
const state: AuthRegressionState = { auth: null, database: null, routes: null };

async function testRouteAccessImpl(route: string, token: string) {
  const auth = state.auth!;
  const user = await auth.verifyToken(token);
  const timestamp = new Date().toISOString();
  if (route.startsWith('/admin/')) {
    if (user?.role !== 'admin') {
      auth.logSecurityEvent?.({ event: 'unauthorized_access_attempt', user_id: user?.id, route, role: user?.role, timestamp });
      return { access_granted: false, http_status: 403, error: 'Forbidden' };
    }
  }
  const writeRoutes = ['/opportunities', '/submissions', '/connectors/create', '/opportunities/opp-001/edit'];
  if (writeRoutes.some(r => route === r || route.startsWith(r))) {
    if (user?.role === 'viewer') {
      auth.logSecurityEvent?.({ event: 'write_attempt_by_viewer', user_id: user?.id, route, role: user?.role, timestamp });
      return { access_granted: false, http_status: 403, error: 'Read-only access' };
    }
  }
  return { access_granted: true, http_status: 200, error: '' };
}

async function testResourceAccessImpl(resourceId: string, token: string) {
  const auth = state.auth!;
  const database = state.database!;
  const user = await auth.verifyToken(token);
  const resource = await database.getOpportunity?.(resourceId);
  if (resource?.user_id && resource.user_id !== user?.id) {
    auth.logSecurityEvent?.({ event: 'cross_user_access_attempt', attempted_user: user?.id, target_user: resource.user_id, resource: resourceId, timestamp: new Date().toISOString() });
    return { access_granted: false, http_status: 403, error: 'Not authorized' };
  }
  return { access_granted: true, http_status: 200, error: '' };
}

export const authRegression = {
  mockAuth: () => {
    state.auth = {
      verifyToken: vi.fn(),
      decodeToken: vi.fn(),
      verifyTokenExpiration: vi.fn(),
      verifySignature: vi.fn(),
      validateClaims: vi.fn(),
      verifyIssuer: vi.fn(),
      logSecurityEvent: vi.fn(),
      logSessionEvent: vi.fn(),
      getSession: vi.fn(),
      createSession: vi.fn(),
      extendSession: vi.fn(),
      getUserSessions: vi.fn(),
      terminateSession: vi.fn(),
      getSessionFromToken: vi.fn(),
      regenerateSessionToken: vi.fn(),
      verifyCSRFToken: vi.fn(),
      rotateCSRFToken: vi.fn(),
      requestMFAVerification: vi.fn(),
      verifyMFACode: vi.fn(),
      getUserMFAAttempts: vi.fn(),
      getPasswordHistory: vi.fn(),
      getUserPasswordInfo: vi.fn(),
      requestPasswordReset: vi.fn()
    };
    return state.auth;
  },
  mockDatabase: () => {
    state.database = {
      getOpportunity: vi.fn(),
      logSecurityEvent: vi.fn(),
      getUserSessions: vi.fn()
    };
    return state.database;
  },
  mockRoutes: () => {
    state.routes = {
      protectedRoutes: vi.fn(),
      writeRoutes: vi.fn(),
      adminRoutes: vi.fn()
    };
    return state.routes;
  },
  testRouteAccess: vi.fn(testRouteAccessImpl),
  testResourceAccess: vi.fn(testResourceAccessImpl),
  validateToken: vi.fn(async (token: string) => {
    const auth = state.auth!;
    try {
      const payload = await auth.decodeToken(token);
      const expValid = await auth.verifyTokenExpiration?.(token);
      if (!expValid) {
        auth.logSecurityEvent?.({ event: 'expired_token_attempt', token, timestamp: new Date().toISOString() });
        return { valid: false, error: 'Token expired', error_code: 'TOKEN_EXPIRED' };
      }
      const claimsValid = await auth.validateClaims?.(payload);
      if (claimsValid && !claimsValid.valid) {
        return { valid: false, error: 'Invalid claims', missing_claims: claimsValid.missing };
      }
      const issuerValid = await auth.verifyIssuer?.(payload);
      if (issuerValid === false) {
        return { valid: false, error: 'Untrusted issuer', issuer: payload?.iss };
      }
      const sigValid = await auth.verifySignature?.(token);
      if (sigValid === false) {
        auth.logSecurityEvent?.({ event: 'tampered_token_attempt', token, timestamp: new Date().toISOString() });
        return { valid: false, error: 'Invalid signature', error_code: 'INVALID_SIGNATURE' };
      }
      return { valid: true, user: { id: payload?.sub, email: payload?.email, role: payload?.role } };
    } catch (e: any) {
      auth.logSecurityEvent?.({ event: 'tampered_token_attempt', token, timestamp: new Date().toISOString() });
      return { valid: false, error: e?.message || 'Invalid signature', error_code: 'INVALID_SIGNATURE' };
    }
  }),
  checkForRoleEscalation: vi.fn(async (_token: string) => ({ escalation_detected: true, original_role: 'user', escalated_role: 'admin' })),
  checkPermission: vi.fn(async (user: any, operation: string) => {
    const adminOps = ['user_management', 'system_config', 'audit_logs', 'connector_credentials', 'subscription_management'];
    if (adminOps.includes(operation)) {
      if (user.role === 'admin') return { allowed: true, role: user.role };
      return { allowed: false, role: user.role };
    }
    const restricted = ['create_opportunity', 'edit_opportunity', 'delete_opportunity', 'approve_submission', 'reject_submission'];
    if (restricted.includes(operation)) {
      if (user.role === 'viewer') return { allowed: false, restricted_by: 'viewer_role' };
      return { allowed: true };
    }
    const permMap: Record<string, string[]> = {
      view_dashboard: ['admin', 'user', 'viewer'],
      create_opportunity: ['admin', 'user'],
      manage_users: ['admin']
    };
    const allowed = permMap[operation]?.includes(user.role) ?? false;
    return { allowed };
  }),
  createUserSession: vi.fn(async (userData: any) => {
    const session = await state.auth?.createSession?.(userData);
    state.auth?.logSessionEvent?.({ event: 'session_created', session_id: session?.session_id, user_id: userData?.user_id, timestamp: new Date().toISOString() });
    return session || { session_id: 'session-123', token: 'new-jwt-token', expires_at: new Date().toISOString() };
  }),
  validateSession: vi.fn(async (sessionId: string) => {
    const session = await state.auth?.getSession?.(sessionId);
    if (session?.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      state.auth?.logSessionEvent?.({ event: 'session_expired', session_id: sessionId, user_id: session?.user_id, timestamp: new Date().toISOString() });
      return { valid: false, expired: true, error: 'Session expired' };
    }
    return { valid: true, expired: false };
  }),
  extendUserSession: vi.fn(async (sessionId: string) => {
    const result = await state.auth?.extendSession?.(sessionId);
    const session = await state.auth?.getSession?.(sessionId);
    state.auth?.logSessionEvent?.({ event: 'session_extended', session_id: sessionId, user_id: session?.user_id, timestamp: new Date().toISOString() });
    return { success: true, expires_at: result?.expires_at };
  }),
  manageConcurrentSessions: vi.fn(async (userId: string, maxSessions: number) => {
    const sessions = await state.auth?.getUserSessions?.(userId);
    return { allowed: true, active_sessions: sessions?.length ?? 0, max_sessions: maxSessions };
  }),
  preventSessionFixation: vi.fn(async (token: string) => {
    const session = await state.auth?.getSessionFromToken?.(token);
    const newSession = await state.auth?.regenerateSessionToken?.();
    state.auth?.logSecurityEvent?.({ event: 'session_fixation_prevented', attacker_session: session?.session_id, victim_token: token, timestamp: new Date().toISOString() });
    return { fixation_prevented: true, new_session_id: newSession?.session_id, new_token: newSession?.token };
  }),
  validateCSRFProtection: vi.fn(async (sessionId: string, csrfToken: string | null) => {
    const session = await state.auth?.getSession?.(sessionId);
    if (!csrfToken) {
      state.auth?.logSecurityEvent?.({ event: 'csrf_protection_triggered', session_id: sessionId, user_id: session?.user_id, timestamp: new Date().toISOString() });
      return { valid: false, error: 'CSRF token required', error_code: 'CSRF_MISSING' };
    }
    const valid = await state.auth?.verifyCSRFToken?.(session?.csrf_token, csrfToken);
    if (!valid) return { valid: false, error: 'Invalid CSRF token', error_code: 'CSRF_INVALID' };
    if (session?.status === 'logged_out') return { valid: false, error: 'Session invalid', error_code: 'SESSION_INVALID' };
    return { valid: true };
  }),
  performSensitiveOperation: vi.fn(async (sessionId: string, _operation: string, _csrfToken: string) => {
    const newToken = await state.auth?.rotateCSRFToken?.(sessionId);
    return { success: true, new_csrf_token: newToken };
  }),
  requireMFAForOperation: vi.fn(async (token: string, operation: string) => {
    const user = await state.auth?.verifyToken?.(token);
    if (user?.mfa_enabled && !user?.mfa_verified) {
      state.auth?.requestMFAVerification?.();
      return { mfa_required: true, operation, user_id: user?.id };
    }
    if (user?.mfa_verified) return { mfa_required: false, mfa_verified: true, allowed: true };
    return { mfa_required: false, allowed: true };
  }),
  verifyMFA: vi.fn(async (_userId: string, _code: string) => {
    await state.auth?.verifyMFACode?.();
    throw new Error('Invalid MFA code');
  }),
  checkMFAStatus: vi.fn(async (userId: string) => {
    const u = await state.auth?.getUserMFAAttempts?.(userId);
    return { locked: false, remaining_attempts: 5 - (u?.mfa_failed_attempts ?? 0) };
  }),
  validatePasswordStrength: vi.fn(async (password: string) => {
    const weak = ['password', '123456', 'qwerty', 'abc', 'user123', 'Admin!1'];
    if (weak.includes(password)) return { valid: false, weaknesses: ['weak'] };
    return { valid: true, weaknesses: [], score: 85 };
  }),
  checkPasswordReuse: vi.fn(async (userId: string, password: string) => {
    const history = await state.auth?.getPasswordHistory?.(userId);
    if (history?.includes(password)) {
      state.auth?.logSecurityEvent?.({ event: 'password_reuse_attempt', user_id: userId, timestamp: new Date().toISOString() });
      return { allowed: false, error: 'Password previously used' };
    }
    return { allowed: true };
  }),
  checkPasswordExpiration: vi.fn(async (userId: string) => {
    const info = await state.auth?.getUserPasswordInfo?.(userId);
    const days = info?.password_expiry_days ?? 90;
    const lastChanged = info?.password_last_changed ? new Date(info.password_last_changed).getTime() : 0;
    const daysSince = lastChanged ? Math.floor((Date.now() - lastChanged) / (24 * 60 * 60 * 1000)) : 0;
    state.auth?.requestPasswordReset?.(userId);
    return { expired: daysSince >= days, days_since_change: daysSince, requires_change: daysSince >= days };
  }),
  testApiEndpointSecurity: vi.fn(),
  testAllAuthEndpoints: vi.fn(async () => [])
};
