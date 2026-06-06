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
from services.role_prompts import get_role_config, get_question_generation_prompt, get_scoring_prompt

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

    if not resume_text:
        raise HTTPException(status_code=400, detail="Either resume_text or s3_key must be provided")

    prompt = f"""You are a resume parser. Extract structured data from the resume below.
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
            generation_config={"temperature": 0.0, "response_mime_type": "application/json"},
            use_fast=False  # Quality model for resume parsing
        )
        return parsed_data
    except Exception as e:
        logger.error(f"Error parsing resume: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse resume: {str(e)}")


@router.post("/generate-question", response_model=GenerateQuestionResponse)
async def generate_question(request: GenerateQuestionRequest):
    """
    Generate a contextually-aware interview question with a brief acknowledgment
    of the candidate's previous answer. Uses gemini-2.0-flash for low latency.
    """
    resume_ctx = (
        f"Candidate's resume summary:\n{request.resume_summary}"
        if request.resume_summary
        else "No resume provided."
    )

    # Build the role-specific, context-aware prompt
    prompt = get_question_generation_prompt(
        role=request.role,
        interview_type=request.interview_type,
        experience_level=request.experience_level,
        chat_history=request.chat_history or [],
        previous_questions=request.previous_questions,
        resume_ctx=resume_ctx,
    )

    try:
        question_data = run_gemini_json(
            prompt,
            generation_config={
                "temperature": 0.7,       # Some creativity for varied questions
                "response_mime_type": "application/json"
            },
            use_fast=True  # gemini-2.0-flash for real-time low latency
        )

        # Ensure brief_acknowledgment always exists
        if "brief_acknowledgment" not in question_data:
            question_data["brief_acknowledgment"] = ""

        return question_data
    except Exception as e:
        logger.error(f"Error generating question: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate question")


@router.post("/score-answer", response_model=ScoreAnswerResponse)
async def score_answer(request: ScoreAnswerRequest):
    """
    Score a candidate's answer using role-specific evaluation criteria.
    Uses quality model (1.5-flash) since slight latency is acceptable for scoring.
    """
    prompt = get_scoring_prompt(
        role=request.role,
        question=request.question,
        answer=request.answer,
        interview_type=request.interview_type,
    )
    try:
        score_data = run_gemini_json(
            prompt,
            generation_config={"temperature": 0.0, "response_mime_type": "application/json"},
            use_fast=False  # Quality model for accurate scoring
        )
        return score_data
    except Exception as e:
        logger.error(f"Error scoring answer: {e}")
        raise HTTPException(status_code=500, detail="Failed to score answer")


@router.post("/generate-feedback")
async def generate_feedback(request: GenerateFeedbackRequest):
    """
    Stream coaching feedback after a question is scored.
    Uses fast model with streaming for real-time voice playback.
    """
    cfg = get_role_config(request.role)
    role_context = f"Key focus areas for {request.role}: {', '.join(cfg['domains'][:3])}"

    prompt = f"""You are a professional technical interview coach, direct but supportive, for: {request.role}
{role_context}

Question asked: {request.question}
Score summary: {request.score_json}

Write coaching feedback in this exact format (keep each section to 1-2 sentences, total under 120 words):

STRENGTH:
[What they did well — be specific to their actual answer, not generic]

WEAKNESS:
[The single most important thing missing — name exactly what was absent]

IMPROVEMENT:
[One concrete, role-specific action they can take to answer this better next time]

Keep tone: direct coach, not cheerleader. No filler phrases like "Great job!" or "That's interesting!".
"""

    async def event_generator():
        active_model = get_model()
        if is_mock or not active_model:
            # Simulated streaming for mock mode
            mock_text = [
                "STRENGTH:\n",
                "You clearly articulated the technical approach ",
                "and demonstrated hands-on experience with the tooling.\n\n",
                "WEAKNESS:\n",
                "The Result component was missing — ",
                "you never quantified the business impact of your work.\n\n",
                "IMPROVEMENT:\n",
                f"For your next {request.role} answer, always close with a metric: ",
                "'This reduced latency by X%' or 'improved throughput by Xk RPS'.\n\n",
            ]
            for chunk in mock_text:
                for char in chunk:
                    yield f"data: {char}\n\n"
                    await asyncio.sleep(0.008)
                await asyncio.sleep(0.1)
            return

        try:
            response = active_model.generate_content(prompt, stream=True)
            for chunk in response:
                if chunk.text:
                    yield f"data: {chunk.text}\n\n"
                    await asyncio.sleep(0.01)
        except Exception as e:
            logger.error(f"Error streaming Gemini feedback: {e}")
            yield f"data: Error generating feedback: {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/report-summary", response_model=ReportSummaryResponse)
async def report_summary(request: ReportSummaryRequest):
    """
    Generate end-of-interview performance report.
    Uses quality model for thorough analysis.
    """
    sd = request.session_data
    cfg = get_role_config(sd.get("role", ""))
    role_domains = ", ".join(cfg["domains"][:4])

    prompt = f"""You are writing a post-interview performance report for a candidate.

Role: {sd.get('role')}
Interview type: {sd.get('interview_type')}
Overall score: {sd.get('overall_score')}/100
Dimension averages: {sd.get('dimension_averages')}
Number of questions answered: {len(sd.get('questions_and_scores', []))}
Key competency areas for this role: {role_domains}

Write a professional performance report:

1. executive_summary: 3 sentences.
   - Sentence 1: Overall performance verdict with score context (e.g. 'Strong/Moderate/Weak performance at X/100').
   - Sentence 2: Biggest strength with specific evidence from the session.
   - Sentence 3: Most critical improvement area with a specific next step.

2. action_plan: exactly 5 specific, role-relevant action items.
   Format each as: "Practice [X] by doing [Y] — target [Z measurable outcome]"
   Make each item specific to {sd.get('role')} competencies.

Return ONLY valid JSON:
{{
  "executive_summary": "string",
  "action_plan": ["string", "string", "string", "string", "string"]
}}
"""
    try:
        report_data = run_gemini_json(
            prompt,
            generation_config={"temperature": 0.3, "response_mime_type": "application/json"},
            use_fast=False  # Quality model for comprehensive report
        )
        return report_data
    except Exception as e:
        logger.error(f"Error generating report summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report summary")
