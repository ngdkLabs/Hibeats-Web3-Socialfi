/**
 * Language Preference Hook
 * Manages language preference with cookie persistence
 */

import { useState, useEffect } from 'react';
import { cookieService } from '@/services/cookieService';

export type Language = 'en' | 'id';

export const useLanguage = () => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Load from cookie
    const saved = cookieService.getLanguage();
    if (saved === 'en' || saved === 'id') {
      return saved;
    }
    
    // Detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('id')) {
      return 'id';
    }
    return 'en';
  });

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    cookieService.setLanguage(newLanguage);
    
    // Update document lang attribute
    document.documentElement.lang = newLanguage;
  };

  // Set initial lang attribute
  useEffect(() => {
    document.documentElement.lang = language;
  }, []);

  return { language, setLanguage };
};
