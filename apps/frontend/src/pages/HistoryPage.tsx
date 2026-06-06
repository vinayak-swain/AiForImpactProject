import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedType, setSelectedType] = useState('All Types');

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const stats = await api.getDashboardStats();
        setSessions(stats.recentSessions || []);
      } catch (err) {
        console.error('Failed to fetch session history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Filter logic
  const filteredSessions = sessions.filter(session => {
    const roleMatch = selectedRole === 'All Roles' || 
      session.role.toLowerCase().includes(selectedRole.toLowerCase());
    
    // session has type (if returned or hardcoded fallback)
    const typeMatch = selectedType === 'All Types' || 
      (session.type && session.type.toLowerCase().includes(selectedType.toLowerCase()));

    return roleMatch && typeMatch;
  });

  const handleExport = () => {
    alert('Exporting feedback history data to CSV...');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex items-center justify-center flex-col gap-4 font-body">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-sm text-on-surface-variant">Loading Session History...</p>
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'theme-joy-dark bg-background text-on-surface' : 'theme-joy bg-background text-on-surface'} min-h-screen overflow-x-hidden font-body relative transition-colors duration-300`}>
      <ParticleBackground theme="login" />

      {/* TopAppBar */}
      <header className="bg-surface border-b border-outline-variant shadow-lg flex justify-between items-center px-6 py-4 w-full top-0 z-50 fixed">
        <div className="flex items-center gap-4">
          <span 
            onClick={() => navigate(api.getCurrentUser() ? '/dashboard' : '/')}
            className="text-2xl font-black text-primary tracking-tighter cursor-pointer"
          >
            TechPrep AI
          </span>
          <div className="hidden md:flex gap-6 ml-8 text-sm">
            <button 
              onClick={() => navigate('/dashboard')}
              className="text-on-surface-variant font-medium hover:text-primary transition-colors"
            >
              Dashboard
            </button>
            <button 
              onClick={() => navigate('/session')}
              className="text-on-surface-variant font-medium hover:text-primary transition-colors"
            >
              Practice
            </button>
            <button 
              onClick={() => navigate('/history')}
              className="text-primary font-bold border-b-2 border-primary pb-1"
            >
              History
            </button>
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
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-28 pb-32">
        {/* Top Filters */}
        <section className="mb-10 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 px-6 py-3 bg-surface rounded-full shadow-sm border border-outline/10 text-sm">
            <span className="material-symbols-outlined text-secondary">work</span>
            <select 
              className="bg-transparent border-none focus:ring-0 font-medium text-on-surface cursor-pointer outline-none"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option>All Roles</option>
              <option>Senior Frontend Engineer</option>
              <option>Product Manager</option>
              <option>SDE II</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-6 py-3 bg-surface rounded-full shadow-sm border border-outline/10 text-sm">
            <span className="material-symbols-outlined text-tertiary">psychology</span>
            <select 
              className="bg-transparent border-none focus:ring-0 font-medium text-on-surface cursor-pointer outline-none"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option>All Types</option>
              <option value="technical">Technical</option>
              <option value="behavioural">Behavioral</option>
            </select>
          </div>

          <button 
            onClick={handleExport}
            className="ml-auto bg-primary text-on-primary px-8 py-3 rounded-full font-bold shadow-md bouncy hover:brightness-110 transition-all text-sm"
          >
            Export Data
          </button>
        </section>

        {/* Sessions list */}
        <h2 className="text-xl font-black text-white tracking-tight mb-6">Recent Sessions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map(session => (
            <div 
              key={session.id}
              className="bg-surface p-6 rounded-2xl shadow-md border border-outline-variant hover:border-primary/30 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-[10px] font-bold text-tertiary uppercase tracking-wider mb-1">
                      {session.endedAt ? new Date(session.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                    </div>
                    <h3 className="text-lg font-bold text-white leading-tight">
                      {session.role}
                    </h3>
                  </div>
                  <div className="bg-primary/20 text-secondary px-3 py-1 rounded-full font-black text-base">
                    {session.overallScore !== null ? `${session.overallScore}/100` : 'N/A'}
                  </div>
                </div>
                <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                  Interactive AI-scored interview session focusing on {session.type || 'technical concepts'}.
                </p>
              </div>

              <div className="flex gap-3 mt-auto">
                <button 
                  onClick={() => navigate(`/summary?sessionId=${session.id}`)}
                  className="flex-1 bg-primary text-on-primary py-2.5 rounded-full font-bold text-xs hover:brightness-110 active:scale-95 transition-all"
                >
                  View Report
                </button>
                <button 
                  onClick={() => alert(`Downloading report PDF for session...`)}
                  className="w-12 h-10 border border-outline-variant text-on-surface-variant rounded-full flex items-center justify-center hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                </button>
              </div>
            </div>
          ))}
          {filteredSessions.length === 0 && (
            <div className="col-span-full py-12 text-center text-on-surface-variant">
              No sessions found matching filters.
            </div>
          )}
        </div>
      </main>

      {/* Mobile navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-surface shadow-lg border-t border-outline-variant rounded-t-xl">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button 
          onClick={() => navigate('/session')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined">exercise</span>
          <span className="text-[10px] font-medium">Practice</span>
        </button>
        <button 
          onClick={() => navigate('/history')}
          className="flex flex-col items-center justify-center bg-primary text-on-primary rounded-full px-5 py-1"
        >
          <span className="material-symbols-outlined">history</span>
          <span className="text-[10px] font-medium">History</span>
        </button>
      </nav>
    </div>
  );
};
