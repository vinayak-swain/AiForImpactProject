import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Read cookie/localStorage first
    const getCookie = (name: string) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? match[2] : null;
    };
    const storedCookie = getCookie('theme');
    if (storedCookie === 'light' || storedCookie === 'dark') {
      return storedCookie;
    }
    const storedLocal = localStorage.getItem('theme');
    if (storedLocal === 'light' || storedLocal === 'dark') {
      return storedLocal;
    }
    return 'dark'; // default theme is dark space mode
  });

  useEffect(() => {
    // Set html tag attribute
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    // Write cookie
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    // Sync with backend API (fire-and-forget style)
    api.savePreferences(theme).catch((err) => {
      console.warn('Backend pref save failed:', err);
    });
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
