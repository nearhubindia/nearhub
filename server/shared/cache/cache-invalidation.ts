import { EventEmitter } from 'events';
import { dbCache } from './db-cache';

export type CacheEvent =
  | 'user:create'
  | 'user:update'
  | 'user:delete'
  | 'listing:create'
  | 'listing:update'
  | 'listing:delete'
  | 'chat:create'
  | 'chat:update'
  | 'message:create'
  | 'message:delete'
  | 'report:create'
  | 'spam:update'
  | 'cache:clear';

export interface CacheInvalidationRule {
  event: CacheEvent;
  invalidateCaches: string[];
  cascadeToRelated?: boolean;
}

/**
 * Cache Invalidation Manager
 * Coordinates cache invalidation across the application
 * Handles cascade invalidations and dependency tracking
 */
export class CacheInvalidationManager extends EventEmitter {
  private rules: Map<CacheEvent, CacheInvalidationRule> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    this.initializeRules();
  }

  /**
   * Initialize standard cache invalidation rules
   */
  private initializeRules(): void {
    // User-related events
    this.registerRule({
      event: 'user:create',
      invalidateCaches: ['users:list', 'user:search:*'],
    });

    this.registerRule({
      event: 'user:update',
      invalidateCaches: ['user:*'],
      cascadeToRelated: true,
    });

    this.registerRule({
      event: 'user:delete',
      invalidateCaches: ['user:*', 'user-listings:*', 'users:list'],
      cascadeToRelated: true,
    });

    // Listing-related events
    this.registerRule({
      event: 'listing:create',
      invalidateCaches: ['listings:*', 'user-listings:*'],
    });

    this.registerRule({
      event: 'listing:update',
      invalidateCaches: ['listing:*', 'listings:*', 'user-listings:*'],
      cascadeToRelated: true,
    });

    this.registerRule({
      event: 'listing:delete',
      invalidateCaches: ['listings:*', 'user-listings:*', 'listing:*'],
      cascadeToRelated: true,
    });

    // Chat-related events
    this.registerRule({
      event: 'chat:create',
      invalidateCaches: ['user-chats:*'],
    });

    this.registerRule({
      event: 'chat:update',
      invalidateCaches: ['chat:*'],
    });

    this.registerRule({
      event: 'message:create',
      invalidateCaches: ['chat:*', 'user-messages:*'],
    });

    this.registerRule({
      event: 'message:delete',
      invalidateCaches: ['chat:*'],
    });

    // Spam/Report-related events
    this.registerRule({
      event: 'report:create',
      invalidateCaches: ['user-reports:*', 'reports:pending'],
    });

    this.registerRule({
      event: 'spam:update',
      invalidateCaches: ['user:*', 'user-spam-profile:*'],
    });

    console.log('[CacheInvalidation] Initialized with standard rules');
  }

  /**
   * Register a custom cache invalidation rule
   */
  registerRule(rule: CacheInvalidationRule): void {
    this.rules.set(rule.event, rule);
  }

  /**
   * Track dependency relationships for cascade invalidation
   */
  registerDependency(from: string, to: string): void {
    if (!this.dependencies.has(from)) {
      this.dependencies.set(from, new Set());
    }
    this.dependencies.get(from)!.add(to);
  }

  /**
   * Trigger cache invalidation for an event
   */
  async invalidate(event: CacheEvent, metadata?: Record<string, any>): Promise<void> {
    const rule = this.rules.get(event);

    if (!rule) {
      console.warn(`[CacheInvalidation] No rule found for event: ${event}`);
      return;
    }

    console.log(`[CacheInvalidation] Triggered event: ${event}`, metadata);

    // Get caches to invalidate
    const cachesToInvalidate = this.expandCaches(rule.invalidateCaches, metadata);

    // Invalidate primary caches
    for (const cachePattern of cachesToInvalidate) {
      if (cachePattern.includes('*')) {
        // TODO: Implement pattern invalidation if dbCache supports it
        // await dbCache?.invalidatePattern(cachePattern);
      } else {
        // TODO: Implement batch invalidation if dbCache supports it
        // await dbCache?.invalidateManyPattern([cachePattern]);
      }
    }

    // Handle cascade invalidations
    if (rule.cascadeToRelated && metadata?.id) {
      const cascadeCaches = this.dependencies.get(metadata.id) || new Set();
      for (const cacheKey of cascadeCaches) {
        // TODO: Implement cascade invalidation if dbCache supports it
        // await dbCache?.invalidatePattern(`query:${cacheKey}*`);
      }
    }

    // Emit event for listeners
    this.emit(event, metadata);
  }

  /**
   * Batch invalidation for multiple events
   */
  async invalidateBatch(
    events: Array<{ event: CacheEvent; metadata?: Record<string, any> }>
  ): Promise<void> {
    for (const { event, metadata } of events) {
      await this.invalidate(event, metadata);
    }
  }

  /**
   * Expand cache patterns with metadata substitution
   */
  private expandCaches(patterns: string[], metadata?: Record<string, any>): string[] {
    return patterns.map((pattern) => {
      if (!metadata) return pattern;

      // Replace common placeholders
      let expanded = pattern;
      Object.entries(metadata).forEach(([key, value]) => {
        expanded = expanded.replace(`{${key}}`, String(value));
      });

      return expanded;
    });
  }

  /**
   * Register event listener for cache invalidation
   */
  onInvalidate(event: CacheEvent, callback: (metadata?: Record<string, any>) => void): void {
    this.on(event, callback);
  }

  /**
   * Clear all rules (useful for testing)
   */
  clearRules(): void {
    this.rules.clear();
    this.dependencies.clear();
  }

  /**
   * Get invalidation statistics
   */
  getRules(): Map<CacheEvent, CacheInvalidationRule> {
    return this.rules;
  }
}

