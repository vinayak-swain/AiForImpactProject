import asyncio
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models.schemas import (
    ParseResumeRequest, ParseResumeResponse,
    GenerateQuestionRequest, GenerateQuestionResponse,
    ScoreAnswerRequest, ScoreAnswerResponse,
    GenerateFeedbackRequest, ReportSummaryRequest, ReportSummaryResponse
)
from services.gemini_client import run_gemini_json, get_model, is_mock
from services.parser import get_file_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai")

@router.post("/parse-resume", response_model=ParseResumeResponse)
async def parse_resume(request: ParseResumeRequest):
    resume_text = request.resume_text
    
    if request.s3_key:
        try:
            resume_text = get_file_text(request.s3_key)
        except Exception as e:
            logger.error(f"Error reading file from storage: {e}")
            # Continue to mock parser if reading failed
            
    if not resume_text:
        raise HTTPException(status_code=400, detail="Either resume_text or s3_key must be provided")

    prompt = f"""
You are a resume parser. Extract structured data from the resume below.
Return ONLY valid JSON, no markdown, no explanation.

Schema:
{{
  "projects": [{{ "name": str, "tech_stack": [str], "description": str }}],
  "skills": [str],
  "experiences": [{{ "company": str, "role": str, "duration": str, "tech": [str] }}],
  "education": [{{ "degree": str, "institution": str, "year": str }}]
}}

Resume:
{resume_text}
"""
    try:
        parsed_data = run_gemini_json(
            prompt, 
            generation_config={"temperature": 0.0, "response_mime_type": "application/json"}
        )
        return parsed_data
    except Exception as e:
        logger.error(f"Error parsing resume: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse resume: {str(e)}")

@router.post("/generate-question", response_model=GenerateQuestionResponse)
async def generate_question(request: GenerateQuestionRequest):
    resume_ctx = f"Resume Context:\n{request.resume_summary}" if request.resume_summary else "No resume provided."
    prev_questions_ctx = f"Previously asked questions:\n{', '.join(request.previous_questions)}" if request.previous_questions else "None."

    chat_history_str = ""
    if request.chat_history:
        for idx, turn in enumerate(request.chat_history):
            q_text = turn.get("question", "")
            a_text = turn.get("answer", "")
            chat_history_str += f"Question {idx+1}: {q_text}\nCandidate Answer {idx+1}: {a_text}\n\n"

    prompt = f"""
You are a senior technical interviewer at a top tech company hiring for: {request.role}
Experience level: {request.experience_level}
Interview type: {request.interview_type}

Resume context (use this to personalise the question):
{resume_ctx}

Conversation history of questions asked and the candidate's answers:
{chat_history_str if chat_history_str else "None yet. This is the start of the interview."}

Previously asked questions (do not repeat):
{prev_questions_ctx}

Generate ONE interview question.
- If the candidate's last answer was vague or lacked depth, ask a direct follow-up question to probe further on their reply (e.g. asking them to detail the technology choice, or quantify STAR metrics).
- Otherwise, ask a new role-specific question relevant to their target domain.
- For behavioural: use STAR-prompting language.
- For technical: test real applied knowledge, not just definitions.

Return ONLY valid JSON:
{{
  "question_text": str,
  "question_type": "behavioural" | "technical" | "resume_based",
  "difficulty": "easy" | "medium" | "hard",
  "follow_up_hint": str  // what to probe if answer is vague
}}
"""
    try:
        question_data = run_gemini_json(
            prompt,
            generation_config={"temperature": 0.7, "response_mime_type": "application/json"}
        )
        return question_data
    except Exception as e:
        logger.error(f"Error generating question: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate question")

