import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `ms` milliseconds
 * of inactivity. Use this to delay expensive operations (e.g. API calls) until
 * the user has stopped typing.
 */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
