import { useState, useEffect } from 'react';
import { cookieService } from '@/services/cookieService';

export type Theme = 'light' | 'dark' | 'system';

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Load from cookie first
    const savedTheme = cookieService.getTheme();
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    
    // Fallback to system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove previous theme classes
    root.classList.remove('light', 'dark');
    
    // Apply theme
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    
    // Save to cookie (only if not system)
    if (newTheme !== 'system') {
      cookieService.setTheme(newTheme);
    }
  };

  return { theme, setTheme };
};
