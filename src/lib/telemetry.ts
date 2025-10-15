export function time<T>(label: string, fn: () => Promise<T>) {
  const start = Date.now();
  return fn().finally(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[time] ${label} ${Date.now()-start}ms`);
    }
  });
}








