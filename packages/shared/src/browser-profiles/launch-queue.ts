/**
 * Launch Queue
 *
 * Priority queue for managing browser profile launches.
 * Supports:
 * - Priority-based ordering
 * - Concurrency control
 * - Status tracking
 * - Queue management (clear, pause, resume)
 */

import type { LaunchWithMcpResult, BrowserConfig } from './types.ts';

/**
 * Queue item status
 */
export type QueueItemStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Queue item representing a profile to launch
 */
export interface QueueItem {
  /** Unique ID for this queue item */
  id: string;

  /** Profile ID to launch */
  profileId: string;

  /** Priority (higher = launched sooner) */
  priority: number;

  /** Current status */
  status: QueueItemStatus;

  /** When the item was added to queue */
  queuedAt: number;

  /** When processing started */
  startedAt?: number;

  /** When processing completed */
  completedAt?: number;

  /** Launch result (if completed/failed) */
  result?: LaunchWithMcpResult;

  /** Error message (if failed) */
  error?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for adding item to queue
 */
export interface AddToQueueOptions {
  /** Priority (default: 0) */
  priority?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Total items in queue */
  total: number;

  /** Items pending */
  pending: number;

  /** Items in progress */
  inProgress: number;

  /** Items completed */
  completed: number;

  /** Items failed */
  failed: number;

  /** Items cancelled */
  cancelled: number;

  /** Whether queue is paused */
  isPaused: boolean;
}

/**
 * Launch function type
 */
export type LaunchFunction = (
  profileId: string,
  options?: { browserConfig?: BrowserConfig }
) => Promise<LaunchWithMcpResult>;

/**
 * Queue event types
 */
export type QueueEvent =
  | { type: 'item_queued'; item: QueueItem }
  | { type: 'item_started'; item: QueueItem }
  | { type: 'item_completed'; item: QueueItem }
  | { type: 'item_failed'; item: QueueItem; error: string }
  | { type: 'item_cancelled'; item: QueueItem }
  | { type: 'queue_paused' }
  | { type: 'queue_resumed' }
  | { type: 'queue_cleared' };

/**
 * Queue event listener
 */
export type QueueEventListener = (event: QueueEvent) => void;

/**
 * Launch Queue for managing profile launches
 */
export class LaunchQueue {
  private items: Map<string, QueueItem> = new Map();
  private eventListeners: Set<QueueEventListener> = new Set();
  private isPaused: boolean = false;
  private isProcessing: boolean = false;
  private launchFunction: LaunchFunction;
  private concurrency: number;
  private activeCount: number = 0;
  private itemIdCounter: number = 0;

  constructor(
    launchFunction: LaunchFunction,
    options?: {
      concurrency?: number;
    }
  ) {
    this.launchFunction = launchFunction;
    this.concurrency = options?.concurrency ?? 3;
  }

  /**
   * Generate unique item ID
   */
  private generateItemId(): string {
    return `queue-item-${++this.itemIdCounter}-${Date.now()}`;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: QueueEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: QueueEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emit(event: QueueEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[LaunchQueue] Event listener error:', err);
      }
    }
  }

  /**
   * Add profile to launch queue
   */
  add(profileId: string, options?: AddToQueueOptions): QueueItem {
    const item: QueueItem = {
      id: this.generateItemId(),
      profileId,
      priority: options?.priority ?? 0,
      status: 'pending',
      queuedAt: Date.now(),
      metadata: options?.metadata,
    };

    this.items.set(item.id, item);
    this.emit({ type: 'item_queued', item });

    // Start processing if not already
    this.processQueue();

    return item;
  }

  /**
   * Add multiple profiles to queue
   */
  addBatch(profileIds: string[], options?: AddToQueueOptions): QueueItem[] {
    return profileIds.map((profileId) => this.add(profileId, options));
  }

  /**
   * Get item by ID
   */
  getItem(itemId: string): QueueItem | undefined {
    return this.items.get(itemId);
  }

  /**
   * Get item by profile ID
   */
  getItemByProfileId(profileId: string): QueueItem | undefined {
    for (const item of this.items.values()) {
      if (item.profileId === profileId) {
        return item;
      }
    }
    return undefined;
  }

