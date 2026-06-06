import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../utils/api';
import type { SessionDetail } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

export const SummaryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');

  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<(SessionDetail & { type: string; answers: any[] }) | null>(null);
  const [aiSummary, setAiSummary] = useState<{ executive_summary: string, action_plan: string[] } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Checklist dynamic states
  const [checklist, setChecklist] = useState<Array<{ id: number; text: string; done: boolean }>>([]);

  useEffect(() => {
    const fetchSessionDetails = async () => {
      setLoading(true);
      try {
        let targetId = sessionIdParam;
        if (!targetId) {
          // Fallback to fetch dashboard stats and get the latest session ID
          const stats = await api.getDashboardStats();
          if (stats.recentSessions && stats.recentSessions.length > 0) {
            targetId = stats.recentSessions[0].id;
          }
        }

        if (targetId) {
          const detail = await api.getSessionDetail(targetId);
          
          // Map backend questions list to component's expected answers structure
          const answersList = (detail.questions || []).map((q: any) => {
            if (q.answer) {
              return {
                id: q.id,
                questionText: q.questionText,
                responseText: q.answer.answerText,
                scores: q.answer.score,
              };
            }
            return null;
          }).filter(Boolean);

          const mappedDetail = {
            ...detail,
            type: detail.interviewType,
            answers: answersList,
          };

          setSession(mappedDetail);
          if (answersList.length > 0) {
            setExpandedId((answersList[0] as any).id);
            
            try {
              const summaryData = await api.getAiReportSummary(targetId);
              if (summaryData && summaryData.executive_summary) {
                setAiSummary(summaryData);
                const list = (summaryData.action_plan || []).map((text: string, idx: number) => ({
                  id: idx + 1,
                  text,
                  done: false
                }));
                setChecklist(list);
              } else {
                const list = answersList.map((ans: any, idx: number) => ({
                  id: idx + 1,
                  text: ans.scores?.aiFeedbackJson?.topWeakness 
                    ? `Work on: ${ans.scores.aiFeedbackJson.topWeakness}`
                    : `Refine delivery structure for Question ${idx + 1}`,
                  done: false
                }));
                setChecklist(list);
              }
            } catch (err) {
              console.error('Failed to load AI summary', err);
              const list = answersList.map((ans: any, idx: number) => ({
                id: idx + 1,
                text: ans.scores?.aiFeedbackJson?.topWeakness 
                  ? `Work on: ${ans.scores.aiFeedbackJson.topWeakness}`
                  : `Refine delivery structure for Question ${idx + 1}`,
                done: false
              }));
              setChecklist(list);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load session details', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionDetails();
  }, [sessionIdParam]);

  const toggleCheck = (id: number) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  const handleDownload = async () => {
    if (!sessionIdParam) return;
    try {
      const res = await api.getSessionReportUrl(sessionIdParam);
      if (res && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert('Your PDF report is still being compiled by the backend worker. Please try again in a few seconds!');
      }
    } catch (err) {
      console.error('Failed to download PDF report', err);
      alert('Failed to obtain PDF download link. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex items-center justify-center flex-col gap-4 font-body">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-sm text-on-surface-variant">Generating Performance Report...</p>
      </div>
    );
  }

  // Fallback to mock session details if no actual session could be resolved
  const activeSession = session || {
    id: 'mock-session',
    role: 'Senior Frontend Engineer',
    type: 'technical',
    overallScore: 84,
    endedAt: new Date().toISOString(),
    answers: [
      {
        id: 'q1',
        questionText: "Describe a time you had to resolve a complex technical conflict within your team. What was the situation and how did you handle it?",
        responseText: "We were building a React application where half the team wanted to use Redux Toolkit for state management, while the other half advocated for simple React Context. The conflict was stalling development. I scheduled a technical review meeting where we documented the trade-offs of both approaches relative to our project scope. We eventually agreed that Context was sufficient for our MVP, but we would establish a migration path to Redux if state grew complex.",
        scores: {
          id: 's1',
          overallScore: 86,
          starScore: 21,
          techDepthScore: 22,
          commScore: 17,
          relevanceScore: 13,
          aiFeedbackJson: {
            star: {
              situation: "Clearly identified conflict around state management choices and the project stall.",
              task: "Took initiative to resolve the deadlock to prevent further schedule slippage.",
              action: "Facilitated a structured trade-off session. Used documentation to ground the team in data rather than opinions.",
              result: "Aligned team consensus, resumed development, and finished MVP on time."
            },
            topStrength: "Exceptional trade-off reasoning and technical moderation style.",
            topWeakness: "Lacked explicit metrics (e.g. bundle size savings, delivery speedup) to quantify results.",
            coachingAdvice: "To elevate this answer, include specific metrics about development speed or code complexity reduction resulting from this choice."
          }
        }
      }
    ]
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
            TechPrep
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
              className="text-on-surface-variant font-medium hover:text-primary transition-colors"
            >
              History
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
            onClick={toggleTheme}
          >
            <span className="material-symbols-outlined">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-28 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Score Dial & Executive Summary (1/3 width) */}
          <section className="flex flex-col gap-6">
            <div className="bg-surface rounded-2xl p-8 border border-outline-variant shadow-lg text-center flex flex-col items-center">
              <h2 className="font-bold text-lg text-on-surface-variant mb-6 uppercase tracking-wider">Interview score</h2>
              
              {/* Radial Dial */}
              <div className="relative w-40 h-40 flex items-center justify-center rounded-full p-4 bg-gradient-to-tr from-primary via-secondary to-tertiary">
                <div className="bg-surface w-full h-full rounded-full flex flex-col items-center justify-center shadow-inner">
                  <span className="text-5xl font-black text-on-surface">
                    {activeSession.overallScore || 0}
                  </span>
                  <span className="text-[10px] font-bold text-on-surface-variant -mt-1">SCORE</span>
                </div>
                <div className="absolute top-0 right-0 bg-secondary text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-4 border-surface shadow-md">
                  {(activeSession.overallScore || 0) >= 90 ? 'A+' : (activeSession.overallScore || 0) >= 80 ? 'A-' : (activeSession.overallScore || 0) >= 70 ? 'B' : 'C'}
                </div>
              </div>

              <div className="mt-8">
                <h3 className="font-black text-xl text-on-surface">{activeSession.role}</h3>
                <p className="text-xs text-on-surface-variant font-semibold mt-1">
                  Completed {activeSession.endedAt ? new Date(activeSession.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                </p>
              </div>
            </div>

            {/* Executive Summary Card */}
            <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-lg flex flex-col gap-4">
              <h3 className="font-bold text-lg text-primary">Executive Summary</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {aiSummary?.executive_summary || `The candidate practiced a ${activeSession.type} interview session for the role of ${activeSession.role}. Performance shows key strengths in logical articulation with some recommendations for technical details.`}
              </p>
            </div>
          </section>

          {/* Right Column: Detailed Bento Breakdown & Accordion (2/3 width) */}
          <section className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Action Checklist & Strengths */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-md flex flex-col justify-between">
                <h4 className="font-bold text-base text-secondary mb-4">Improvement Checklist</h4>
                <div className="space-y-3">
                  {checklist.length > 0 ? (
                    checklist.map(item => (
                      <label 
                        key={item.id}
                        className="flex items-start gap-3 cursor-pointer text-xs font-semibold select-none"
                      >
                        <input 
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleCheck(item.id)}
                          className="mt-0.5 accent-primary h-4.5 w-4.5 cursor-pointer rounded-md"
                        />
                        <span className={`${item.done ? 'line-through text-on-surface-variant/40' : 'text-on-surface'}`}>
                          {item.text}
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-on-surface-variant">No immediate improvements checklist generated. Good job!</p>
                  )}
                </div>
              </div>

              <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-md">
                <h4 className="font-bold text-base text-primary mb-4">Core Strengths</h4>
                <ul className="space-y-2 text-xs font-semibold text-on-surface-variant pl-4 list-disc">
                  {activeSession.answers.map((ans: any, idx: number) => (
                    ans.scores?.aiFeedbackJson?.topStrength ? (
                      <li key={ans.id}>{ans.scores.aiFeedbackJson.topStrength}</li>
                    ) : (
                      <li key={ans.id}>Clear response formatting in Question {idx + 1}.</li>
                    )
                  ))}
                </ul>
              </div>
            </div>

            {/* Question Breakdown Accordion */}
            <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-lg">
              <h3 className="font-black text-xl mb-6 text-on-surface">Question-by-Question Review</h3>
              
              <div className="space-y-4">
                {activeSession.answers.map((review: any, idx: number) => {
                  const isExpanded = expandedId === review.id;
                  const scoreObj = review.scores;
                  return (
                    <div 
                      key={review.id} 
                      className="border border-outline-variant rounded-xl overflow-hidden transition-all"
                    >
                      {/* Header */}
                      <button 
                        onClick={() => setExpandedId(isExpanded ? null : review.id)}
                        className="w-full text-left p-5 bg-surface-container flex justify-between items-center gap-4 hover:bg-surface-container-high transition-colors"
                      >
                        <div className="flex-grow">
                          <span className="text-[10px] font-bold text-primary uppercase">Question {idx + 1} Review</span>
                          <h4 className="font-bold text-sm text-on-surface mt-0.5 leading-snug">
                            {review.questionText}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="bg-secondary/20 text-secondary px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                            {scoreObj?.overallScore || 0}/100
                          </span>
                          <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-300">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="p-6 bg-surface space-y-6 divide-y divide-outline-variant">
                          {/* Transcript */}
                          <div className="space-y-2">
                            <h5 className="text-xs font-bold text-on-surface-variant uppercase">Your Response</h5>
                            <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap italic">
                              "{review.responseText}"
                            </p>
                          </div>

                          {/* STAR analysis */}
                          {scoreObj?.aiFeedbackJson?.star && (
                            <div className="pt-6 space-y-4">
                              <h5 className="text-xs font-bold text-secondary uppercase">STAR Analysis</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-3.5 bg-surface-container rounded-xl border border-outline-variant">
                                  <span className="text-[10px] font-black text-primary uppercase">Situation</span>
                                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{scoreObj.aiFeedbackJson.star.situation}</p>
                                </div>
                                <div className="p-3.5 bg-surface-container rounded-xl border border-outline-variant">
                                  <span className="text-[10px] font-black text-secondary uppercase">Task</span>
                                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{scoreObj.aiFeedbackJson.star.task}</p>
                                </div>
                                <div className="p-3.5 bg-surface-container rounded-xl border border-outline-variant">
                                  <span className="text-[10px] font-black text-tertiary uppercase">Action</span>
                                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{scoreObj.aiFeedbackJson.star.action}</p>
                                </div>
                                <div className="p-3.5 bg-surface-container rounded-xl border border-outline-variant">
                                  <span className="text-[10px] font-black text-primary uppercase">Result</span>
                                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{scoreObj.aiFeedbackJson.star.result}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Advice */}
                          {scoreObj?.aiFeedbackJson?.coachingAdvice && (
                            <div className="pt-6 flex gap-3.5 items-start bg-primary-container/10 p-4 rounded-xl border border-primary/20">
                              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
                              <div>
                                <h5 className="text-xs font-bold text-primary uppercase">Coaching Advice</h5>
                                <p className="text-xs text-on-surface mt-1 leading-relaxed font-medium">
                                  {scoreObj.aiFeedbackJson.coachingAdvice}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mt-4">
              <button 
                onClick={() => navigate('/session')}
                className="w-full sm:w-auto px-10 py-4 border-2 border-primary text-primary font-bold rounded-full bouncy hover:bg-primary/10 transition-colors text-sm"
              >
                Practice Again
              </button>
              <button 
                onClick={handleDownload}
                className="w-full sm:w-auto px-10 py-4 bg-primary text-white font-bold rounded-full bouncy shadow-md hover:brightness-110 transition-all text-sm"
              >
                Download PDF Review
              </button>
            </div>

          </section>
        </div>
      </main>

      {/* Mobile nav bar */}
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
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined">history</span>
          <span className="text-[10px] font-medium">History</span>
        </button>
      </nav>
    </div>
  );
};
