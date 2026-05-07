export interface ShortsPrefetchQueueOptions {
  concurrency: number;
  rangeHeader: string;
}

interface QueueEntry {
  url: string;
  priority: number;
}

export class ShortsPrefetchQueue {
  private readonly concurrency: number;
  private readonly rangeHeader: string;
  private readonly pending: QueueEntry[] = [];
  private readonly inFlight = new Set<string>();
  private readonly seen = new Set<string>();
  private readonly abortControllers = new Map<string, AbortController>();
  private running = false;

  constructor(options: ShortsPrefetchQueueOptions) {
    this.concurrency = Math.max(1, options.concurrency);
    this.rangeHeader = options.rangeHeader;
  }

  enqueue(urls: string[]): void {
    urls.forEach((url, index) => {
      if (!url || this.seen.has(url) || this.inFlight.has(url)) return;
      this.seen.add(url);
      this.pending.push({ url, priority: index });
    });
    this.pending.sort((a, b) => a.priority - b.priority);
    this.pump();
  }

  clear(): void {
    this.pending.length = 0;
    this.seen.clear();
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.inFlight.clear();
  }

  private pump(): void {
    if (this.running) return;
    this.running = true;

    const runNext = () => {
      while (this.inFlight.size < this.concurrency && this.pending.length > 0) {
        const next = this.pending.shift();
        if (!next) break;
        this.prefetch(next.url).finally(runNext);
      }

      if (this.inFlight.size === 0 && this.pending.length === 0) {
        this.running = false;
      }
    };

    runNext();
  }

  private async prefetch(url: string): Promise<void> {
    this.inFlight.add(url);
    const controller = new AbortController();
    this.abortControllers.set(url, controller);
    try {
      await fetch(url, {
        method: 'GET',
        headers: { Range: this.rangeHeader },
        signal: controller.signal,
      });
    } catch {
      // Best effort only.
    } finally {
      this.abortControllers.delete(url);
      this.inFlight.delete(url);
    }
  }
}
