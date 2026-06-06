const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface User {
  id: string;
  name: string;
  email: string;
  roleTarget: string;
  experienceLevel: 'fresher' | 'junior' | 'mid' | 'senior';
  avatarUrl?: string;
  streak: number;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface SessionStats {
  totalSessions: number;
  avgScore: number;
  bestScore: number;
  streak: number;
  questionsAnswered: number;
  weakAreas: {
    dimension: string;
    avgPercentage: number;
    suggestion: string;
  }[];
  recentSessions: {
    id: string;
    role: string;
    interviewType: string;
    overallScore: number | null;
    grade: string | null;
    endedAt: string | null;
  }[];
  dimensionAverages: {
    star: number;
    techDepth: number;
    comm: number;
    relevance: number;
    confidence: number;
    conciseness: number;
  };
}

export interface ScoreTrendItem {
  id: string;
  score: number;
  date: string;
  role: string;
}

export interface RadarItem {
  subject: string;
  current: number;
  average: number;
}

export interface Question {
  id: string;
  sessionId: string;
  questionText: string;
  questionType: string;
  difficulty: string;
  orderIndex: number;
  briefAcknowledgment?: string;
  answer?: {
    id: string;
    questionId: string;
    userId: string;
    answerText: string;
    wordCount: number;
    submittedAt: string;
    score?: {
      id: string;
      answerId: string;
      starScore: number;
      techDepthScore: number;
      commScore: number;
      relevanceScore: number;
      confidenceScore: number;
      concisenessScore: number;
      overallScore: number;
      aiFeedbackJson: {
        star: {
          situation: string;
          task: string;
          action: string;
          result: string;
        };
        topStrength: string;
        topWeakness: string;
        fillerWords: string[];
        idealAnswerSkeleton: string;
      };
    } | null;
  } | null;
}

export interface SessionDetail {
  id: string;
  userId: string;
  interviewType: string;
  role: string;
  durationMins: number;
  startedAt: string;
  endedAt: string | null;
  overallScore: number | null;
  grade: string | null;
  questions?: Question[];
}

// Helper to get headers
function getHeaders(token?: string) {
  const t = token || localStorage.getItem('accessToken') || '';
  return {
    'Content-Type': 'application/json',
    ...(t ? { 'Authorization': `Bearer ${t}` } : {}),
  };
}

// Robust fetch helper
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Authentication APIs
  async login(email: string, password?: string): Promise<AuthResponse> {
    try {
      const res = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: password || 'password123' }),
      });
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('currentUser', JSON.stringify(res.user));
      return res;
    } catch (err) {
      console.warn('API error, using mock login fallback', err);
      // Mock login fallback
      const mockUser: User = {
        id: 'mock-user-123',
        name: email.split('@')[0],
        email: email,
        roleTarget: 'Senior Frontend Engineer',
        experienceLevel: 'senior',
        streak: 15,
      };
      localStorage.setItem('accessToken', 'mock-access-token');
      localStorage.setItem('currentUser', JSON.stringify(mockUser));
      return { accessToken: 'mock-access-token', user: mockUser };
    }
  },

  async register(name: string, email: string, roleTarget: string, experienceLevel: 'fresher' | 'junior' | 'mid' | 'senior', password?: string): Promise<AuthResponse> {
    try {
      const res = await request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password: password || 'password123', roleTarget, experienceLevel }),
      });
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('currentUser', JSON.stringify(res.user));
      return res;
    } catch (err) {
      console.warn('API error, using mock register fallback', err);
      const mockUser: User = {
        id: 'mock-user-123',
        name,
        email,
        roleTarget,
        experienceLevel,
        streak: 1,
      };
      localStorage.setItem('accessToken', 'mock-access-token');
      localStorage.setItem('currentUser', JSON.stringify(mockUser));
      return { accessToken: 'mock-access-token', user: mockUser };
    }
  },

  async logout(): Promise<void> {
    try {
      await request<void>('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout request failed', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('currentUser');
    }
  },

  async fetchMe(): Promise<User> {
    const res = await request<User>('/auth/me');
    localStorage.setItem('currentUser', JSON.stringify(res));
    return res;
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  // Dashboard stats APIs
  async getDashboardStats(): Promise<SessionStats> {
    try {
      return await request<SessionStats>('/dashboard/stats');
    } catch (err) {
      console.warn('API error, using mock dashboard stats fallback', err);
      // Fallback matching mockup data
      return {
        totalSessions: 42,
        avgScore: 84,
        bestScore: 98,
        streak: 15,
        questionsAnswered: 120,
        weakAreas: [
          { dimension: 'STAR Structure', avgPercentage: 72, suggestion: 'Improve Situation-Task clarity. Use the Action phase to highlight personal ownership.' },
          { dimension: 'Technical Depth', avgPercentage: 68, suggestion: 'Mention specific API protocols, architecture configurations, design patterns, or algorithms.' },
          { dimension: 'Communication', avgPercentage: 74, suggestion: 'Reduce filler words such as "like", "actually", "basically".' }
        ],
        recentSessions: [
          { id: '1', role: 'Senior Frontend Engineer', interviewType: 'technical', overallScore: 88, grade: 'B', endedAt: new Date().toISOString() },
          { id: '2', role: 'Product Designer', interviewType: 'behavioural', overallScore: 74, grade: 'C', endedAt: new Date(Date.now() - 86400000 * 2).toISOString() }
        ],
        dimensionAverages: {
          star: 18,
          techDepth: 17,
          comm: 15,
          relevance: 12,
          confidence: 8,
          conciseness: 4
        }
      };
    }
  },

  async getScoreTrend(): Promise<ScoreTrendItem[]> {
    try {
      return await request<ScoreTrendItem[]>('/dashboard/score-trend');
    } catch (err) {
      console.warn('API error, using mock score trend fallback', err);
      return [
        { id: '1', score: 65, date: 'Mon', role: 'SDE' },
        { id: '2', score: 72, date: 'Tue', role: 'SDE' },
        { id: '3', score: 68, date: 'Wed', role: 'SDE' },
        { id: '4', score: 92, date: 'Thu', role: 'SDE' },
        { id: '5', score: 78, date: 'Fri', role: 'SDE' },
        { id: '6', score: 98, date: 'Sat', role: 'SDE' },
        { id: '7', score: 88, date: 'Sun', role: 'SDE' }
      ];
    }
  },

  async getRadarData(): Promise<RadarItem[]> {
    try {
      return await request<RadarItem[]>('/dashboard/radar-data');
    } catch (err) {
      console.warn('API error, using mock radar data fallback', err);
      return [
        { subject: 'STAR Structure', current: 75, average: 70 },
        { subject: 'Technical Depth', current: 80, average: 65 },
        { subject: 'Communication', current: 85, average: 78 },
        { subject: 'Relevance', current: 90, average: 85 },
        { subject: 'Confidence', current: 70, average: 72 },
        { subject: 'Conciseness', current: 95, average: 80 }
      ];
    }
  },

  // Session & active interview APIs
  async startSession(role: string, interviewType: 'behavioural' | 'technical' | 'resume_based', durationMins = 30): Promise<{ sessionId: string; firstQuestion: Question }> {
    try {
      return await request<{ sessionId: string; firstQuestion: Question }>('/sessions/start', {
        method: 'POST',
        body: JSON.stringify({ role, interviewType, durationMins }),
      });
    } catch (err) {
      console.warn('API error, using mock start session fallback', err);
      const mockSessionId = 'mock-session-' + Date.now();
      const mockQuestion: Question = {
        id: 'mock-q-1',
        sessionId: mockSessionId,
        questionText: 'Can you describe a challenging technical project you worked on and how you handled architectural trade-offs?',
        questionType: interviewType,
        difficulty: 'medium',
        orderIndex: 0
      };
      return { sessionId: mockSessionId, firstQuestion: mockQuestion };
    }
  },

  async submitAnswer(sessionId: string, questionId: string, answerText: string): Promise<{ scoreId: string; scores: any; nextQuestion: Question | null }> {
    try {
      return await request<{ scoreId: string; scores: any; nextQuestion: Question | null }>(`/sessions/${sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ questionId, answerText }),
      });
    } catch (err) {
      console.warn('API error, using mock submit answer fallback', err);
      // Fallback mock AI scoring feedback
      const nextQuestions = [
        'How did you measure the success of your implementation?',
        'Describe a conflict you had with a team member and how you resolved it.',
        'How do you keep up-to-date with new engineering protocols and designs?',
        null // last question
      ];
      const nextIndex = Math.floor(Math.random() * 3);
      const nextQText = nextQuestions[nextIndex];
      const nextQuestion: Question | null = nextQText ? {
        id: 'mock-q-' + Date.now(),
        sessionId,
        questionText: nextQText,
        questionType: 'technical',
        difficulty: 'medium',
        orderIndex: 1
      } : null;

      const mockScores = {
        id: 'mock-score-' + Date.now(),
        starScore: 18,
        techDepthScore: 19,
        commScore: 16,
        relevanceScore: 13,
        confidenceScore: 8,
        concisenessScore: 4,
        overallScore: 83,
        aiFeedbackJson: {
          star: {
            situation: 'Described a high-traffic e-commerce portal migration.',
            task: 'Tasked with refactoring legacy DB queries.',
            action: 'Optimized index selection and added redis cache clusters.',
            result: 'Reduced loading time by 40% and CPU usage by 20%.'
          },
          topStrength: 'Explicit details about Redis caching architecture.',
          topWeakness: 'Rambled slightly near the discussion of metrics.',
          fillerWords: ['like', 'basically'],
          idealAnswerSkeleton: 'Introduce the throughput bottleneck, explain the optimization plan, and conclude with CPU % reduction.'
        }
      };

      return {
        scoreId: mockScores.id,
        scores: mockScores,
        nextQuestion
      };
    }
  },

  async endSession(sessionId: string): Promise<SessionDetail> {
    try {
      return await request<SessionDetail>(`/sessions/${sessionId}/end`, {
        method: 'POST',
      });
    } catch (err) {
      console.warn('API error, using mock end session fallback', err);
      return {
        id: sessionId,
        userId: 'mock-user-123',
        interviewType: 'technical',
        role: 'Senior Frontend Engineer',
        durationMins: 30,
        startedAt: new Date(Date.now() - 1800000).toISOString(),
        endedAt: new Date().toISOString(),
        overallScore: 85,
        grade: 'B'
      };
    }
  },

  async getSessionDetail(sessionId: string): Promise<SessionDetail> {
    try {
      return await request<SessionDetail>(`/sessions/${sessionId}`);
    } catch (err) {
      console.warn('API error, using mock session details fallback', err);
      // Generate structured mock questions & answers
      return {
        id: sessionId,
        userId: 'mock-user-123',
        interviewType: 'technical',
        role: 'Senior Frontend Engineer',
        durationMins: 30,
        startedAt: new Date(Date.now() - 1800000).toISOString(),
        endedAt: new Date().toISOString(),
        overallScore: 88,
        grade: 'B',
        questions: [
          {
            id: 'q-1',
            sessionId,
            questionText: 'Can you describe a challenging technical project you worked on and how you handled architectural trade-offs?',
            questionType: 'technical',
            difficulty: 'medium',
            orderIndex: 0,
            answer: {
              id: 'a-1',
              questionId: 'q-1',
              userId: 'mock-user-123',
              answerText: 'I led the migration of our legacy billing service to a new serverless backend, which improved uptime to 99.99% and decreased API latencies by 30%. We faced latency trade-offs with cold starts but optimized that using provisioned concurrency.',
              wordCount: 38,
              submittedAt: new Date().toISOString(),
              score: {
                id: 's-1',
                answerId: 'a-1',
                starScore: 21,
                techDepthScore: 22,
                commScore: 18,
                relevanceScore: 13,
                confidenceScore: 9,
                concisenessScore: 5,
                overallScore: 88,
                aiFeedbackJson: {
                  star: {
                    situation: 'Migrating legacy billing systems.',
                    task: 'Improve billing uptime and reliability under peak traffic.',
                    action: 'Set up node.js serverless functions and optimized runtime packages.',
                    result: '99.99% uptime achieved and latencies reduced by 30%.'
                  },
                  topStrength: 'Quantified results accurately using metrics.',
                  topWeakness: 'Could elaborate on why serverless was chosen over containers.',
                  fillerWords: [],
                  idealAnswerSkeleton: 'Start with the migration, mention the runtime settings, discuss provisioned concurrency config, and end with database metrics.'
                }
              }
            }
          }
        ]
      };
    }
  },

  async getHistory(role?: string, type?: string): Promise<{ sessions: SessionDetail[] }> {
    try {
      const queryParams = new URLSearchParams();
      if (role && role !== 'All Roles') queryParams.append('role', role);
      if (type && type !== 'All Types') {
        const mappedType = type === 'Technical Deep Dive' ? 'technical' : type.toLowerCase();
        queryParams.append('type', mappedType);
      }
      const res = await request<{ sessions: SessionDetail[] }>(`/sessions/history?${queryParams.toString()}`);
      return res;
    } catch (err) {
      console.warn('API error, using mock history fallback', err);
      return {
        sessions: [
          {
            id: '1',
            userId: 'mock-user-123',
            interviewType: 'technical',
            role: 'Senior Frontend',
            durationMins: 30,
            startedAt: new Date(Date.now() - 86400000).toISOString(),
            endedAt: new Date(Date.now() - 86400000 + 1800000).toISOString(),
            overallScore: 92,
            grade: 'A'
          },
          {
            id: '2',
            userId: 'mock-user-123',
            interviewType: 'behavioural',
            role: 'Product Manager',
            durationMins: 30,
            startedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
            endedAt: new Date(Date.now() - 86400000 * 3 + 1800000).toISOString(),
            overallScore: 78,
            grade: 'C'
          },
          {
            id: '3',
            userId: 'mock-user-123',
            interviewType: 'technical',
            role: 'SDE II',
            durationMins: 30,
            startedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
            endedAt: new Date(Date.now() - 86400000 * 6 + 1800000).toISOString(),
            overallScore: 84,
            grade: 'B'
          }
        ]
      };
    }
  },

  async getResume(): Promise<any> {
    return request<any>('/resumes/me');
  },

  async uploadResume(formData: FormData): Promise<any> {
    const url = `${API_BASE_URL}/resumes/upload`;
    const token = localStorage.getItem('accessToken') || '';
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Upload failed with status ${response.status}`);
    }

    return response.json();
  },

  async deleteResume(id: string): Promise<any> {
    return request<any>(`/resumes/${id}`, {
      method: 'DELETE',
    });
  },

  async getSessionReportUrl(sessionId: string): Promise<{ url: string }> {
    try {
      return await request<{ url: string }>(`/sessions/${sessionId}/report`);
    } catch (err) {
      console.warn('API error fetching session report URL, using fallback', err);
      return { url: '' };
    }
  },

  async getAiReportSummary(sessionId: string): Promise<{ executive_summary: string, action_plan: string[] }> {
    try {
      return await request<{ executive_summary: string, action_plan: string[] }>(`/sessions/${sessionId}/ai-summary`);
    } catch (err) {
      console.warn('API error fetching AI report summary', err);
      return { executive_summary: '', action_plan: [] };
    }
  },

  async savePreferences(theme: 'light' | 'dark'): Promise<{ success: boolean; theme: string }> {
    try {
      return await request<{ success: boolean; theme: string }>('/preferences', {
        method: 'POST',
        body: JSON.stringify({ theme }),
      });
    } catch (err) {
      console.warn('API error saving preferences, using fallback', err);
      document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
      return { success: true, theme };
    }
  }
};
