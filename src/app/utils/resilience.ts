export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  factor?: number;
  jitter?: boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 2,
    initialDelayMs = 50,
    factor = 2,
    jitter = true,
  } = options;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries) {
        throw error;
      }
      
      const sleepTime = jitter ? Math.floor(Math.random() * delay) : delay;
      console.warn(
        `[Resilience] Attempt ${attempt} failed: ${(error as Error).message}. Retrying in ${sleepTime}ms...`
      );
      
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      delay *= factor;
    }
  }
}

export async function executeWithFallback<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: (err: Error) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  try {
    return await retryWithBackoff(primaryFn, options);
  } catch (error) {
    console.error(`[Resilience: Fallback Activated] Reason: ${(error as Error).message}`);
    return await fallbackFn(error as Error);
  }
}