@router.post("/score-answer", response_model=ScoreAnswerResponse)
async def score_answer(request: ScoreAnswerRequest):
    prompt = f"""
You are an expert interview evaluator for tech roles.
Role being interviewed for: {request.role}
Question asked: {request.question}
Candidate's answer: {request.answer}

Score the answer on these dimensions and return ONLY valid JSON.
Be strict but fair. Justify every score in one sentence.

Scoring rubric:
- star_score (0-25): STAR structure quality. 
    Situation(20%) Task(20%) Action(40%) Result(20%)
    Penalise heavily if Action is vague or uses "we" instead of "I".
- tech_depth_score (0-25): Correct use of relevant technologies, 
    patterns, algorithms. Zero if no technical content.
- comm_score (0-20): Clarity, grammar, structure, no filler words.
- relevance_score (0-15): Directly answers the question asked.
- confidence_score (0-10): Assertive language, first-person ownership.
    Penalise excessive hedging ("I think maybe", "kind of").
- conciseness_score (0-5): 
    0 if under 40 words, 5 if 100-400 words, 3 if 400-600, 1 if over 600.

Return:
{{
  "star_score": float,
  "tech_depth_score": float,
  "comm_score": float,
  "relevance_score": float,
  "confidence_score": float,
  "conciseness_score": float,
  "overall_score": float,  // sum of all above
  "star_feedback": {{
    "situation": str,  // 1-sentence feedback
    "task": str,
    "action": str,
    "result": str
  }},
  "top_strength": str,     // 1 sentence, specific
  "top_weakness": str,     // 1 sentence, specific and actionable
  "filler_words": [str],   // list of overused words found
  "ideal_answer_skeleton": str  // 2-3 sentence structure guide, not full answer
}}
"""
    try:
        score_data = run_gemini_json(
            prompt,
            generation_config={"temperature": 0.0, "response_mime_type": "application/json"}
        )
        return score_data
    except Exception as e:
        logger.error(f"Error scoring answer: {e}")
        raise HTTPException(status_code=500, detail="Failed to score answer")

@router.post("/generate-feedback")
async def generate_feedback(request: GenerateFeedbackRequest):
    prompt = f"""
You are a supportive but honest interview coach for tech roles.
Role: {request.role}
Question: {request.question}
Score summary: {request.score_json}

Write coaching feedback in this exact format:

STRENGTH:
[One specific sentence about the best part of their answer]

WEAKNESS:
[One specific, actionable improvement — not generic. 
Name exactly what was missing or weak.]

STAR_GAPS:
[For any STAR component scored below 15/25, write one sentence 
on how to improve it specifically]

FILLER_WORDS:
[If filler words found, name them and suggest alternatives]

NEXT_TIME:
[One concrete tip for the next answer — role-specific]

Keep total response under 150 words. Tone: direct coach, not harsh critic.
"""
    
    async def event_generator():
        model = get_model()
        if is_mock or not model:
            # Simulate streaming
            mock_paragraphs = [
                "STRENGTH:\nYour action description clearly outlines how you optimized the React render cycles.\n\n",
                "WEAKNESS:\nHowever, your answer lacked details on how you profiled the bottleneck (e.g. using Chrome DevTools).\n\n",
                "STAR_GAPS:\nFor the Task phase, clarify why decreasing bundle sizes was critical for SEO rankings.\n\n",
                "FILLER_WORDS:\nYou overused 'actually' and 'kind of'. Try substituting with definitive metrics.\n\n",
                "NEXT_TIME:\nIn your next response, explain how code-splitting improved load speeds from 3s to under 1s.\n\n"
            ]
            for phrase in mock_paragraphs:
                for char in phrase:
                    yield f"data: {char}\n\n"
                    await asyncio.sleep(0.01)
                await asyncio.sleep(0.2)
            return

        try:
            # Async streaming using Gemini API
            # For fastapi to stream SSE, we yield "data: <chunk>\n\n"
            # gemini-1.5-pro supports stream=True
            loop = asyncio.get_event_loop()
            
            # Run generator in a thread pool since SDK call may block, or use async model wrapper if available
            response = model.generate_content(prompt, stream=True)
            for chunk in response:
                yield f"data: {chunk.text}\n\n"
                await asyncio.sleep(0.02)
        except Exception as e:
            logger.error(f"Error in Gemini feedback streaming: {e}")
            yield f"data: Error generating live feedback stream: {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/report-summary", response_model=ReportSummaryResponse)
async def report_summary(request: ReportSummaryRequest):
    sd = request.session_data
    prompt = f"""
You are writing a post-interview performance report for a tech candidate.

Role: {sd.get('role')}
Interview type: {sd.get('interview_type')}
Overall score: {sd.get('overall_score')}/100
Dimension averages: {sd.get('dimension_averages')}
Number of questions: {len(sd.get('questions_and_scores', []))}

Write:
1. executive_summary: 3 sentences. Sentence 1: overall performance verdict.
   Sentence 2: biggest strength with specific evidence. 
   Sentence 3: most critical area to improve.

2. action_plan: exactly 5 items. Each is one specific, role-relevant 
   action the candidate should take before their next interview.
   Format: "Practice X by doing Y — target Z outcome"

Return ONLY valid JSON:
{{
  "executive_summary": str,
  "action_plan": [str, str, str, str, str]
}}
"""
    try:
        report_data = run_gemini_json(
            prompt,
            generation_config={"temperature": 0.3, "response_mime_type": "application/json"}
        )
        return report_data
    except Exception as e:
        logger.error(f"Error generating report summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report summary")
