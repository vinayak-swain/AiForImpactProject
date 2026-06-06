import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../utils/api';
import type { Question } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

export const SessionPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  
  // Session setup states
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [role, setRole] = useState('Senior Frontend Engineer');
  const [interviewType, setInterviewType] = useState<'behavioural' | 'technical' | 'resume_based'>('technical');
  const [durationMins, setDurationMins] = useState(30);

  // Active question & score states
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [responseText, setResponseText] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(1800); // 30 mins default
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeScore, setActiveScore] = useState<any>(null);
  const [nextQuestionRef, setNextQuestionRef] = useState<Question | null>(null);

  // Timer countdown effect
  useEffect(() => {
    if (!sessionStarted) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStarted]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getWordCount = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  };

  const handleStartSession = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.startSession(role, interviewType, durationMins);
      setSessionId(res.sessionId);
      setCurrentQuestion(res.firstQuestion);
      setTimerSeconds(durationMins * 60);
      setSessionStarted(true);
      setQuestionNumber(1);
    } catch (err) {
      console.error('Failed to start session', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnalyzeAnswer = async () => {
    if (!responseText.trim() || !currentQuestion || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await api.submitAnswer(sessionId, currentQuestion.id, responseText);
      setActiveScore(res.scores);
      setNextQuestionRef(res.nextQuestion);
      setShowFeedbackPanel(true);
    } catch (err) {
      console.error('Failed to analyze answer', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextOrFinish = async () => {
    if (nextQuestionRef) {
      setCurrentQuestion(nextQuestionRef);
      setNextQuestionRef(null);
      setResponseText('');
      setActiveScore(null);
      setShowFeedbackPanel(false);
      setQuestionNumber(prev => prev + 1);
    } else {
      // Completed, call endSession
      setIsSubmitting(true);
      try {
        await api.endSession(sessionId);
        navigate(`/summary?sessionId=${sessionId}`);
      } catch (err) {
        console.error('Failed to end session', err);
        navigate('/summary');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className={`${isDark ? 'theme-joy-dark bg-background text-on-surface' : 'theme-joy bg-background text-on-surface'} min-h-screen transition-colors duration-300 relative overflow-x-hidden font-body`}>
      <ParticleBackground theme="joy" />

      {/* TopAppBar */}
      <header className="bg-surface border-b border-outline-variant shadow-lg flex justify-between items-center px-6 py-4 w-full top-0 z-50 fixed">
        <div className="flex items-center gap-4">
          <span 
            onClick={() => navigate(api.getCurrentUser() ? '/dashboard' : '/')}
            className="text-2xl font-black text-primary tracking-tighter cursor-pointer"
          >
            InterviewJoy
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
              className="text-primary font-bold border-b-2 border-primary pb-1"
            >
              Practice
            </button>
            <button 
              onClick={() => navigate('/history')}
              className="text-on-surface-variant font-medium hover:text-primary transition-colors"
            >
              History
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {sessionStarted && (
            <div className="flex items-center gap-2 bg-surface-container px-4 py-2 rounded-full shadow-inner border border-outline-variant">
              <span className="material-symbols-outlined text-primary text-sm">schedule</span>
              <span className="font-bold text-sm tabular-nums text-on-surface">
                {formatTime(timerSeconds)}
              </span>
            </div>
          )}
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

      {/* Main Content Area */}
      {!sessionStarted ? (
        <main className="pt-28 pb-12 px-4 max-w-lg mx-auto flex items-center justify-center min-h-[80vh]">
          <div className="w-full bg-surface p-8 rounded-2xl shadow-2xl border border-primary/10 flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-black text-primary mb-2">Setup Mock Session</h2>
              <p className="text-on-surface-variant text-sm font-medium">Customize your AI-scored interview environment</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface ml-2">Target Job Role</label>
                <input 
                  type="text" 
                  className="w-full px-6 py-3 rounded-full border-2 border-outline-variant focus:border-primary bg-surface-container transition-all outline-none text-on-surface text-sm"
                  placeholder="e.g. Senior Frontend Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface ml-2">Interview focus type</label>
                <select 
                  className="w-full px-6 py-3 rounded-full border-2 border-outline-variant focus:border-primary bg-surface-container transition-all outline-none text-on-surface text-sm"
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value as any)}
                >
                  <option value="technical">Technical Architecture & Coding</option>
                  <option value="behavioural">Behavioral (STAR Method Focus)</option>
                  <option value="resume_based">Resume-based Deep Dive</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface ml-2">Session duration</label>
                <select 
                  className="w-full px-6 py-3 rounded-full border-2 border-outline-variant focus:border-primary bg-surface-container transition-all outline-none text-on-surface text-sm"
                  value={durationMins}
                  onChange={(e) => setDurationMins(Number(e.target.value))}
                >
                  <option value={15}>15 Minutes (Express)</option>
                  <option value={30}>30 Minutes (Standard)</option>
                  <option value={45}>45 Minutes (Full Deep Dive)</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleStartSession}
              disabled={isSubmitting}
              className="w-full py-4 bg-primary text-on-primary font-black text-lg rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Initializing Coach...' : 'Launch AI Coach'}
              <span className="material-symbols-outlined">rocket_launch</span>
            </button>
          </div>
        </main>
      ) : (
        <main className="pt-24 pb-20 md:pb-8 px-4 md:px-8 max-w-[1600px] mx-auto h-[calc(100vh-2rem)] flex flex-col md:flex-row gap-6">
          {/* Left Panel: Active Session Form (60% width) */}
          <section className="w-full md:w-[60%] flex flex-col gap-6 overflow-y-auto pr-2 pb-12">
            <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
              <div className="flex items-center gap-3">
                <span className="bg-primary-fixed text-on-primary-fixed-variant px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  {role}
                </span>
                <span className="bg-secondary-container text-on-secondary-container px-4 py-1 rounded-full text-xs font-bold">
                  Question {questionNumber}
                </span>
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-surface rounded-2xl p-8 shadow-md border border-primary/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500"></div>
              <h2 className="text-xl md:text-2xl font-bold leading-tight relative z-10 text-on-surface">
                {currentQuestion?.questionText}
              </h2>
            </div>

            {/* Response Textarea */}
            <div className="flex-1 flex flex-col gap-4 relative">
              <div className="flex justify-between items-center px-2">
                <label className="font-bold text-sm text-on-surface-variant">Your Response</label>
                <span className="text-xs font-medium bg-surface-container text-on-surface-variant px-2.5 py-1 rounded-md">
                  {getWordCount(responseText)} words
                </span>
              </div>
              
              <textarea 
                className="w-full flex-grow min-h-[200px] md:min-h-[300px] p-6 rounded-2xl border-2 border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg leading-relaxed resize-none bg-surface/50 backdrop-blur-md text-on-surface" 
                placeholder="Type your response here... (Minimum 50 words recommended for high-scoring STAR feedback)"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                disabled={isSubmitting || showFeedbackPanel}
              />

              {/* STAR Tips Modal/Tooltip */}
              {showTips && (
                <div className="p-4 bg-secondary-container text-on-secondary-container rounded-2xl border border-secondary/20 shadow-md">
                  <h4 className="font-bold text-sm mb-1">STAR Method Guide</h4>
                  <ul className="text-xs space-y-1 list-disc pl-4">
                    <li><strong>Situation:</strong> Provide context, describe the challenge you faced.</li>
                    <li><strong>Task:</strong> Explain what was required of you or the goal.</li>
                    <li><strong>Action:</strong> Walk through the specific steps you took (focus on *your* contributions).</li>
                    <li><strong>Result:</strong> State what happened, using metrics and metrics-driven gains if possible.</li>
                  </ul>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mt-2">
                <button 
                  onClick={() => setShowTips(!showTips)}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-surface-container text-secondary font-bold hover:bg-secondary-container transition-colors bouncy"
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                  STAR Method Tips
                </button>
                {!showFeedbackPanel && (
                  <button 
                    onClick={handleAnalyzeAnswer}
                    disabled={!responseText.trim() || isSubmitting}
                    className={`w-full sm:w-auto px-10 py-4 bg-primary text-on-primary rounded-full font-bold text-lg shadow-lg bouncy transition-all ${!responseText.trim() || isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                  >
                    {isSubmitting ? 'Analyzing with AI...' : 'Analyze Response'}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Right Panel: Feedback / Results Panel (40% width) */}
          <aside className={`${showFeedbackPanel ? 'flex' : 'hidden'} md:flex w-full md:w-[40%] flex-col gap-6 overflow-y-auto pr-2 pb-12`}>
            {activeScore ? (
              <>
                <div className="bg-surface rounded-2xl p-6 shadow-md border border-outline-variant flex flex-col gap-6 mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xl text-secondary">Performance AI</h3>
                    <span className="bg-tertiary text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse">
                      Live AI Score
                    </span>
                  </div>

                  {/* Score Gauge */}
                  <div className="flex items-center gap-8 justify-center py-4">
                    <div className="relative w-32 h-32 flex items-center justify-center rounded-full p-3 bg-gradient-to-r from-primary to-secondary">
                      <div className="bg-surface w-full h-full rounded-full flex flex-col items-center justify-center shadow-inner">
                        <span className="text-4xl font-black text-on-surface">{activeScore.overallScore}</span>
                        <span className="text-[10px] font-bold text-on-surface-variant -mt-1">SCORE</span>
                      </div>
                      <div className="absolute -top-2 -right-2 bg-secondary text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-base border-4 border-surface shadow-md">
                        {activeScore.overallScore >= 90 ? 'A+' : activeScore.overallScore >= 80 ? 'A-' : activeScore.overallScore >= 70 ? 'B' : 'C'}
                      </div>
                    </div>
                  </div>

                  {/* Dimension sliders */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold px-1 mb-1">
                        <span>STAR Structure</span>
                        <span className="text-tertiary">{Math.round((activeScore.starScore / 25) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-tertiary rounded-full" style={{ width: `${(activeScore.starScore / 25) * 100}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold px-1 mb-1">
                        <span>Technical Depth</span>
                        <span className="text-primary">{Math.round((activeScore.techDepthScore / 25) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(activeScore.techDepthScore / 25) * 100}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold px-1 mb-1">
                        <span>Communication</span>
                        <span className="text-secondary">{Math.round((activeScore.commScore / 20) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-secondary rounded-full" style={{ width: `${(activeScore.commScore / 20) * 100}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold px-1 mb-1">
                        <span>Relevance</span>
                        <span className="text-tertiary">{Math.round((activeScore.relevanceScore / 15) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-tertiary-container rounded-full" style={{ width: `${(activeScore.relevanceScore / 15) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STAR Accordion Details */}
                <div className="bg-surface rounded-2xl p-5 shadow-md border border-outline-variant">
                  <h4 className="font-bold text-sm mb-3 text-on-surface">STAR Breakdown</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-surface-container border-l-4 border-tertiary rounded-r-lg">
                      <p className="text-[10px] font-black text-tertiary uppercase mb-1">Situation & Task</p>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {activeScore.aiFeedbackJson?.star?.situation} {activeScore.aiFeedbackJson?.star?.task}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-container border-l-4 border-secondary rounded-r-lg">
                      <p className="text-[10px] font-black text-secondary uppercase mb-1">Action</p>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {activeScore.aiFeedbackJson?.star?.action}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-container border-l-4 border-primary rounded-r-lg">
                      <p className="text-[10px] font-black text-primary uppercase mb-1">Result</p>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {activeScore.aiFeedbackJson?.star?.result}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="space-y-3">
                  <div className="bg-surface rounded-xl p-4 border-l-4 border-emerald-500 shadow-sm flex gap-3 items-start">
                    <span className="material-symbols-outlined text-emerald-500 mt-0.5">check_circle</span>
                    <div>
                      <p className="font-bold text-sm">Top Strength</p>
                      <p className="text-xs text-on-surface-variant">{activeScore.aiFeedbackJson?.topStrength}</p>
                    </div>
                  </div>
                  <div className="bg-surface rounded-xl p-4 border-l-4 border-error shadow-sm flex gap-3 items-start">
                    <span className="material-symbols-outlined text-error mt-0.5">warning</span>
                    <div>
                      <p className="font-bold text-sm">Top Weakness</p>
                      <p className="text-xs text-on-surface-variant">{activeScore.aiFeedbackJson?.topWeakness}</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Action buttons */}
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleNextOrFinish}
                    className="w-full py-4 rounded-full bg-secondary text-white font-bold shadow-md hover:brightness-110 bouncy"
                  >
                    {nextQuestionRef ? 'Next Question' : 'Finish & View Summary'}
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-surface rounded-2xl p-8 shadow-md border border-outline-variant flex flex-col items-center justify-center text-center h-[300px]">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">insights</span>
                <h4 className="font-bold text-base text-on-surface">Analysis Pending</h4>
                <p className="text-xs text-on-surface-variant max-w-[200px] mt-1">Submit your response to generate instant AI assessment</p>
              </div>
            )}
          </aside>
        </main>
      )}

      {/* Mobile Nav Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 md:hidden bg-surface shadow-lg rounded-t-xl border-t border-outline-variant">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button 
          onClick={() => setShowFeedbackPanel(prev => !prev)}
          className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-6 py-1.5 active:scale-90 transition-all shadow"
        >
          <span className="material-symbols-outlined">insights</span>
          <span className="text-[10px] font-bold">Feedback</span>
        </button>
        <button 
          onClick={() => navigate('/history')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">history</span>
          <span className="text-[10px] font-bold">History</span>
        </button>
      </nav>
    </div>
  );
};
