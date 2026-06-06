from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# --- Parse Resume Schemas ---
class ParseResumeRequest(BaseModel):
    resume_text: Optional[str] = None
    s3_key: Optional[str] = None

class ProjectItem(BaseModel):
    name: str
    tech_stack: List[str]
    description: str

class ExperienceItem(BaseModel):
    company: str
    role: str
    duration: str
    tech: List[str]

class EducationItem(BaseModel):
    degree: str
    institution: str
    year: str

class ParseResumeResponse(BaseModel):
    projects: List[ProjectItem] = []
    skills: List[str] = []
    experiences: List[ExperienceItem] = []
    education: List[EducationItem] = []

# --- Generate Question Schemas ---
class GenerateQuestionRequest(BaseModel):
    role: str
    interview_type: str
    experience_level: str
    resume_summary: Optional[str] = None
    previous_questions: List[str] = []
    chat_history: Optional[List[Dict[str, Any]]] = None

class GenerateQuestionResponse(BaseModel):
    brief_acknowledgment: str = ""  # AI interviewer's contextual reply to the candidate's last answer
    question_text: str
    question_type: str
    difficulty: str
    follow_up_hint: str

# --- Score Answer Schemas ---
class ScoreAnswerRequest(BaseModel):
    question: str
    answer: str
    role: str
    interview_type: str

class StarFeedback(BaseModel):
    situation: str
    task: str
    action: str
    result: str

class ScoreAnswerResponse(BaseModel):
    star_score: float
    tech_depth_score: float
    comm_score: float
    relevance_score: float
    confidence_score: float
    conciseness_score: float
    overall_score: float
    star_feedback: StarFeedback
    top_strength: str
    top_weakness: str
    filler_words: List[str]
    ideal_answer_skeleton: str

# --- Generate Streaming Feedback Schemas ---
class GenerateFeedbackRequest(BaseModel):
    score_json: Dict[str, Any]
    question: str
    role: str

# --- Report Summary Schemas ---
class ReportSummaryRequest(BaseModel):
    session_data: Dict[str, Any]

class ReportSummaryResponse(BaseModel):
    executive_summary: str
    action_plan: List[str]
    
# --- S3 key serving details ---
class LocalDownloadRequest(BaseModel):
    key: str
