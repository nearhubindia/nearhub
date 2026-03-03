/**
 * Task Scheduler Service
 * Manages background jobs and scheduled tasks
 * Production-ready with error handling, logging, and monitoring
 */

type TaskFunction = () => Promise<void>;

interface ScheduledTask {
  name: string;
  fn: TaskFunction;
  intervalMs: number;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  running: boolean;
  timerId?: NodeJS.Timeout;
  errorCount: number;
  maxRetries: number;
}

class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private isShuttingDown = false;

  /**
   * Register a task to run on a schedule
   */
  register(
    name: string,
    fn: TaskFunction,
    intervalMs: number,
    options: { enabled?: boolean; maxRetries?: number } = {}
  ): void {
    const { enabled = true, maxRetries = 3 } = options;

    if (this.tasks.has(name)) {
      console.warn(`[TaskScheduler] Task "${name}" already registered, skipping`);
      return;
    }

    const task: ScheduledTask = {
      name,
      fn,
      intervalMs,
      enabled,
      running: false,
      errorCount: 0,
      maxRetries,
    };

    this.tasks.set(name, task);
    console.log(`[TaskScheduler] Registered task: ${name} (${intervalMs}ms interval)`);

    if (enabled) {
      this.scheduleTask(task);
    }
  }

  /**
   * Schedule task execution
   */
  private scheduleTask(task: ScheduledTask): void {
    if (task.timerId) {
      clearTimeout(task.timerId);
    }

    task.nextRun = new Date(Date.now() + task.intervalMs);

    task.timerId = setTimeout(async () => {
      await this.executeTask(task);
    }, task.intervalMs);
  }

  /**
   * Execute a task with error handling and retry logic
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    if (this.isShuttingDown || !task.enabled || task.running) {
      return;
    }

    task.running = true;
    task.lastRun = new Date();

    console.log(`[TaskScheduler] Running task: ${task.name}`);

    try {
      await task.fn();
      task.errorCount = 0; // Reset error count on success
      console.log(`[TaskScheduler] Task completed: ${task.name}`);
    } catch (error) {
      task.errorCount++;
      console.error(
        `[TaskScheduler] Task failed (${task.errorCount}/${task.maxRetries}): ${task.name}`,
        error
      );

      // Disable task if max retries exceeded
      if (task.errorCount >= task.maxRetries) {
        console.error(
          `[TaskScheduler] Task disabled after ${task.maxRetries} failures: ${task.name}`
        );
        task.enabled = false;
      }
    } finally {
      task.running = false;

      // Schedule next run if still enabled
      if (task.enabled && !this.isShuttingDown) {
        this.scheduleTask(task);
      }
    }
  }

  /**
   * Run a task immediately (manual trigger)
   */
  async runNow(name: string): Promise<void> {
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`Task not found: ${name}`);
    }

    if (task.running) {
      console.warn(`[TaskScheduler] Task already running: ${name}`);
      return;
    }

    await this.executeTask(task);
  }

  /**
   * Enable a task
   */
  enable(name: string): void {
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`Task not found: ${name}`);
    }

    if (!task.enabled) {
      task.enabled = true;
      task.errorCount = 0; // Reset error count when re-enabling
      this.scheduleTask(task);
      console.log(`[TaskScheduler] Task enabled: ${name}`);
    }
  }

  /**
   * Disable a task
   */
  disable(name: string): void {
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`Task not found: ${name}`);
    }

    if (task.enabled) {
      task.enabled = false;
      if (task.timerId) {
        clearTimeout(task.timerId);
      }
      console.log(`[TaskScheduler] Task disabled: ${name}`);
    }
  }

  /**
   * Get task status
   */
  getStatus(name?: string): Record<string, unknown> | Record<string, unknown>[] {
    if (name) {
      const task = this.tasks.get(name);
      if (!task) {
        throw new Error(`Task not found: ${name}`);
      }
      return this.getTaskStatus(task);
    }

    return Array.from(this.tasks.values()).map((task) => this.getTaskStatus(task));
  }

  /**
   * Get individual task status
   */
  private getTaskStatus(task: ScheduledTask): Record<string, unknown> {
    return {
      name: task.name,
      enabled: task.enabled,
      running: task.running,
      intervalMs: task.intervalMs,
      lastRun: task.lastRun?.toISOString() || null,
      nextRun: task.nextRun?.toISOString() || null,
      errorCount: task.errorCount,
      maxRetries: task.maxRetries,
    };
  }

  /**
   * Graceful shutdown - wait for running tasks to complete
   */
  async shutdown(): Promise<void> {
    console.log('[TaskScheduler] Shutting down...');
    this.isShuttingDown = true;

    // Clear all timers
    for (const task of this.tasks.values()) {
      if (task.timerId) {
        clearTimeout(task.timerId);
      }
    }

    // Wait for running tasks to complete
    const runningTasks = Array.from(this.tasks.values()).filter((t) => t.running);
    if (runningTasks.length > 0) {
      console.log(`[TaskScheduler] Waiting for ${runningTasks.length} running tasks...`);
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const stillRunning = Array.from(this.tasks.values()).filter((t) => t.running);
          if (stillRunning.length === 0) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });
    }

    console.log('[TaskScheduler] Shutdown complete');
  }
}

// Singleton instance
export const taskScheduler = new TaskScheduler();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await taskScheduler.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await taskScheduler.shutdown();
  process.exit(0);
});
