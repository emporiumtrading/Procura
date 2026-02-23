import { vi } from 'vitest';

const FEATURES: Record<string, string[]> = {
  basic: ['dashboard', 'basic-filters'],
  pro: ['dashboard', 'basic-filters', 'advanced-filters', 'export-csv'],
  enterprise: ['dashboard', 'basic-filters', 'advanced-filters', 'export-csv', 'api-access', 'bulk-operations'],
  trial: ['dashboard', 'basic-filters', 'trial-features']
};

type State = { database: any; stripe: any; session: any };
const state: State = { database: null, stripe: null, session: null };

export const tierEnforcement = {
  mockDatabase: () => {
    state.database = {
      getUser: vi.fn(),
      updateUserTier: vi.fn(),
      updateSubscription: vi.fn(),
      updateQuotaUsage: vi.fn(),
      getQuotaUsage: vi.fn(),
      logRenewalReminder: vi.fn(),
      getSubscriptionStatus: vi.fn()
    };
    return state.database;
  },
  mockStripe: () => {
    state.stripe = {
      upgradeSubscription: vi.fn(),
      downgradeSubscription: vi.fn(),
      createSubscription: vi.fn(),
      cancelSubscription: vi.fn()
    };
    return state.stripe;
  },
  mockSession: () => {
    state.session = {
      getUser: vi.fn(),
      updateTier: vi.fn(),
      updateQuota: vi.fn(),
      redirectToSubscription: vi.fn(),
      logRenewalReminder: vi.fn()
    };
    return state.session;
  },
  canAccessFeature: vi.fn(async (feature: string, _token: string) => {
    const user = await state.database?.getUser?.();
    if (!user) return { allowed: false, reason: 'Subscription expired' };
    const tier = user.tier || 'basic';
    const expired = user.subscription_expires_at && new Date(user.subscription_expires_at).getTime() < Date.now();
    if (expired && tier !== 'trial') return { allowed: false, reason: 'Subscription expired' };
    const list = FEATURES[tier] || FEATURES.basic;
    if (list.includes(feature)) {
      const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
      return { allowed: true, reason: `${tierLabel} tier has access to ${feature}` };
    }
    if (tier === 'trial' && (FEATURES.trial?.includes(feature))) {
      return { allowed: true, reason: 'Trial user has access to ' + feature };
    }
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    return { allowed: false, reason: `${tierLabel} tier not authorized for ${feature}` };
  }),
  upgradeTier: vi.fn(async (userId: string, newTier: string, _token: string) => {
    try {
      await state.stripe?.upgradeSubscription?.();
      state.database?.updateUserTier?.(userId, newTier);
      state.session?.updateTier?.(newTier);
      return { success: true, new_tier: newTier, message: 'Subscription upgraded to ' + newTier + ' tier' };
    } catch (e: any) {
      return { success: false, message: 'Failed to upgrade subscription: ' + e?.message };
    }
  }),
  downgradeTier: vi.fn(async (userId: string, newTier: string, _token: string) => {
    const user = await state.database?.getUser?.();
    const usage = user?.quota?.current_usage ?? (await state.database?.getQuotaUsage?.(userId));
    const basicMax = 100;
    if (newTier === 'basic' && usage > basicMax) {
      return { success: false, message: 'Cannot downgrade: current usage exceeds basic tier quota' };
    }
    const result = await state.stripe?.downgradeSubscription?.();
    state.database?.updateUserTier?.(userId, newTier);
    state.session?.updateTier?.(newTier);
    return { success: true, new_tier: newTier, message: 'Subscription downgraded to ' + newTier + ' tier', refund: result?.refund_amount };
  }),
  checkQuota: vi.fn(async (userId: string, additional: number, _token: string) => {
    const user = await state.database?.getUser?.();
    const usage = (await state.database?.getQuotaUsage?.(userId)) ?? user?.quota?.current_usage ?? 0;
    const max = user?.quota?.max_opportunities ?? 100;
    if (usage + additional > max) {
      return { allowed: false, reason: `Quota exceeded: ${usage}/${max} used, cannot add ${additional} more` };
    }
    return { allowed: true, reason: `Quota available: ${usage}/${max} used, can add ${additional} more` };
  }),
  updateQuota: vi.fn(async (userId: string, additional: number, _token: string) => {
    const user = await state.database?.getUser?.();
    const usage = (await state.database?.getQuotaUsage?.(userId)) ?? user?.quota?.current_usage ?? 0;
    const max = user?.quota?.max_opportunities ?? 100;
    if (usage + additional > max) {
      return { success: false, message: `Quota overflow prevented: ${usage}/${max} used, cannot add ${additional} more` };
    }
    const newUsage = usage + additional;
    state.database?.updateQuotaUsage?.(userId, newUsage);
    return { success: true, new_usage: newUsage, message: `Quota updated: ${newUsage}/${max} used` };
  }),
  checkTrialStatus: vi.fn(async (userId: string, _token: string) => {
    const user = await state.database?.getUser?.();
    if (!user || user.tier !== 'trial') {
      return { in_trial: false, days_remaining: 0, message: 'Trial period expired' };
    }
    const exp = user.subscription_expires_at ? new Date(user.subscription_expires_at).getTime() : 0;
    if (exp < Date.now()) {
      state.session?.redirectToSubscription?.();
      return { in_trial: false, days_remaining: 0, message: 'Trial period expired' };
    }
    const days = Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000));
    return { in_trial: true, days_remaining: days, features_available: ['dashboard', 'basic-filters', 'trial-features'] };
  }),
  convertTrialToPaid: vi.fn(async (userId: string, newTier: string, _token: string) => {
    const result = await state.stripe?.createSubscription?.();
    state.database?.updateUserTier?.(userId, newTier);
    state.database?.updateSubscription?.(userId, result?.subscription_id);
    return { success: true, new_tier: newTier, message: 'Trial converted to ' + newTier + ' tier subscription' };
  }),
  checkSubscriptionStatus: vi.fn(async (userId: string, _token: string) => {
    const user = await state.database?.getUser?.();
    const exp = user?.subscription_expires_at ? new Date(user.subscription_expires_at).getTime() : 0;
    if (exp < Date.now()) {
      state.database?.updateUserTier?.(userId, 'basic');
      return { active: false, expired: true, message: 'Subscription expired' };
    }
    const days = Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000));
    if (days <= 7) state.database?.logRenewalReminder?.(userId, days);
    return { active: true, expires_in: days, message: days <= 7 ? 'Subscription active, renewal reminder sent' : 'Subscription active' };
  })
};
