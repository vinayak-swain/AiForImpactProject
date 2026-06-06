import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Backend SDE');
  const [experience, setExperience] = useState('Mid-Level');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const expLevelMapped = experience === 'Junior' ? 'junior' : experience === 'Senior' ? 'senior' : 'mid';
    const roleTargetMapped = role;
    const name = email.split('@')[0];

    try {
      await api.register(name, email, roleTargetMapped, expLevelMapped, password);
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'Failed to create account');
    }
  };


  return (
    <div className="theme-celestial bg-background text-on-surface min-h-screen flex flex-col justify-between overflow-x-hidden relative font-body">
      <ParticleBackground theme="signup" />

      {/* Header */}
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
      <main className="flex-grow flex items-center justify-center px-4 py-24">
        <div className="w-full max-w-[480px] bg-surface rounded-2xl shadow-2xl p-8 md:p-10 transition-all duration-500 ease-out border border-outline/10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-on-surface mb-2 tracking-tight">Create your account</h1>
            <p className="text-on-surface-variant font-medium text-sm">Join 50,000+ engineers prepping for their dream roles</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <button 
              onClick={() => {
                const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                window.location.href = `${apiBase}/auth/oauth/google`;
              }}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-full border border-outline/30 hover:border-secondary transition-all duration-200 font-medium bouncy-hover bg-surface-container-low text-on-surface text-sm"
            >
              <img 
                alt="Google" 
                className="w-5 h-5" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD-iYQDMi8TwQPqQCe7JvrAHgUjeUh7xcyZCn2SSc0Z7tQCqYZc2nkILUyuThcXXTYWVS6d-_BliKN6asghZyl4S2L8rUiyY3_99hhB1ZtnTR5avlYS7gpcQuG70_PUD-d_88rH6jvgInQBPA7-lvJtaOvwVIPoZBFu1PU5OK1IWNzXc7zhij70NiDnKYr-UaGhm9WkP9vD4us7xvVyEgmf_tTlGzsmscNPHe4nvGG1fovK49DlAgL3Ojw6QZdhlGwT3vSkWslIkgM" 
              />
              <span>Google</span>
            </button>
            <button 
              onClick={() => {
                const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                window.location.href = `${apiBase}/auth/oauth/github`;
              }}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-full border border-outline/30 hover:border-secondary transition-all duration-200 font-medium bouncy-hover bg-surface-container-low text-on-surface text-sm"
            >
              <span className="material-symbols-outlined text-sm">terminal</span>
              <span>GitHub</span>
            </button>
          </div>

          <div className="relative flex items-center mb-8">
            <div className="flex-grow border-t border-outline/30"></div>
            <span className="flex-shrink mx-4 text-xs text-on-surface-variant font-bold uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-outline/30"></div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant ml-4 uppercase tracking-wider">Email Address</label>
              <input 
                className="w-full px-6 py-4 rounded-full bg-surface-container-low border border-outline/30 focus:border-secondary focus:ring-0 transition-all outline-none text-on-surface placeholder:text-outline text-sm" 
                placeholder="alex@example.com" 
                required 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant ml-4 uppercase tracking-wider">Password</label>
              <input 
                className="w-full px-6 py-4 rounded-full bg-surface-container-low border border-outline/30 focus:border-secondary focus:ring-0 transition-all outline-none text-on-surface placeholder:text-outline text-sm" 
                placeholder="••••••••" 
                required 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant ml-4 uppercase tracking-wider">Role</label>
                <div className="relative">
                  <select 
                    className="w-full px-6 py-4 rounded-full bg-surface-container-low border border-outline/30 focus:border-secondary focus:ring-0 transition-all outline-none appearance-none cursor-pointer text-on-surface text-sm"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="Backend SDE">Backend SDE</option>
                    <option value="Frontend SDE">Frontend SDE</option>
                    <option value="Full Stack SDE">Full Stack SDE</option>
                    <option value="ML Engineer">ML Engineer</option>
                    <option value="DevOps Engineer">DevOps Engineer</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant ml-4 uppercase tracking-wider">Experience</label>
                <div className="flex bg-surface-container-low p-1 rounded-full border border-outline/30">
                  <button 
                    className={`flex-1 py-3 px-2 rounded-full text-xs font-bold transition-all ${experience === 'Junior' ? 'bg-secondary text-white shadow-sm' : 'text-on-surface-variant'}`}
                    onClick={() => setExperience('Junior')}
                    type="button"
                  >
                    Jun
                  </button>
                  <button 
                    className={`flex-1 py-3 px-2 rounded-full text-xs font-bold transition-all ${experience === 'Mid-Level' ? 'bg-secondary text-white shadow-sm' : 'text-on-surface-variant'}`}
                    onClick={() => setExperience('Mid-Level')}
                    type="button"
                  >
                    Mid
                  </button>
                  <button 
                    className={`flex-1 py-3 px-2 rounded-full text-xs font-bold transition-all ${experience === 'Senior' ? 'bg-secondary text-white shadow-sm' : 'text-on-surface-variant'}`}
                    onClick={() => setExperience('Senior')}
                    type="button"
                  >
                    Sen
                  </button>
                </div>
              </div>
            </div>
            {error && (
              <div className="bg-error/10 border border-error/20 text-error text-xs font-bold px-4 py-3 rounded-full text-center">
                {error}
              </div>
            )}
            <button 
              className="w-full py-4 bg-primary text-white font-black text-lg rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-all duration-300 mt-4 hover:bg-[#1a5f7a]" 
              type="submit"
              disabled={isSubmitting}
            >
              {success ? (
                <span>Account Ready ✨</span>
              ) : isSubmitting ? (
                <span>Creating...</span>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>
          <div className="mt-8 text-center">
            <p className="text-on-surface-variant font-medium text-sm">
              Already have an account?{' '}
              <button 
                onClick={() => navigate('/login')} 
                className="text-secondary font-bold hover:underline ml-1 bg-transparent border-none cursor-pointer"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex flex-col md:flex-row justify-between items-center w-full px-6 py-8 mt-auto bg-transparent border-t border-outline/10 text-xs">
        <div className="text-sm font-bold text-secondary mb-4 md:mb-0">TechPrep AI</div>
        <div className="flex gap-6 mb-4 md:mb-0">
          <a className="text-on-surface-variant font-body text-sm hover:text-secondary transition-colors" href="#">Privacy</a>
          <a className="text-on-surface-variant font-body text-sm hover:text-secondary transition-colors" href="#">Terms</a>
          <a className="text-on-surface-variant font-body text-sm hover:text-secondary transition-colors" href="#">Support</a>
        </div>
        <div className="text-on-surface-variant opacity-60 font-body text-sm">
          © 2024 TechPrep AI. Celestial Edition.
        </div>
      </footer>
    </div>
  );
};
