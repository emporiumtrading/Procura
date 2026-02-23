import { vi } from 'vitest';

export const supabaseMock = {
  createClient: () => ({
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
      extendSession: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    })),
    rpc: vi.fn()
  }),

  createAdminClient: () => ({
    auth: {
      admin: {
        listUsers: vi.fn(),
        createUser: vi.fn(),
        deleteUser: vi.fn()
      }
    }
  })
};