  /**
   * Get all items
   */
  getAllItems(): QueueItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get pending items sorted by priority
   */
  getPendingItems(): QueueItem[] {
    return Array.from(this.items.values())
      .filter((item) => item.status === 'pending')
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Cancel a queued item
   */
  cancel(itemId: string): boolean {
    const item = this.items.get(itemId);

    if (!item) {
      return false;
    }

    if (item.status !== 'pending') {
      // Can only cancel pending items
      return false;
    }

    item.status = 'cancelled';
    item.completedAt = Date.now();

    this.emit({ type: 'item_cancelled', item });

    return true;
  }

  /**
   * Cancel all pending items
   */
  cancelAll(): number {
    let cancelled = 0;

    for (const item of this.items.values()) {
      if (item.status === 'pending') {
        item.status = 'cancelled';
        item.completedAt = Date.now();
        cancelled++;
        this.emit({ type: 'item_cancelled', item });
      }
    }

    return cancelled;
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
    this.emit({ type: 'queue_paused' });
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false;
    this.emit({ type: 'queue_resumed' });
    this.processQueue();
  }

  /**
   * Clear the queue (removes completed/failed/cancelled items)
   */
  clear(options?: { all?: boolean }): number {
    let removed = 0;

    for (const [id, item] of this.items) {
      const shouldRemove =
        options?.all ||
        item.status === 'completed' ||
        item.status === 'failed' ||
        item.status === 'cancelled';

      if (shouldRemove && item.status !== 'in_progress') {
        this.items.delete(id);
        removed++;
      }
    }

    this.emit({ type: 'queue_cleared' });

    return removed;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let failed = 0;
    let cancelled = 0;

    for (const item of this.items.values()) {
      switch (item.status) {
        case 'pending':
          pending++;
          break;
        case 'in_progress':
          inProgress++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
        case 'cancelled':
          cancelled++;
          break;
      }
    }

    return {
      total: this.items.size,
      pending,
      inProgress,
      completed,
      failed,
      cancelled,
      isPaused: this.isPaused,
    };
  }

  /**
   * Set concurrency level
   */
  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency);
    this.processQueue();
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused) {
      return;
    }

    this.isProcessing = true;

    try {
      while (true) {
        if (this.isPaused) {
          break;
        }

        // Check if we can process more
        if (this.activeCount >= this.concurrency) {
          break;
        }

        // Get next pending item
        const pendingItems = this.getPendingItems();
        if (pendingItems.length === 0) {
          break;
        }

        const item = pendingItems[0];
        if (item) {
          this.processItem(item);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single item
   */
  private async processItem(item: QueueItem): Promise<void> {
    // Update status
    item.status = 'in_progress';
    item.startedAt = Date.now();
    this.activeCount++;

    this.emit({ type: 'item_started', item });

    try {
      // Launch the profile
      const result = await this.launchFunction(item.profileId);

      // Update item with result
      item.status = result.success ? 'completed' : 'failed';
      item.completedAt = Date.now();
      item.result = result;

      if (!result.success) {
        item.error = result.error;
        this.emit({ type: 'item_failed', item, error: result.error || 'Unknown error' });
      } else {
        this.emit({ type: 'item_completed', item });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      item.status = 'failed';
      item.completedAt = Date.now();
      item.error = error;

      this.emit({ type: 'item_failed', item, error });
    } finally {
      this.activeCount--;

      // Continue processing queue
      this.processQueue();
    }
  }

  /**
   * Wait for all items to complete
   */
  async waitForAll(timeoutMs?: number): Promise<void> {
    const startTime = Date.now();

    while (true) {
      const stats = this.getStats();

      // Check if all done
      if (stats.pending === 0 && stats.inProgress === 0) {
        return;
      }

      // Check timeout
      if (timeoutMs && Date.now() - startTime > timeoutMs) {
        throw new Error('Queue wait timeout');
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Wait for specific item to complete
   */
  async waitForItem(itemId: string, timeoutMs?: number): Promise<QueueItem | undefined> {
    const startTime = Date.now();

    while (true) {
      const item = this.items.get(itemId);

      if (!item) {
        return undefined;
      }

      if (
        item.status === 'completed' ||
        item.status === 'failed' ||
        item.status === 'cancelled'
      ) {
        return item;
      }

      // Check timeout
      if (timeoutMs && Date.now() - startTime > timeoutMs) {
        return item;
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

/**
 * Create a launch queue with default settings
 */
export function createLaunchQueue(
  launchFunction: LaunchFunction,
  concurrency: number = 3
): LaunchQueue {
  return new LaunchQueue(launchFunction, { concurrency });
}
