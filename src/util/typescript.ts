export function assert(condition: any, msg: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}

// blocks the thread
export function sleepSync (ms: number) {
  const start = Date.now()
  while (Date.now() < start + 1000) {}
}
