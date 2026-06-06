import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ParticleBackground } from '../components/ParticleBackground';
import { useTheme } from '../context/ThemeContext';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="theme-celestial bg-background text-on-surface min-h-screen font-body overflow-x-hidden relative">
      <ParticleBackground theme="login" />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-on-surface/10 shadow-sm">
        <div className="flex justify-between items-center h-20 px-6 md:px-16 max-w-7xl mx-auto">
          <div className="flex items-center gap-8">
            <a href="#" className="font-headline text-2xl font-bold text-on-surface tracking-tighter">
              TechPrep AI
            </a>
            <div className="hidden md:flex items-center gap-6">
              <a href="#" className="font-label text-sm text-secondary font-bold border-b-2 border-secondary hover:text-accent transition-colors duration-200">
                Features
              </a>
              <a href="#" className="font-label text-sm text-on-surface-variant hover:text-accent transition-colors duration-200">
                Pricing
              </a>
              <a href="#" className="font-label text-sm text-on-surface-variant hover:text-accent transition-colors duration-200">
                About
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
              onClick={toggleTheme}
              title="Toggle theme mode"
            >
              <span className="material-symbols-outlined">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 rounded-full font-label text-sm font-bold text-on-surface hover:text-accent transition-colors duration-200"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/signup')}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-label text-sm font-bold hover:scale-105 active:scale-95 transition-all"
            >
              Start for free
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-32">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 md:px-16 text-center mb-32">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/20 bg-accent/5 mb-8">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            <span className="font-label text-xs text-accent uppercase tracking-widest">
              New: ML Interview Tracks
            </span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl font-black text-on-surface mb-6 leading-tight max-w-4xl mx-auto tracking-tight">
            Ace your tech interview with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-container to-accent">
              AI coaching
            </span>
          </h1>

          <p className="font-body text-lg md:text-xl text-on-surface-variant max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-scored mock interviews, STAR method feedback, downloadable reports — built for SDE, ML, and DevOps roles.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <button 
              onClick={() => navigate('/signup')}
              className="bg-accent text-white px-10 py-4 rounded-full font-label text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all w-full sm:w-auto"
            >
              Start for free
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="px-10 py-4 rounded-full border border-outline/40 font-label text-sm text-on-surface hover:bg-surface transition-all w-full sm:w-auto"
            >
              See how it works
            </button>
          </div>

          {/* Dashboard Preview */}
          <div className="relative max-w-5xl mx-auto group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative rounded-2xl border border-on-surface/10 overflow-hidden shadow-2xl bg-surface-container-lowest">
              <div className="h-10 bg-surface flex items-center px-4 gap-2 border-b border-on-surface/5">
                <div className="w-3 h-3 rounded-full bg-accent/50"></div>
                <div className="w-3 h-3 rounded-full bg-secondary/50"></div>
                <div className="w-3 h-3 rounded-full bg-primary/50"></div>
                <div className="ml-4 text-xs font-label text-on-surface-variant/40">
                  techprep_dashboard.v2.ai
                </div>
              </div>
              <img 
                alt="Platform Dashboard Preview" 
                className="w-full h-auto grayscale-[0.2] hover:grayscale-0 transition-all duration-700 cursor-pointer"
                onClick={() => navigate('/dashboard')}
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCPGacISi7gQ5PK9IK-0ShLaYXKZeFKquVYWgY_nrl5WRKwpGghTsof5iMxphybekCLOeGsdbPs5nJZ3Niz0H6RLtV5y7YZqt6RkjRa1n11cG_hjcPkSf5oSfbqP7Eb-TJ2O-jlIjDsOoBqs_yBF7_I1Y_R7BmRDfuZmbB7z1yvS8GvG42OAFUKOjQ9yoWFsr749PG3JKslJACH6MmzdACaYC5nYfYYOz2CN4cHkpP6ocO6TAbjtRSAH3Sm1uknBw9bD4kr9tqXU8o"
              />
            </div>
          </div>
        </section>

        {/* Social Proof Strip */}
        <section className="border-y border-on-surface/5 py-12 mb-32 overflow-hidden bg-surface-container-lowest/20">
          <div className="max-w-7xl mx-auto px-6 md:px-16">
            <p className="font-label text-xs text-center text-on-surface-variant/50 uppercase tracking-[0.3em] mb-10">
              Trusted by engineers at
            </p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale contrast-125 font-headline font-bold text-xl tracking-widest text-on-surface">
              <span>GOOGLE</span>
              <span>META</span>
              <span>AMAZON</span>
              <span>MICROSOFT</span>
            </div>
          </div>
        </section>

        {/* Feature Cards Section */}
        <section className="max-w-7xl mx-auto px-6 md:px-16 mb-32">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* AI Scoring */}
            <div className="bg-surface border border-outline/20 p-8 rounded-2xl flex flex-col hover:border-accent/40 transition-all group cursor-pointer" onClick={() => navigate('/dashboard')}>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-secondary">monitoring</span>
              </div>
              <h3 className="font-headline text-lg font-bold mb-3 text-on-surface">AI Scoring</h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                Real-time performance metrics and confidence analysis.
              </p>
            </div>

            {/* STAR Coaching */}
            <div className="bg-surface border border-outline/20 p-8 rounded-2xl flex flex-col hover:border-accent/40 transition-all group cursor-pointer" onClick={() => navigate('/session')}>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-secondary">psychology</span>
              </div>
              <h3 className="font-headline text-lg font-bold mb-3 text-on-surface">STAR Coaching</h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                Structured feedback based on the STAR method.
              </p>
            </div>

            {/* Resume-Based */}
            <div className="bg-surface border border-outline/20 p-8 rounded-2xl flex flex-col hover:border-accent/40 transition-all group cursor-pointer" onClick={() => navigate('/signup')}>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-secondary">description</span>
              </div>
              <h3 className="font-headline text-lg font-bold mb-3 text-on-surface">Resume-Based</h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                Interviews tailored to your specific experience and tech stack.
              </p>
            </div>

            {/* PDF Reports */}
            <div className="bg-surface border border-outline/20 p-8 rounded-2xl flex flex-col hover:border-accent/40 transition-all group cursor-pointer" onClick={() => navigate('/summary')}>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-secondary">picture_as_pdf</span>
              </div>
              <h3 className="font-headline text-lg font-bold mb-3 text-on-surface">PDF Reports</h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                Downloadable performance reviews and improvement plans.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="max-w-7xl mx-auto px-6 md:px-16 mb-32">
          <div className="relative overflow-hidden rounded-[2rem] bg-surface p-12 md:p-24 text-center border border-outline/20 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 opacity-30"></div>
            <div className="relative z-10">
              <h2 className="font-headline text-3xl font-black mb-6 text-on-surface">
                Ready to ace your next interview?
              </h2>
              <p className="font-body text-base text-on-surface-variant max-w-xl mx-auto mb-10 leading-relaxed">
                Join 50,000+ engineers preparing for their dream roles at top tech companies with our AI simulator.
              </p>
              <button 
                onClick={() => navigate('/signup')}
                className="bg-accent text-white px-12 py-5 rounded-full font-label text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                Start for free
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 bg-surface-container-lowest border-t border-on-surface/5 opacity-80 hover:opacity-100 transition-opacity">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 px-6 md:px-16 max-w-7xl mx-auto">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="font-headline text-xl font-black text-on-surface">TechPrep AI</div>
            <p className="font-body text-sm text-on-surface-variant">
              © 2024 TechPrep AI. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            <a className="font-label text-xs text-on-surface-variant hover:text-accent transition-colors" href="#">
              Privacy Policy
            </a>
            <a className="font-label text-xs text-on-surface-variant hover:text-accent transition-colors" href="#">
              Terms of Service
            </a>
            <a className="font-label text-xs text-on-surface-variant hover:text-accent transition-colors" href="#">
              Cookie Policy
            </a>
            <a className="font-label text-xs text-on-surface-variant hover:text-accent transition-colors" href="#">
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
