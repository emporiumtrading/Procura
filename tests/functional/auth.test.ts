import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authPipeline } from '../mocks/auth.mock';

describe('Authentication and Authorization Pipeline', () => {
  let mockSupabase: any;
  let mockTokenStorage: any;

  beforeEach(() => {
    mockSupabase = authPipeline.mockSupabase();
    mockTokenStorage = authPipeline.mockTokenStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -------------------------------------------------------
  // Role-Based Route Protection
  // -------------------------------------------------------

  describe('Role-Based Route Protection', () => {
    it('allows admin access to admin routes', async () => {
      const user = {
        id: 'user-001',
        email: 'admin@procura.com',
        role: 'admin',
        session_expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      const result = await authPipeline.canAccessRoute('/admin/dashboard', 'valid-jwt-token');
      
      expect(result).toEqual({
        allowed: true,
        reason: 'Admin role has access'
      });
      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('valid-jwt-token');
    });

    it('denies user access to admin routes', async () => {
      const user = {
        id: 'user-002',
        email: 'contractor@procura.com',
        role: 'user',
        session_expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      const result = await authPipeline.canAccessRoute('/admin/dashboard', 'valid-jwt-token');
      
      expect(result).toEqual({
        allowed: false,
        reason: 'User role not authorized for admin routes'
      });
    });

    it('allows viewer read-only access', async () => {
      const user = {
        id: 'user-003',
        email: 'viewer@procura.com',
        role: 'viewer',
        session_expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      const result = await authPipeline.canAccessRoute('/opportunities', 'valid-jwt-token');
      
      expect(result).toEqual({
        allowed: true,
        reason: 'Viewer role has read access'
      });
    });

    it('denies viewer write access', async () => {
      const user = {
        id: 'user-003',
        email: 'viewer@procura.com',
        role: 'viewer',
        session_expires_at: new Date(Date.now() + 3600000).ISOString()
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      const result = await authPipeline.canAccessRoute('/opportunities/create', 'valid-jwt-token');
      
      expect(result).toEqual({
        allowed: false,
        reason: 'Viewer role not authorized for write operations'
      });
    });

    it('handles expired sessions correctly', async () => {
      const user = {
        id: 'user-004',
        email: 'admin@procura.com',
        role: 'admin',
        session_expires_at: new Date(Date.now() - 3600000).toISOString() // Expired
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      const result = await authPipeline.canAccessRoute('/admin/dashboard', 'valid-jwt-token');
      
      expect(result).toEqual({
        allowed: false,
        reason: 'Session expired'
      });
      
      // Should trigger session refresh
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // Token Tampering Rejection
  // -------------------------------------------------------

  describe('Token Tampering Rejection', () => {
    it('rejects invalid JWT tokens', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Invalid token'));
      mockTokenStorage.getToken.mockResolvedValue('invalid-jwt-token');

      const result = await authPipeline.canAccessRoute('/dashboard', 'invalid-jwt-token');
      
      expect(result).toEqual({
        allowed: false,
        reason: 'Invalid authentication token'
      });
      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('invalid-jwt-token');
    });

    it('rejects tampered tokens', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Token signature invalid'));
      mockTokenStorage.getToken.mockResolvedValue('tampered-jwt-token');

      const result = await authPipeline.canAccessRoute('/dashboard', 'tampered-jwt-token');
      
      expect(result).toEqual({
        allowed: false,
        reason: 'Tampered authentication token'
      });
    });

    it('handles missing tokens', async () => {
      mockTokenStorage.getToken.mockResolvedValue(null);

      const result = await authPipeline.canAccessRoute('/dashboard', null);
      
      expect(result).toEqual({
        allowed: false,
        reason: 'No authentication token provided'
      });
    });

    it('rejects tokens with invalid claims', async () => {
      const user = {
        id: 'user-005',
        email: 'admin@procura.com',
        role: 'admin',
        session_expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      // Mock token with invalid claims
      mockSupabase.auth.getUser.mockResolvedValue({
        ...user,
        claims: { invalid_claim: true }
      });

      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      const result = await authPipeline.canAccessRoute('/dashboard', 'valid-jwt-token');
      
      expect(result).toEqual({
        allowed: false,
        reason: 'Invalid token claims'
      });
    });
  });

  // -------------------------------------------------------
  // Session Timeout Handling
  // -------------------------------------------------------

  describe('Session Timeout Handling', () => {
    it('detects session timeout', async () => {
      const user = {
        id: 'user-006',
        email: 'user@procura.com',
        role: 'user',
        session_expires_at: new Date(Date.now() - 1000).toISOString() // Just expired
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      const result = await authPipeline.checkSessionTimeout('valid-jwt-token');
      
      expect(result).toBe(true); // Session has timed out
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('extends session before timeout', async () => {
      const user = {
        id: 'user-007',
        email: 'user@procura.com',
        role: 'user',
        session_expires_at: new Date(Date.now() + 300000).toISOString() // Expires in 5 minutes
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      const result = await authPipeline.checkSessionTimeout('valid-jwt-token');
      
      expect(result).toBe(false); // Session still valid
      expect(mockSupabase.auth.extendSession).toHaveBeenCalled();
    });

    it('handles session extension failure', async () => {
      const user = {
        id: 'user-008',
        email: 'user@procura.com',
        role: 'user',
        session_expires_at: new Date(Date.now() + 300000).toISOString()
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      // Mock session extension failure
      mockSupabase.auth.extendSession.mockRejectedValue(new Error('Network error'));

      const result = await authPipeline.checkSessionTimeout('valid-jwt-token');
      
      expect(result).toBe(false); // Still valid, but extension failed
      expect(mockSupabase.auth.extendSession).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // MFA Bypass Attempts
  // -------------------------------------------------------

  describe('MFA Bypass Attempts', () => {
    it('requires MFA for sensitive operations', async () => {
      const user = {
        id: 'user-009',
        email: 'user@procura.com',
        role: 'user',
        session_expires_at: new Date(Date.now() + 3600000).toISOString(),
        mfa_enabled: true,
        mfa_passed: false
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      const result = await authPipeline.canPerformSensitiveOperation('valid-jwt-token');
      
      expect(result).toEqual({
        allowed: false,
        reason: 'MFA required for sensitive operations'
      });
      expect(mockSupabase.auth.verifyMFASecret).toHaveBeenCalled();
    });

    it('allows MFA-verified users', async () => {
      const user = {
        id: 'user-010',
        email: 'user@procura.com',
        role: 'user',
        session_expires_at: new Date(Date.now() + 3600000).toISOString(),
        mfa_enabled: true,
        mfa_passed: true
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      const result = await authPipeline.canPerformSensitiveOperation('valid-jwt-token');
      
      expect(result).toEqual({
        allowed: true,
        reason: 'MFA verified'
      });
    });

    it('handles MFA verification failure', async () => {
      const user = {
        id: 'user-011',
        email: 'user@procura.com',
        role: 'user',
        session_expires_at: new Date(Date.now() + 3600000).toISOString(),
        mfa_enabled: true,
        mfa_passed: false
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      // Mock MFA verification failure
      mockSupabase.auth.verifyMFASecret.mockRejectedValue(new Error('Invalid MFA code'));

      const result = await authPipeline.canPerformSensitiveOperation('valid-jwt-token');
      
      expect(result).toEqual({
        allowed: false,
        reason: 'MFA verification failed'
      });
    });
  });

  // -------------------------------------------------------
  // Cross-Site Request Forgery Protection
  // -------------------------------------------------------

  describe('CSRF Protection', () => {
    it('validates CSRF tokens for state-changing operations', async () => {
      const user = {
        id: 'user-012',
        email: 'user@procura.com',
        role: 'user',
        session_expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      // Mock valid CSRF token
      mockTokenStorage.getCSRFToken.mockResolvedValue('valid-csrf-token');

      const result = await authPipeline.validateCSRFToken(
        'valid-jwt-token', 
        'valid-csrf-token'
      );
      
      expect(result).toBe(true);
      expect(mockTokenStorage.getCSRFToken).toHaveBeenCalled();
    });

    it('rejects requests with missing CSRF tokens', async () => {
      const user = {
        id: 'user-013',
        email: 'user@procura.com',
        role: 'user',
        session_expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      // No CSRF token
      mockTokenStorage.getCSRFToken.mockResolvedValue(null);

      const result = await authPipeline.validateCSRFToken(
        'valid-jwt-token', 
        null
      );
      
      expect(result).toBe(false);
    });

    it('rejects requests with invalid CSRF tokens', async () => {
      const user = {
        id: 'user-014',
        email: 'user@procura.com',
        role: 'user',
        session_expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      mockSupabase.auth.getUser.mockResolvedValue(user);
      mockTokenStorage.getToken.mockResolvedValue('valid-jwt-token');

      // Mock invalid CSRF token
      mockTokenStorage.getCSRFToken.mockResolvedValue('invalid-csrf-token');

      const result = await authPipeline.validateCSRFToken(
        'valid-jwt-token', 
        'invalid-csrf-token'
      );
      
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------
  // Rate Limiting and Brute Force Protection
  // -------------------------------------------------------

  describe('Rate Limiting', () => {
    it('limits failed login attempts', async () => {
      const maxAttempts = 5;
      let failedAttempts = 0;

      for (let i = 0; i < maxAttempts + 2; i++) {
        const result = await authPipeline.attemptLogin('user@procura.com', 'wrong-password');
        
        if (result.success) {
          break;
        }
        
        failedAttempts++;
        
        if (failedAttempts >= maxAttempts) {
          expect(result).toEqual({
            success: false,
            reason: 'Too many failed login attempts'
          });
        }
      }
      
      expect(failedAttempts).toBe(maxAttempts + 2);
      expect(authPipeline.isRateLimited('user@procura.com')).toBe(true);
    });

    it('resets rate limit after timeout', async () => {
      // Simulate rate limit reached
      authPipeline.setRateLimit('user@procura.com', true);
      
      expect(authPipeline.isRateLimited('user@procura.com')).toBe(true);
      
      // Wait for rate limit reset (mocked to be immediate for testing)
      authPipeline.resetRateLimit('user@procura.com');
      
      expect(authPipeline.isRateLimited('user@procura.com')).toBe(false);
    });
  });

  // Meta-cognitive debug protocol tags used:
  // [AUTH_BOUNDARY] - Authentication and authorization logic
  // [ASYNC_TIMING] - Session timeout and extension
  // [EXTERNAL_DEPENDENCY] - Supabase auth mocking
  // [RACE_CONDITION] - Concurrent authentication attempts
});