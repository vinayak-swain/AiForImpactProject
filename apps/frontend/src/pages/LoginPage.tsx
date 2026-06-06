import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await api.login(email, password);
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'Login failed');
    }
  };


  return (
    <div className="theme-celestial bg-background text-on-surface min-h-screen flex flex-col justify-between overflow-x-hidden relative font-body">
      <ParticleBackground theme="login" />

      {/* Top Header */}
      <header className="flex justify-between items-center w-full px-6 py-4 fixed top-0 left-0 z-50 bg-transparent">
        <div 
          onClick={() => navigate('/')}
          className="text-2xl font-black text-secondary cursor-pointer transition-all duration-300 ease-out hover:scale-110"
        >
          TechPrep AI
        </div>
        <div className="flex items-center gap-4">
          <button 
            className="material-symbols-outlined text-on-surface-variant p-2 rounded-full hover:bg-surface transition-colors duration-200"
            onClick={() => navigate('/')}
          >
            home
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-surface transition-colors duration-200 text-on-surface-variant"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 pt-24 pb-12">
        <div className="w-full max-w-md bg-surface p-8 md:p-10 rounded-2xl shadow-2xl bouncy-hover border border-outline/10">
          {/* Welcome Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-on-surface mb-2">Welcome back</h1>
            <p className="text-on-surface-variant font-medium text-sm">
              Login to continue your interview prep
            </p>
          </div>

          {/* Social Logins */}
          <div className="space-y-3 mb-8">
            <button 
              onClick={() => {
                const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                window.location.href = `${apiBase}/auth/oauth/google`;
              }}
              className="w-full flex items-center justify-center gap-3 py-3 px-6 border-2 border-outline/30 rounded-full font-bold text-on-surface hover:bg-surface-container-low transition-all duration-200 text-sm"
            >
              <img 
                alt="Google Logo" 
                className="w-5 h-5" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAH-TWCAqiLfVZ_mJAq6hi24jwtspZNiIkzIc-MBAd4qVKvjCLeQJIBT7RwTB0lnxbFS1tEGICAmYARutis_MvH9lorwHLKihUDCY0m4sh6cz3cAYTsnidFSdKSeGMHoJU3FZJHePjQ8tk3P5744XRt5CAXCy4QtAcdS2S66SHdWRW6XBjARAijQjmdJ-P2Pvd2hbygJYojstaYDakWJ3mOoPyzrCGae_M9GYMIwMmOjGHIy869QZF0bgn9TO5Ger6EAFxyKT5AgF8" 
              />
              Continue with Google
            </button>
            <button 
              onClick={() => {
                const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                window.location.href = `${apiBase}/auth/oauth/github`;
              }}
              className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-[#0d1117] text-white rounded-full font-bold hover:opacity-90 transition-all duration-200 border border-outline/30 text-sm"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>
              </svg>
              Continue with GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-8 flex items-center justify-center">
            <div className="border-t border-outline/30 w-full"></div>
            <span className="absolute bg-surface px-4 text-on-surface-variant font-bold text-xs">
              or
            </span>
          </div>

          {/* Login Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface ml-2" htmlFor="email">
                Email Address
              </label>
              <input 
                className="w-full px-6 py-3 rounded-full border-2 border-outline/30 focus:border-secondary focus:ring-4 focus:ring-secondary/20 bg-surface-container-low transition-all outline-none text-on-surface placeholder:text-on-surface-variant/40 text-sm" 
                id="email" 
                placeholder="hello@example.com" 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-2">
                <label className="text-xs font-bold text-on-surface" htmlFor="password">
                  Password
                </label>
                <a className="text-xs font-bold text-secondary hover:underline" href="#">
                  Forgot?
                </a>
              </div>
              <input 
                className="w-full px-6 py-3 rounded-full border-2 border-outline/30 focus:border-secondary focus:ring-4 focus:ring-secondary/20 bg-surface-container-low transition-all outline-none text-on-surface placeholder:text-on-surface-variant/40 text-sm" 
                id="password" 
                placeholder="••••••••" 
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="bg-error/10 border border-error/20 text-error text-xs font-bold px-4 py-3 rounded-full text-center">
                {error}
              </div>
            )}
            <button 
              className={`w-full py-4 bg-primary text-white font-black rounded-full text-lg shadow-lg hover:brightness-110 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2`}
              type="submit"
              disabled={isSubmitting}
            >
              {success ? (
                <span>Success! Redirecting...</span>
              ) : isSubmitting ? (
                <span>Verifying...</span>
              ) : (
                <>
                  Login
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-8 text-center">
            <p className="text-on-surface-variant font-medium text-sm">
              Don't have an account?{' '}
              <button 
                onClick={() => navigate('/signup')} 
                className="text-secondary font-bold hover:underline ml-1 bg-transparent border-none cursor-pointer"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex flex-col md:flex-row justify-between items-center w-full px-6 py-8 mt-auto bg-transparent border-t border-outline/10 text-xs">
        <div className="text-sm font-bold text-secondary mb-4 md:mb-0">
          TechPrep AI
        </div>
        <div className="flex gap-6 mb-4 md:mb-0">
          <a className="font-body text-on-surface-variant hover:text-secondary transition-colors" href="#">Privacy</a>
          <a className="font-body text-on-surface-variant hover:text-secondary transition-colors" href="#">Terms</a>
          <a className="font-body text-on-surface-variant hover:text-secondary transition-colors" href="#">Support</a>
        </div>
        <div className="font-body text-on-surface-variant/60">
          © 2024 TechPrep AI. Celestial Intelligence Edition.
        </div>
      </footer>
    </div>
  );
};
