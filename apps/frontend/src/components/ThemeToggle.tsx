import React from 'react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="theme-toggle-container">
      <button
        onClick={toggleTheme}
        role="switch"
        aria-checked={theme === 'dark'}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="cosmic-toggle"
      >
        <div className="cosmic-stars">
          <div className="cosmic-star"></div>
          <div className="cosmic-star"></div>
          <div className="cosmic-star"></div>
        </div>
        <div className="cosmic-thumb"></div>
      </button>
    </div>
  );
};