/**
 * Singleton instance
 */
export const cacheInvalidation = new CacheInvalidationManager();

// ============================================
// Convenience Functions for Invalidation
// ============================================

/**
 * On user creation
 */
export async function invalidateOnUserCreate(userId: string): Promise<void> {
  await cacheInvalidation.invalidate('user:create', { id: userId });
}

/**
 * On user update
 */
export async function invalidateOnUserUpdate(userId: string): Promise<void> {
  await dbCache.invalidateUser(userId);
  await cacheInvalidation.invalidate('user:update', { id: userId });
}

/**
 * On user deletion
 */
export async function invalidateOnUserDelete(userId: string): Promise<void> {
  await dbCache.invalidateUser(userId);
  await dbCache.invalidateUserListings(userId);
  await cacheInvalidation.invalidate('user:delete', { id: userId });
}

/**
 * On listing create
 */
export async function invalidateOnListingCreate(listingId: string, userId: string): Promise<void> {
  await dbCache.invalidateAllListings();
  await dbCache.invalidateUserListings(userId);
  await cacheInvalidation.invalidate('listing:create', {
    id: listingId,
    userId,
  });
}

/**
 * On listing update
 */
export async function invalidateOnListingUpdate(listingId: string, userId: string): Promise<void> {
  await dbCache.invalidateListing(listingId);
  await dbCache.invalidateUserListings(userId);
  await cacheInvalidation.invalidate('listing:update', {
    id: listingId,
    userId,
  });
}

/**
 * On listing delete
 */
export async function invalidateOnListingDelete(listingId: string, userId: string): Promise<void> {
  await dbCache.invalidateListing(listingId);
  await dbCache.invalidateUserListings(userId);
  await dbCache.invalidateAllListings();
  await cacheInvalidation.invalidate('listing:delete', {
    id: listingId,
    userId,
  });
}

/**
 * On message create
 */
export async function invalidateOnMessageCreate(chatId: string): Promise<void> {
  await dbCache.invalidateChat(chatId);
  await cacheInvalidation.invalidate('message:create', { chatId });
}

/**
 * On spam report
 */
export async function invalidateOnSpamReport(userId: string): Promise<void> {
  await dbCache.invalidateUser(userId);
  await cacheInvalidation.invalidate('report:create', { id: userId });
}

/**
 * On user spam profile update (from spam detector)
 */
export async function invalidateOnSpamUpdate(userId: string): Promise<void> {
  await dbCache.invalidateUser(userId);
  await cacheInvalidation.invalidate('spam:update', { id: userId });
}
