import { useEffect, type ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    window.localStorage.removeItem('cpm-theme');
  }, []);

  return <>{children}</>;
}
