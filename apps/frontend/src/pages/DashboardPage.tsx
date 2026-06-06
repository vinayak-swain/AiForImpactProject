import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../utils/api';
import type { SessionStats, ScoreTrendItem } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [timeRange, setTimeRange] = useState('Last 30 Days');
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrendItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  // Streak state that can be incremented locally too
  const [streak, setStreak] = useState(15);

  useEffect(() => {
    const user = api.getCurrentUser();
    setCurrentUser(user);
    if (user?.streak) {
      setStreak(user.streak);
    }

    async function loadData() {
      try {
        const [statsData, trendData] = await Promise.all([
          api.getDashboardStats(),
          api.getScoreTrend()
        ]);
        setStats(statsData);
        setScoreTrend(trendData);
        if (statsData.streak) {
          setStreak(statsData.streak);
        }
      } catch (err) {
        console.error('Failed to load dashboard statistics', err);
      }
    }
    loadData();
  }, []);

  const handleLogout = async () => {
    await api.logout();
    navigate('/login');
  };

  const incrementStreak = () => setStreak(s => s + 1);

  // Render dummy data or skeletons if stats is not loaded yet
  const activeStats: SessionStats = stats || {
    totalSessions: 0,
    avgScore: 0,
    bestScore: 0,
    streak: streak,
    questionsAnswered: 0,
    weakAreas: [
      { dimension: 'STAR Structure', avgPercentage: 70, suggestion: 'Practice behavioral answers using situation, task, action, and results.' },
      { dimension: 'Technical Depth', avgPercentage: 65, suggestion: 'Explain structural backend architectural designs and algorithmic complexity.' }
    ],
    recentSessions: [],
    dimensionAverages: { star: 0, techDepth: 0, comm: 0, relevance: 0, confidence: 0, conciseness: 0 }
  };

  return (
    <div className="theme-celestial bg-background text-on-surface min-h-screen font-body relative overflow-x-hidden">
      <ParticleBackground theme="celestial" />

      {/* SideNavBar (Desktop) */}
      <aside className="fixed left-0 top-0 h-full p-4 border-r border-outline/20 w-[240px] hidden md:flex flex-col bg-surface z-40 shadow-xl">
        <div className="mb-8 px-4 cursor-pointer" onClick={() => navigate(api.getCurrentUser() ? '/dashboard' : '/')}>
          <h1 className="text-2xl font-headline font-black text-on-surface tracking-tight">TechPrep AI</h1>
          <p className="text-on-surface-variant text-sm font-medium">Interview Coach</p>
        </div>
        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 bg-primary text-on-primary rounded-full px-4 py-3 transition-transform duration-200 scale-[1.03] shadow-lg text-left"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-sm font-medium">Dashboard</span>
          </button>
          <button 
            onClick={() => navigate('/session')}
            className="w-full flex items-center gap-3 text-on-surface-variant hover:text-on-surface rounded-full px-4 py-3 transition-all duration-200 hover:scale-[1.03] hover:bg-surface-container text-left"
          >
            <span className="material-symbols-outlined">video_call</span>
            <span className="text-sm font-medium">New Interview</span>
          </button>
          <button 
            onClick={() => navigate('/history')}
            className="w-full flex items-center gap-3 text-on-surface-variant hover:text-on-surface rounded-full px-4 py-3 transition-all duration-200 hover:scale-[1.03] hover:bg-surface-container text-left"
          >
            <span className="material-symbols-outlined">history</span>
            <span className="text-sm font-medium">History</span>
          </button>
          <button 
            onClick={() => navigate('/summary')}
            className="w-full flex items-center gap-3 text-on-surface-variant hover:text-on-surface rounded-full px-4 py-3 transition-all duration-200 hover:scale-[1.03] hover:bg-surface-container text-left"
          >
            <span className="material-symbols-outlined">description</span>
            <span className="text-sm font-medium">Latest Summary</span>
          </button>
        </nav>
        <div className="mt-auto p-4 space-y-2">
          <button 
            onClick={handleLogout}
            className="w-full border border-outline/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-bold py-2.5 rounded-full text-xs transition-colors mb-2"
          >
            Logout
          </button>
          <button 
            onClick={() => navigate('/session')}
            className="w-full bg-accent text-white font-bold py-3 rounded-full bouncy-hover shadow-lg text-sm"
          >
            Start Practice
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <main className="md:pl-[240px] pb-24 md:pb-8">
        {/* TopAppBar */}
        <header className="flex justify-between items-center w-full px-6 py-6 md:px-10 bg-background/80 backdrop-blur-md sticky top-0 z-30 border-b border-outline/10">
          <div className="flex flex-col">
            <h2 className="font-headline text-2xl font-bold text-on-surface">Good morning, {currentUser?.name || 'Swayam'} 👋</h2>
            <p className="text-on-surface-variant text-sm font-medium">Ready for today's session?</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="w-10 h-10 rounded-full bg-surface border-2 border-primary overflow-hidden cursor-pointer" onClick={() => navigate('/history')}>
              <img 
                alt="User profile" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA4Jln0sR0rwuKylrsmOzhA_hHF2RhqDJRujdTCvpLQMt9feH_aNo3irFnrAcNjTd0l6aqEcnQQ9Sl95hOQCHAW5Obv-LwzqOMbxMznMsOM1ej1Btp0adqP8CPhO966axTwz-8PVNWShkg6u3NNcGhm_m0UzPNNy5xXMxlD4kSsgOmcBJZ01F6LW_oezB6JLCkgzSb0ttNOvL2SciMC0fCAYwnkL5st9q_e98kzHeQxnmPU5A9rOn_UcbShoqMKxiFZ5yGXTYjVDEI" 
              />
            </div>
          </div>
        </header>

        <section className="px-6 md:px-10 space-y-8 mt-6">
          {/* Stats Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div 
              onClick={() => navigate('/history')}
              className="bg-surface border border-white/5 p-6 rounded-2xl celestial-shadow bouncy-hover cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="p-2 bg-primary/20 text-success rounded-full material-symbols-outlined">task_alt</span>
                <span className="text-success font-bold text-sm">+12%</span>
              </div>
              <p className="text-xs font-medium text-on-surface-variant">Interviews Done</p>
              <h3 className="text-3xl font-black text-on-surface">{activeStats.totalSessions}</h3>
            </div>

            <div 
              onClick={() => navigate('/summary')}
              className="bg-surface border border-white/5 p-6 rounded-2xl celestial-shadow bouncy-hover cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="p-2 bg-primary/20 text-success rounded-full material-symbols-outlined">stars</span>
                <span className="text-success font-bold text-sm">{(activeStats.avgScore / 10).toFixed(1)}</span>
              </div>
              <p className="text-xs font-medium text-on-surface-variant">Avg Score</p>
              <h3 className="text-3xl font-black text-on-surface">{activeStats.avgScore}<span className="text-lg font-bold">%</span></h3>
            </div>

            <div className="bg-surface border border-white/5 p-6 rounded-2xl celestial-shadow bouncy-hover">
              <div className="flex justify-between items-start mb-2">
                <span className="p-2 bg-accent/20 text-warning rounded-full material-symbols-outlined">warning</span>
              </div>
              <p className="text-xs font-medium text-on-surface-variant">Weak Spots</p>
              <h3 className="text-3xl font-black text-on-surface">{activeStats.weakAreas.length}</h3>
            </div>

            <div 
              onClick={incrementStreak}
              className="bg-surface border border-white/5 p-6 rounded-2xl celestial-shadow bouncy-hover cursor-pointer"
              title="Click to increase streak!"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="p-2 bg-accent/20 text-accent rounded-full material-symbols-outlined">local_fire_department</span>
                <span className="text-accent font-bold text-xs">Active</span>
              </div>
              <p className="text-xs font-medium text-on-surface-variant">Days Streak</p>
              <h3 className="text-3xl font-black text-on-surface">{streak} 🔥</h3>
            </div>
          </div>

          {/* Charts & Bento Grid Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Trend Line Chart */}
            <div className="lg:col-span-2 bg-surface p-6 rounded-2xl celestial-shadow relative overflow-hidden h-[340px]">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-bold text-lg text-on-surface">Score Trend</h4>
                <select 
                  className="bg-background border-none text-xs font-bold rounded-full px-4 py-2 text-on-surface focus:ring-2 focus:ring-primary cursor-pointer outline-none"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <option>Last 30 Days</option>
                  <option>Last 7 Days</option>
                </select>
              </div>
              
              {/* Responsive Bar representation matching design */}
              <div className="relative w-full h-44 flex items-end justify-between gap-4 px-2">
                {scoreTrend.length > 0 ? (
                  scoreTrend.map((item, idx) => (
                    <div 
                      key={item.id || idx}
                      className="w-full bg-primary/40 rounded-t-full transition-all hover:bg-primary" 
                      style={{ height: `${item.score}%` }}
                      title={`${item.role || 'Session'}: ${item.score}%`}
                    ></div>
                  ))
                ) : (
                  <>
                    <div className="w-full bg-primary/40 h-[40%] rounded-t-full transition-all hover:bg-primary" title="Mon: 65%"></div>
                    <div className="w-full bg-primary/40 h-[60%] rounded-t-full transition-all hover:bg-primary" title="Tue: 72%"></div>
                    <div className="w-full bg-primary/40 h-[55%] rounded-t-full transition-all hover:bg-primary" title="Wed: 68%"></div>
                    <div className="w-full bg-primary/40 h-[85%] rounded-t-full transition-all hover:bg-primary" title="Thu: 92%"></div>
                    <div className="w-full bg-primary/40 h-[70%] rounded-t-full transition-all hover:bg-primary" title="Fri: 78%"></div>
                    <div className="w-full bg-primary/40 h-[95%] rounded-t-full transition-all hover:bg-primary" title="Sat: 98%"></div>
                    <div className="w-full bg-primary/40 h-[80%] rounded-t-full transition-all hover:bg-primary" title="Sun: 88%"></div>
                  </>
                )}
              </div>
              <div className="flex justify-between text-[10px] font-bold text-on-surface-variant mt-4 px-2">
                {scoreTrend.length > 0 ? (
                  scoreTrend.map((item, idx) => (
                    <span key={item.id || idx}>{item.date.toUpperCase()}</span>
                  ))
                ) : (
                  <>
                    <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
                  </>
                )}
              </div>
            </div>

            {/* Skill Radar Chart / Breakdown */}
            <div className="bg-primary text-white p-6 rounded-2xl celestial-shadow flex flex-col justify-between">
              <h4 className="font-bold text-lg">Skill Breakdown</h4>
              <div className="flex-1 flex items-center justify-center py-4">
                <div className="relative w-32 h-32">
                  <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-white/20 rounded-full scale-75"></div>
                  <div className="absolute inset-0 border-4 border-white/30 rounded-full scale-50"></div>
                  <div className="absolute w-2.5 h-2.5 bg-success rounded-full top-0 left-1/2 -translate-x-1/2 shadow-lg"></div>
                  <div className="absolute w-2.5 h-2.5 bg-success rounded-full bottom-0 left-1/2 -translate-x-1/2 shadow-lg"></div>
                  <div className="absolute w-2.5 h-2.5 bg-success rounded-full left-0 top-1/2 -translate-y-1/2 shadow-lg"></div>
                  <div className="absolute w-2.5 h-2.5 bg-success rounded-full right-0 top-1/2 -translate-y-1/2 shadow-lg"></div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Logic</span>
                    <span className="text-success font-bold">
                      {activeStats.dimensionAverages.relevance ? Math.round((activeStats.dimensionAverages.relevance / 15) * 100) : 92}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-success h-full" style={{ width: `${activeStats.dimensionAverages.relevance ? Math.round((activeStats.dimensionAverages.relevance / 15) * 100) : 92}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Delivery</span>
                    <span className="text-success font-bold">
                      {activeStats.dimensionAverages.comm ? Math.round((activeStats.dimensionAverages.comm / 20) * 100) : 74}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-success h-full" style={{ width: `${activeStats.dimensionAverages.comm ? Math.round((activeStats.dimensionAverages.comm / 20) * 100) : 74}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Focus Areas Panel */}
          <div className="space-y-4">
            <h4 className="font-bold text-lg text-on-surface mb-4 px-2">Focus Areas for Improvement</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {activeStats.weakAreas.map((weak, idx) => {
                const icons = ['forum', 'account_tree', 'psychology'];
                const borders = ['border-accent', 'border-primary', 'border-success'];
                const bgIcons = ['bg-accent/10 text-accent', 'bg-primary/20 text-primary', 'bg-success/10 text-success'];
                const borderClass = borders[idx % borders.length];
                const bgClass = bgIcons[idx % bgIcons.length];
                const icon = icons[idx % icons.length];
                return (
                  <div 
                    key={idx}
                    onClick={() => navigate('/session')}
                    className={`bg-surface ${borderClass} border-l-4 p-5 rounded-2xl celestial-shadow flex gap-4 items-center bouncy-hover cursor-pointer`}
                  >
                    <div className={`p-3 ${bgClass} rounded-full`}>
                      <span className="material-symbols-outlined">{icon}</span>
                    </div>
                    <div>
                      <p className="font-black text-on-surface">{weak.dimension}</p>
                      <p className="text-xs text-on-surface-variant font-medium select-none" title={weak.suggestion}>
                        {weak.suggestion.length > 35 ? `${weak.suggestion.slice(0, 35)}...` : weak.suggestion}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Sessions Table */}
          <div className="bg-surface rounded-2xl celestial-shadow overflow-hidden border border-white/5">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h4 className="font-bold text-lg text-on-surface">Recent Sessions</h4>
              <button 
                onClick={() => navigate('/history')}
                className="text-success font-bold text-sm hover:underline bg-transparent border-none cursor-pointer"
              >
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-background/50 text-on-surface-variant text-[10px] font-black uppercase tracking-wider">
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4 text-center">Score</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeStats.recentSessions && activeStats.recentSessions.length > 0 ? (
                    activeStats.recentSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-6 py-4 text-sm font-medium">
                          {s.endedAt ? new Date(s.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-bold text-on-surface">{s.role}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <span className={`px-3 py-1 font-bold rounded-full text-xs ${s.overallScore && s.overallScore >= 80 ? 'bg-success/20 text-success' : 'bg-primary/40 text-on-primary'}`}>
                              {s.overallScore !== null ? `${s.overallScore}/100` : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 text-success font-bold text-xs uppercase">
                            <span className="w-2 h-2 bg-success rounded-full"></span> Completed
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => navigate(`/summary?sessionId=${s.id}`)}
                            className="p-2 hover:bg-surface-container rounded-full text-success transition-colors"
                          >
                            <span className="material-symbols-outlined">visibility</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant text-sm font-medium">
                        No recent sessions found. Start a new interview practice!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* BottomNavBar (Mobile) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-surface md:hidden rounded-t-2xl shadow-2xl border-t border-white/5">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex flex-col items-center justify-center bg-primary text-on-primary rounded-full px-4 py-2 transform scale-110 -translate-y-2 shadow-lg transition-transform duration-300 ease-out"
        >
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[8px] font-bold uppercase">Home</span>
        </button>
        <button 
          onClick={() => navigate('/session')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">add_circle</span>
          <span className="text-[8px] font-bold uppercase">New</span>
        </button>
        <button 
          onClick={() => navigate('/history')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">history</span>
          <span className="text-[8px] font-bold uppercase">History</span>
        </button>
        <button 
          onClick={() => navigate('/summary')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">description</span>
          <span className="text-[8px] font-bold uppercase">Summary</span>
        </button>
      </nav>

      {/* Floating Quick Start Button */}
      <button 
        onClick={() => navigate('/session')}
        className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-16 h-16 bg-accent text-white rounded-full flex items-center justify-center shadow-2xl z-50 bouncy-hover" 
        title="Start Mock Interview"
      >
        <span className="material-symbols-outlined text-3xl">video_call</span>
      </button>
    </div>
  );
};
