import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../utils/api';
import type { Question } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

interface ChatMessage {
  sender: 'ai' | 'candidate' | 'acknowledgment';
  text: string;
  scores?: any;
}

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

  // Voice & UI States
  const [isVoiceMode, setIsVoiceMode] = useState(true); // Default to voice mode for wow effect
  const [isMuted, setIsMuted] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showChatLog, setShowChatLog] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentAcknowledgment, setCurrentAcknowledgment] = useState<string>('');
  
  // Visual state: 'idle' | 'speaking' | 'listening' | 'evaluating'
  const [aiState, setAiState] = useState<'idle' | 'speaking' | 'listening' | 'evaluating'>('idle');
  const [activeTab, setActiveTab] = useState<'scenario' | 'roles' | 'goals'>('scenario');

  // Timers and Refs
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Sync refs to avoid stale closures in speech recognition events
  const isListeningRef = useRef(false);
  const isVoiceActiveRef = useRef(isVoiceMode);
  const isMutedRef = useRef(isMuted);
  const currentQuestionRef = useRef(currentQuestion);
  const aiStateRef = useRef(aiState);

  useEffect(() => {
    isVoiceActiveRef.current = isVoiceMode;
  }, [isVoiceMode]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  useEffect(() => {
    aiStateRef.current = aiState;
  }, [aiState]);

  // Dynamic Metadata
  const interviewerName = "Nia";
  const interviewerTitle = "Senior Backend Architect at Telusko";
  const interviewerBio = "Nia has led multiple security-critical projects at Telusko. She prefers developers who understand not just how to implement solutions, but why they matter. She values clarity, scalability, and deep technical insight.";
  
  const goals = React.useMemo(() => {
    const roleGoals: Record<string, string[]> = {
      'Backend SDE': [
        "Explain how token-based authentication (JWT) works and why it is chosen over session cookies.",
        "Demonstrate understanding of database index profiling, query optimization, and latency debugging.",
        "Discuss cache invalidation strategies for high-frequency distributed systems.",
        "Formulate approaches to microservices architecture and service communication patterns.",
      ],
      'Frontend SDE': [
        "Explain React rendering lifecycle, hooks, and performance optimization techniques.",
        "Demonstrate understanding of browser rendering pipeline, layout, and paint phases.",
        "Discuss state management patterns (Redux, Zustand, Context API) and their trade-offs.",
        "Formulate responsive design approaches and cross-browser compatibility solutions.",
      ],
      'Full Stack SDE': [
        "Explain end-to-end application architecture from database to UI layer.",
        "Demonstrate understanding of REST vs GraphQL API design principles.",
        "Discuss database selection criteria (SQL vs NoSQL) and performance optimization.",
        "Formulate deployment strategies including CI/CD, containerization, and cloud scaling.",
      ],
      'ML Engineer': [
        "Explain model selection criteria, bias-variance tradeoff, and overfitting prevention.",
        "Demonstrate understanding of feature engineering and data preprocessing pipelines.",
        "Discuss model deployment approaches, inference optimization, and monitoring in production.",
        "Formulate evaluation metrics selection for different ML problem types.",
      ],
      'default': [
        "Explain how you approach problem-solving and technical decision-making.",
        "Demonstrate your understanding of software design principles and best practices.",
        "Discuss your experience with system design and scalability considerations.",
        "Formulate your approach to code quality, testing, and documentation.",
      ],
    };
    return roleGoals[role] || roleGoals['default'];
  }, [role]);

  const scenarioText = React.useMemo(() => {
    const typeLabel = interviewType === 'behavioural' ? 'behavioral competency' : 
                      interviewType === 'resume_based' ? 'resume-based deep-dive' : 'technical';
    return `You're interviewing for a ${role} role. This is a ${typeLabel} interview where Nia will ask specific questions about your experience, technical knowledge, and problem-solving approach. Be concise, use the STAR method for behavioral questions, and show deep technical understanding.`;
  }, [role, interviewType]);

  // Speech helper utilities
  const getBestVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.name.includes('Google UK English Female')) ||
      voices.find((v) => v.name.includes('Google') && v.lang.startsWith('en')) ||
      voices.find((v) => v.name.includes('Samantha')) ||
      voices.find((v) => v.lang === 'en-US' && !v.name.includes('Male')) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0]
    );
  };

  const speakUtterance = (text: string, rate = 1.0, onEnd?: () => void) => {
    if (!('speechSynthesis' in window) || !text.trim()) {
      onEnd?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getBestVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.onend = () => onEnd?.();
    utterance.onerror = (err) => {
      console.error('Speech error:', err);
      onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  };

  const startListeningAfterSpeech = () => {
    setAiState('listening');
    isListeningRef.current = true;
    if (isVoiceActiveRef.current && !isMutedRef.current && recognitionRef.current) {
      try {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        recognitionRef.current.start();
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  };

  const speakResponse = (questionText: string, acknowledgment?: string) => {
    if (!('speechSynthesis' in window)) {
      startListeningAfterSpeech();
      return;
    }
    window.speechSynthesis.cancel();
    setAiState('speaking');

    const speakQuestion = () => {
      speakUtterance(questionText, 1.0, startListeningAfterSpeech);
    };

    if (acknowledgment && acknowledgment.trim()) {
      speakUtterance(acknowledgment, 1.05, () => {
        setTimeout(speakQuestion, 350);
      });
    } else {
      speakQuestion();
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setAiState('listening');
        isListeningRef.current = true;
      };

      rec.onresult = (event: any) => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }

        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setResponseText((prev) => {
            const sep = prev.trim() === '' ? '' : ' ';
            return prev + sep + finalTranscript;
          });
        }

        if (isVoiceActiveRef.current && !isMutedRef.current) {
          silenceTimeoutRef.current = setTimeout(() => {
            handleVoiceAutoSubmit();
          }, 3000);
        }
      };

      rec.onerror = (err: any) => {
        console.error('Speech Recognition Error:', err);
      };

      rec.onend = () => {
        if (isVoiceActiveRef.current && !isMutedRef.current && isListeningRef.current) {
          try {
            rec.start();
          } catch (e) {
            // Already started
          }
        } else {
          setAiState((curr) => (curr === 'listening' ? 'idle' : curr));
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceMode, isMuted]);

  const handleVoiceAutoSubmit = () => {
    setResponseText((latestText) => {
      if (latestText.trim().length >= 10) {
        isListeningRef.current = false;
        recognitionRef.current?.stop();
        submitAnswerViaVoice(latestText);
      }
      return latestText;
    });
  };

  const submitAnswerViaVoice = async (text: string) => {
    if (!text.trim() || !currentQuestionRef.current || isSubmitting) return;
    setIsSubmitting(true);
    setAiState('evaluating');
    try {
      const res = await api.submitAnswer(sessionId, currentQuestionRef.current.id, text);
      setActiveScore(res.scores);
      setNextQuestionRef(res.nextQuestion);
      setShowFeedbackPanel(true);

      setChatHistory((prev) => [
        ...prev,
        { sender: 'candidate', text, scores: res.scores }
      ]);
    } catch (err) {
      console.error('Failed to submit answer via voice', err);
      setAiState('listening');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Speak when question loaded and in voice mode
  useEffect(() => {
    if (sessionStarted && currentQuestion && isVoiceMode) {
      const ack = currentQuestion.briefAcknowledgment;
      speakResponse(currentQuestion.questionText, ack);
    }
    return () => {
      window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, sessionStarted, isVoiceMode]);

  // Speak response if voice mode toggled ON mid-session
  useEffect(() => {
    if (sessionStarted && currentQuestion && isVoiceMode) {
      const ack = currentQuestion.briefAcknowledgment;
      speakResponse(currentQuestion.questionText, ack);
    } else if (!isVoiceMode) {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      setAiState('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceMode]);

  // Timer countdown effect
  useEffect(() => {
    if (!sessionStarted) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStarted]);

  // Auto scroll chat log
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

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

      // Init chat log
      const firstAck = res.firstQuestion?.briefAcknowledgment || '';
      const chatItems: ChatMessage[] = [];
      if (firstAck) {
        chatItems.push({ sender: 'acknowledgment', text: firstAck });
        setCurrentAcknowledgment(firstAck);
      }
      chatItems.push({ sender: 'ai', text: res.firstQuestion?.questionText || '' });
      setChatHistory(chatItems);
    } catch (err) {
      console.error('Failed to start session', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnalyzeAnswer = async () => {
    if (!responseText.trim() || !currentQuestion || isSubmitting) return;
    setIsSubmitting(true);
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis.cancel();
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    
    setAiState('evaluating');
    try {
      const res = await api.submitAnswer(sessionId, currentQuestion.id, responseText);
      setActiveScore(res.scores);
      setNextQuestionRef(res.nextQuestion);
      setShowFeedbackPanel(true);

      setChatHistory((prev) => [
        ...prev,
        { sender: 'candidate', text: responseText, scores: res.scores }
      ]);
    } catch (err) {
      console.error('Failed to analyze answer', err);
      setAiState('listening');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextOrFinish = async () => {
    if (nextQuestionRef) {
      const next = nextQuestionRef;
      setCurrentQuestion(next);
      setNextQuestionRef(null);
      setResponseText('');
      setActiveScore(null);
      setShowFeedbackPanel(false);
      setQuestionNumber(prev => prev + 1);

      const ack = next.briefAcknowledgment || '';
      const chatItems: ChatMessage[] = [];
      if (ack) {
        chatItems.push({ sender: 'acknowledgment', text: ack });
        setCurrentAcknowledgment(ack);
      } else {
        setCurrentAcknowledgment('');
      }
      chatItems.push({ sender: 'ai', text: next.questionText });
      
      setChatHistory((prev) => [
        ...prev,
        ...chatItems
      ]);
    } else {
      setIsSubmitting(true);
      try {
        isListeningRef.current = false;
        recognitionRef.current?.stop();
        window.speechSynthesis.cancel();
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

  // Dedicated force-end: always terminates the session regardless of nextQuestion state.
  // Fixes the bug where End Session button was silently no-op'd if nextQuestionRef was set.
  const handleForceEndSession = async () => {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis.cancel();
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    setIsSubmitting(true);
    try {
      if (sessionId) {
        await api.endSession(sessionId);
      }
      navigate(`/summary${sessionId ? `?sessionId=${sessionId}` : ''}`);
    } catch (err) {
      console.error('Force end session failed', err);
      navigate('/summary');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      setAiState('idle');
    } else if (aiState === 'idle' && sessionStarted) {
      try {
        isListeningRef.current = true;
        recognitionRef.current?.start();
        setAiState('listening');
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleManualSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (responseText.trim().length < 10 || isSubmitting) return;
    handleAnalyzeAnswer();
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
            <div className="flex items-center gap-3">
              {/* Voice Mode Toggle Switch */}
              <button 
                className={`px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  isVoiceMode ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                }`}
                onClick={() => setIsVoiceMode(!isVoiceMode)}
                title="Toggle Voice Mode vs Text Mode"
              >
                <span className="material-symbols-outlined text-xs">
                  {isVoiceMode ? 'record_voice_over' : 'keyboard'}
                </span>
                {isVoiceMode ? 'Voice Mode' : 'Text Mode'}
              </button>

              <div className="flex items-center gap-2 bg-surface-container px-4 py-2 rounded-full shadow-inner border border-outline-variant">
                <span className="material-symbols-outlined text-primary text-sm">schedule</span>
                <span className="font-bold text-sm tabular-nums text-on-surface">
                  {formatTime(timerSeconds)}
                </span>
              </div>
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

      {/* Setup Session screen */}
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
      ) : isVoiceMode ? (
        /* VOICE INTERVIEW INTERACTIVE LAYOUT (Wow Factor / Captions Overlay / Collapsible Panels) */
        <main className="pt-24 pb-20 md:pb-8 px-4 md:px-8 max-w-[1600px] mx-auto h-[calc(100vh-2rem)] flex gap-6 relative overflow-hidden">
          
          {/* Tab Sidebar (Left Panel, Scenario/Goals) - Hidden on mobile unless showTips is toggled, or always on MD screens */}
          <section className="w-80 border-r border-outline-variant bg-surface/30 backdrop-blur-md flex flex-col hidden lg:flex z-10 rounded-2xl overflow-hidden shadow-premium">
            <div className="flex border-b border-outline-variant">
              <button
                onClick={() => setActiveTab('scenario')}
                className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'scenario' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Scenario
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'roles' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Character
              </button>
              <button
                onClick={() => setActiveTab('goals')}
                className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'goals' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Goals
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {activeTab === 'scenario' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">info</span> Scenario Context
                  </h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed bg-surface-container/30 p-4 border border-outline-variant rounded-xl">
                    {scenarioText}
                  </p>
                </div>
              )}

              {activeTab === 'roles' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">person</span> Coach Profile
                  </h4>
                  <div className="bg-surface-container/30 p-4 border border-outline-variant rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <img
                        src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200&h=200"
                        alt={interviewerName}
                        className="h-10 w-10 rounded-full object-cover border border-primary/20"
                      />
                      <div>
                        <h5 className="text-xs font-bold text-on-surface">{interviewerName}</h5>
                        <p className="text-[10px] text-on-surface-variant">{interviewerTitle}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed border-t border-outline-variant pt-2.5">
                      {interviewerBio}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'goals' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">tour</span> Key Milestones
                  </h4>
                  <ul className="space-y-2.5 text-xs text-on-surface-variant">
                    {goals.map((goal, idx) => (
                      <li key={idx} className="flex gap-2.5 bg-surface-container/30 p-3 border border-outline-variant rounded-xl">
                        <span className="text-primary font-bold">{idx + 1}</span>
                        <span className="leading-relaxed">{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Center Stage: Circular Avatar, Breathing lights, Status Indicator, Captions overlay */}
          <section className="flex-1 flex flex-col justify-center items-center p-4 relative min-h-[50vh]">
            
            {/* Breathing color highlights */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-80 h-80 rounded-full blur-3xl transition-all duration-1000 ${
                aiState === 'speaking' ? 'scale-125 opacity-35 bg-primary/10' :
                aiState === 'listening' ? 'scale-110 opacity-30 bg-secondary/15' :
                aiState === 'evaluating' ? 'scale-110 opacity-30 bg-warning/15' : 'scale-100 opacity-10 bg-primary/5'
              }`} />
            </div>

            <div className="flex flex-col items-center space-y-6 text-center z-10">
              <div className="relative">
                <div className={`h-40 w-40 rounded-full p-1.5 transition-all duration-750 ${
                  aiState === 'speaking' ? 'bg-gradient-to-tr from-primary to-secondary shadow-[0_0_60px_rgba(77,159,255,0.4)] scale-105' :
                  aiState === 'listening' ? 'bg-gradient-to-tr from-secondary to-accent scale-102 shadow-[0_0_60px_rgba(0,245,255,0.3)]' : 
                  aiState === 'evaluating' ? 'bg-gradient-to-tr from-warning to-error scale-100 animate-pulse' : 'bg-outline-variant'
                }`}>
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250&h=250"
                    alt={interviewerName}
                    className="h-full w-full rounded-full object-cover border-4 border-surface"
                  />
                </div>
                {/* Ping waves when speaking */}
                {aiState === 'speaking' && (
                  <span className="absolute inset-0 h-full w-full rounded-full border border-primary animate-ping opacity-45 pointer-events-none" />
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-on-surface">{interviewerName}</h2>
                <p className="text-xs text-on-surface-variant mt-1 font-medium">{interviewerTitle}</p>
              </div>
            </div>

            {/* Closed Captions Overlay */}
            {showCaptions && (
              <div className="absolute bottom-24 max-w-2xl w-full px-4 z-10 animate-fade-in-up">
                <div className="bg-surface/90 backdrop-blur-md p-4 rounded-2xl border border-outline-variant shadow-premium text-center">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-1">
                    {aiState === 'speaking' ? 'Nia Speaking...' : aiState === 'listening' ? 'Listening (Speak now)' : aiState === 'evaluating' ? 'Evaluating answer...' : 'Live Transcripts'}
                  </span>
                  <p className="text-sm font-sans leading-relaxed text-on-surface">
                    {aiState === 'speaking' && (currentAcknowledgment
                      ? <span className="text-secondary italic">{currentAcknowledgment}</span>
                      : currentQuestion?.questionText
                    )}
                    {aiState === 'listening' && (responseText || <span className="text-on-surface-variant/40 italic">State your response...</span>)}
                    {aiState === 'evaluating' && <span className="text-warning animate-pulse">Analyzing your delivery and STAR framework...</span>}
                    {aiState === 'idle' && 'Ready to start'}
                  </p>
                </div>
              </div>
            )}

            {/* Floating Controls pill at the bottom */}
            <div className="absolute bottom-4 flex justify-center w-full z-20">
              <div className="bg-surface-container/90 backdrop-blur-md p-3.5 rounded-full border border-outline-variant flex items-center gap-6 shadow-premium">
                
                {/* Voice level mic status icon */}
                <div className="flex items-center gap-2 px-3 border-r border-outline-variant">
                  <div className="flex gap-0.5 items-center justify-center h-4 w-6">
                    {aiState === 'listening' && !isMuted ? (
                      <>
                        <span className="w-1 bg-secondary h-2.5 rounded animate-pulse" />
                        <span className="w-1 bg-secondary h-3.5 rounded animate-pulse delay-75" />
                        <span className="w-1 bg-secondary h-2 rounded animate-pulse delay-150" />
                      </>
                    ) : aiState === 'speaking' ? (
                      <>
                        <span className="w-1 bg-primary h-3.5 rounded animate-pulse" />
                        <span className="w-1 bg-primary h-1.5 rounded animate-pulse delay-75" />
                        <span className="w-1 bg-primary h-2.5 rounded animate-pulse delay-150" />
                      </>
                    ) : (
                      <>
                        <span className="w-0.5 bg-on-surface-variant/30 h-1.5 rounded" />
                        <span className="w-0.5 bg-on-surface-variant/30 h-1.5 rounded" />
                        <span className="w-0.5 bg-on-surface-variant/30 h-1.5 rounded" />
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleMuteToggle}
                    className={`p-2 rounded-full transition-all cursor-pointer ${
                      isMuted ? 'bg-error/20 text-error border border-error/30' : 'bg-surface hover:bg-surface-container-high text-on-surface'
                    }`}
                    title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                  >
                    <span className="material-symbols-outlined text-sm leading-none flex items-center justify-center">
                      {isMuted ? 'mic_off' : 'mic'}
                    </span>
                  </button>
                </div>

                {/* CC Button */}
                <button
                  onClick={() => setShowCaptions(!showCaptions)}
                  className={`p-2 rounded-full font-bold text-xs px-3.5 flex items-center gap-1.5 transition-all cursor-pointer ${
                    showCaptions ? 'bg-primary text-on-primary' : 'bg-surface hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                  title="Toggle captions"
                >
                  <span className="material-symbols-outlined text-sm">subtitles</span> CC
                </button>

                {/* Chat Log Toggle */}
                <button
                  onClick={() => setShowChatLog(!showChatLog)}
                  className={`p-2 rounded-full transition-all cursor-pointer ${
                    showChatLog ? 'bg-primary text-on-primary' : 'bg-surface hover:bg-surface-container-high text-on-surface'
                  }`}
                  title="Toggle chat transcript log"
                >
                  <span className="material-symbols-outlined text-sm leading-none flex items-center justify-center">chat</span>
                </button>

                {/* Red hangup phone (End early) */}
                <button
                  onClick={() => {
                    if (confirm('End this Telusko interview session? Your performance report will be compiled immediately.')) {
                      handleForceEndSession();
                    }
                  }}
                  disabled={isSubmitting}
                  className="p-3.5 bg-error hover:bg-error-container text-white rounded-full transition-all cursor-pointer shadow-lg shadow-error/25 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="End Session"
                >
                  <span className="material-symbols-outlined text-sm leading-none flex items-center justify-center font-bold">call_end</span>
                </button>

              </div>
            </div>

          </section>

          {/* Chat Transcript Panel (Right Side, collapsible) */}
          {showChatLog && (
            <section className="w-96 border-l border-outline-variant bg-surface/75 backdrop-blur-md flex flex-col z-20 rounded-2xl overflow-hidden shadow-premium animate-slide-in-right">
              <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container/60">
                <span className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">chat</span> Chat Transcript
                </span>
                <button
                  onClick={() => setShowChatLog(false)}
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              {/* Message scroll list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.sender === 'candidate'
                        ? 'max-w-[85%] ml-auto items-end'
                        : msg.sender === 'acknowledgment'
                        ? 'max-w-[95%] mr-auto items-start'
                        : 'max-w-[88%] mr-auto items-start'
                    }`}
                  >
                    <span className="text-[9px] text-on-surface-variant uppercase font-black tracking-wider mb-1 px-1">
                      {msg.sender === 'candidate' ? 'You' : interviewerName}
                    </span>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'candidate'
                        ? 'bg-primary text-on-primary rounded-tr-none'
                        : msg.sender === 'acknowledgment'
                        ? 'bg-success/10 border border-success/30 text-success italic rounded-tl-none'
                        : 'bg-surface-container border border-outline-variant text-on-surface rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                    {msg.scores && (
                      <div className="w-full mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[9px] font-bold text-on-surface-variant">
                        <span className="bg-surface p-1.5 rounded-lg border border-outline-variant">STAR: {msg.scores.starScore}</span>
                        <span className="bg-surface p-1.5 rounded-lg border border-outline-variant">Tech: {msg.scores.techDepthScore}</span>
                        <span className="bg-surface p-1.5 rounded-lg border border-outline-variant">Avg: {Math.round(msg.scores.overallScore)}%</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Text Input manual override fallback */}
              <form onSubmit={handleManualSubmitText} className="p-3 border-t border-outline-variant bg-surface-container/40 flex gap-2">
                <input
                  type="text"
                  disabled={aiState === 'evaluating' || aiState === 'speaking'}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder={aiState === 'listening' ? "Speak or type your response..." : "Coach is speaking..."}
                  className="flex-grow bg-surface border-2 border-outline-variant rounded-full px-4 py-2 text-xs focus:outline-none focus:border-primary text-on-surface"
                />
                <button
                  type="submit"
                  disabled={responseText.trim().length < 10 || aiState === 'evaluating'}
                  className="bg-primary text-on-primary p-2 rounded-full flex items-center justify-center cursor-pointer hover:brightness-110 disabled:opacity-45"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </form>
            </section>
          )}

        </main>
      ) : (
        /* TEXT-BASED standard INTERVIEW LAYOUT (Preserves friend's original code layout) */
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

              {/* STAR Tips Panel */}
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

export default SessionPage;
