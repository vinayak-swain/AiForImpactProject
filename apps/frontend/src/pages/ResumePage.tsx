import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

interface ParsedResume {
  id: string;
  fileName: string;
  uploadedAt: string;
  parsedJson: {
    skills?: string[];
    projects?: { name: string; description: string; tech_stack?: string[] }[];
    experiences?: { role: string; company: string; duration: string; tech?: string[] }[];
    education?: { degree: string; institution: string; year: string }[];
  };
}

export const ResumePage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing resume on mount
  React.useEffect(() => {
    const loadResume = async () => {
      setIsLoading(true);
      try {
        const data = await (api as any).getResume?.();
        setResume(data);
      } catch {
        setResume(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadResume();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadError(null);
      setUploadSuccess(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.type === 'text/plain')) {
      setFile(droppedFile);
      setUploadError(null);
    } else {
      setUploadError('Only PDF or plain text (.txt) files are supported.');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await (api as any).uploadResume?.(formData);
      setResume(result);
      setFile(null);
      setUploadSuccess(true);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!resume) return;
    if (!confirm('Delete your resume? This will clear resume-based interview personalization.')) return;

    setIsDeleting(true);
    try {
      await (api as any).deleteResume?.(resume.id);
      setResume(null);
    } catch {
      // silently fail
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`${isDark ? 'theme-celestial' : 'theme-celestial-light'} bg-background text-on-surface min-h-screen font-body relative overflow-x-hidden`}>
      <ParticleBackground theme="login" />

      {/* Top Nav */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-on-surface/10 shadow-sm">
        <div className="flex justify-between items-center h-16 px-6 md:px-10 max-w-7xl mx-auto">
          <div className="flex items-center gap-6">
            <span
              onClick={() => navigate('/dashboard')}
              className="font-headline text-xl font-bold text-on-surface tracking-tighter cursor-pointer hover:text-primary transition-colors"
            >
              TechPrep AI
            </span>
            <div className="hidden md:flex items-center gap-5 text-sm">
              <button onClick={() => navigate('/dashboard')} className="font-label text-on-surface-variant hover:text-on-surface transition-colors">Dashboard</button>
              <button onClick={() => navigate('/session')} className="font-label text-on-surface-variant hover:text-on-surface transition-colors">Practice</button>
              <button onClick={() => navigate('/history')} className="font-label text-on-surface-variant hover:text-on-surface transition-colors">History</button>
              <button className="font-label text-sm text-secondary font-bold border-b-2 border-secondary">Resume</button>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined text-lg">{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 md:px-10 pt-28 pb-24">

        {/* Page Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
            <span className="font-label text-xs text-accent uppercase tracking-widest">AI-Powered</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-black text-on-surface mb-2">Resume Intelligence</h1>
          <p className="font-body text-on-surface-variant text-base max-w-xl">
            Upload your resume and let Gemini AI extract your skills, projects, and experience to craft personalized interview questions just for you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* Upload Panel */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-surface border border-outline/20 rounded-2xl p-6 shadow-lg">
              <h2 className="font-headline text-lg font-bold text-on-surface mb-1">Upload Resume</h2>
              <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                PDF or plain text format. Gemini AI will parse skills, projects, work history, and education.
              </p>

              {/* Error Banner */}
              {uploadError && (
                <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/30 rounded-xl mb-4 text-xs text-error">
                  <span className="material-symbols-outlined text-sm mt-0.5">error</span>
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Success Banner */}
              {uploadSuccess && (
                <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/30 rounded-xl mb-4 text-xs text-success">
                  <span className="material-symbols-outlined text-sm mt-0.5">check_circle</span>
                  <span>Resume parsed successfully! Your interviews are now personalized.</span>
                </div>
              )}

              <form onSubmit={handleUpload}>
                {/* Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 mb-5 ${
                    isDragging
                      ? 'border-accent bg-accent/5 scale-[1.02]'
                      : file
                      ? 'border-primary bg-primary/5'
                      : 'border-outline/40 hover:border-accent/50 hover:bg-surface-container'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span className={`material-symbols-outlined text-4xl ${file ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                    {file ? 'description' : 'upload_file'}
                  </span>
                  {file ? (
                    <div className="text-center">
                      <p className="text-sm font-bold text-primary">{file.name}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{(file.size / 1024).toFixed(1)} KB — Ready to upload</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-on-surface">Drop your resume here</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">or click to browse — PDF / TXT, max 5MB</p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!file || isUploading}
                  className="w-full bg-primary text-on-primary font-label font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 shadow-md"
                >
                  {isUploading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                      AI Parsing Resume...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      Upload &amp; Parse
                    </>
                  )}
                </button>
              </form>

              {/* Active resume status */}
              {resume && !isLoading && (
                <div className="mt-5 pt-5 border-t border-outline/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-success text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Active Resume Loaded
                  </div>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-xs text-on-surface-variant hover:text-error transition-colors flex items-center gap-1 font-semibold"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    {isDeleting ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="bg-surface border border-outline/20 rounded-2xl p-6">
              <h3 className="font-headline text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-base">info</span>
                How It Works
              </h3>
              <ol className="space-y-3">
                {[
                  { icon: 'upload_file', text: 'Upload your PDF or text resume' },
                  { icon: 'auto_awesome', text: 'Gemini AI extracts skills, projects & experience' },
                  { icon: 'quiz', text: 'Interview questions tailored to your background' },
                  { icon: 'trending_up', text: 'Get scored on how well you explain your own work' },
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs text-on-surface-variant">
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-xs text-primary">{step.icon}</span>
                    </div>
                    <span>{step.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Parsed Output Panel */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="bg-surface border border-outline/20 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 h-64">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-on-surface-variant">Loading your resume data...</p>
              </div>
            ) : resume ? (
              <div className="bg-surface border border-outline/20 rounded-2xl p-6 shadow-lg space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary">auto_awesome</span>
                      Parsed Profile
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {resume.fileName} · Uploaded {new Date(resume.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-success text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                    Active
                  </div>
                </div>

                {/* Skills */}
                {resume.parsedJson.skills && resume.parsedJson.skills.length > 0 && (
                  <div>
                    <h3 className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-primary">stars</span>
                      Core Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {resume.parsedJson.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects */}
                {resume.parsedJson.projects && resume.parsedJson.projects.length > 0 && (
                  <div>
                    <h3 className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-secondary">folder_code</span>
                      Projects
                    </h3>
                    <div className="space-y-3">
                      {resume.parsedJson.projects.map((proj, idx) => (
                        <div key={idx} className="bg-surface-container rounded-xl p-4 border border-outline/10">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h4 className="text-sm font-bold text-on-surface">{proj.name}</h4>
                            <div className="flex flex-wrap gap-1 justify-end">
                              {proj.tech_stack?.slice(0, 3).map((tech, i) => (
                                <span key={i} className="bg-surface text-on-surface-variant border border-outline/20 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-on-surface-variant leading-relaxed">{proj.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience */}
                {resume.parsedJson.experiences && resume.parsedJson.experiences.length > 0 && (
                  <div>
                    <h3 className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-accent">work_history</span>
                      Work Experience
                    </h3>
                    <div className="space-y-3">
                      {resume.parsedJson.experiences.map((exp, idx) => (
                        <div key={idx} className="flex items-start gap-3 pl-4 border-l-2 border-primary/30">
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-on-surface">{exp.role}</h4>
                              <span className="text-xs text-on-surface-variant font-semibold">{exp.duration}</span>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-0.5">{exp.company}</p>
                            {exp.tech && exp.tech.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {exp.tech.map((t, i) => (
                                  <span key={i} className="bg-accent/10 text-accent border border-accent/20 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {resume.parsedJson.education && resume.parsedJson.education.length > 0 && (
                  <div>
                    <h3 className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-tertiary">school</span>
                      Education
                    </h3>
                    <div className="space-y-2">
                      {resume.parsedJson.education.map((edu, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-bold text-on-surface">{edu.degree}</p>
                            <p className="text-xs text-on-surface-variant">{edu.institution}</p>
                          </div>
                          <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full border border-outline/20">
                            {edu.year}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="pt-4 border-t border-outline/20">
                  <button
                    onClick={() => navigate('/session')}
                    className="w-full bg-accent text-on-accent font-label font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-md"
                  >
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                    Start Resume-Based Interview
                  </button>
                </div>
              </div>
            ) : (
              /* Empty state */
              <div className="bg-surface border border-outline/20 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 text-center h-80">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-primary/50">description</span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-on-surface mb-1">No Resume Yet</h3>
                  <p className="text-sm text-on-surface-variant max-w-xs">
                    Upload your resume on the left to unlock AI-personalized interview questions based on your real experience.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {['Python', 'React', 'Node.js', 'PostgreSQL', 'Docker'].map(s => (
                    <span key={s} className="bg-surface-container border border-outline/20 text-on-surface-variant text-xs px-3 py-1 rounded-full font-semibold opacity-40">
                      {s}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-on-surface-variant/50">Your skills will appear here once parsed</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
