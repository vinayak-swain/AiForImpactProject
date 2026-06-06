import os
import json
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Configure Gemini
api_key = os.environ.get("GEMINI_API_KEY", "")
is_mock = not api_key or api_key == "mock" or api_key == "mock-or-insert-key-here"

# Use gemini-2.0-flash: fastest, best for real-time conversational interviews
# gemini-1.5-flash is fallback, gemini-1.5-pro is too slow for live voice interviews
FAST_MODEL_NAME = "gemini-2.0-flash"
QUALITY_MODEL_NAME = "gemini-1.5-flash"

model = None
fast_model = None

if not is_mock:
    try:
        genai.configure(api_key=api_key)
        # Primary: gemini-2.0-flash for low-latency conversation
        fast_model = genai.GenerativeModel(FAST_MODEL_NAME)
        # Fallback quality model for scoring/reports (can afford slight delay)
        model = genai.GenerativeModel(QUALITY_MODEL_NAME)
        logger.info(f"Gemini AI configured: fast={FAST_MODEL_NAME}, quality={QUALITY_MODEL_NAME}")
    except Exception as e:
        logger.error(f"Error configuring Gemini: {e}. Falling back to Mock mode.")
        is_mock = True
        model = None
        fast_model = None
else:
    logger.warning("Gemini API Key not set. Running in MOCK Mode.")

def get_model():
    return fast_model or model

def run_gemini_json(prompt: str, generation_config: dict = None, use_fast: bool = False) -> dict:
    """
    Runs a Gemini request and returns parsed JSON.
    use_fast=True uses gemini-2.0-flash (lower latency, for real-time responses)
    use_fast=False uses gemini-1.5-flash (higher quality, for scoring/reports)
    """
    if is_mock or not (model or fast_model):
        # --- MOCK FALLBACK DATA ---
        if "resume" in prompt.lower():
            return {
                "projects": [
                    {"name": "E-Commerce Microservices", "tech_stack": ["Node.js", "Docker", "RabbitMQ"], "description": "Event-driven order processing service cutting latency by 35%."},
                    {"name": "AI Search Engine", "tech_stack": ["Python", "FastAPI", "Elasticsearch"], "description": "Semantic QA system with Vector database indexing."}
                ],
                "skills": ["JavaScript", "TypeScript", "Python", "React", "Node.js", "Docker", "PostgreSQL", "Redis"],
                "experiences": [{"company": "Stripe", "role": "Software Engineering Intern", "duration": "May 2025 - Aug 2025", "tech": ["Ruby", "Go", "React"]}],
                "education": [{"degree": "B.S. Computer Science", "institution": "Stanford University", "year": "2026"}]
            }
        elif "interview question" in prompt.lower() or "generate" in prompt.lower():
            return {
                "brief_acknowledgment": "Good answer! I appreciate you walking me through that.",
                "question_text": "Tell me about a challenging technical problem you've solved. Walk me through your approach.",
                "question_type": "technical",
                "difficulty": "medium",
                "follow_up_hint": "Ask about specific tools used and quantified outcomes."
            }
        elif "post-interview" in prompt.lower() or "report" in prompt.lower():
            return {
                "executive_summary": "Strong technical foundations. Communication can be tightened.",
                "action_plan": [
                    "Practice STAR structures with data-layer optimizations.",
                    "Map event-driven microservice diagrams clearly.",
                    "Eliminate filler words — target 0 per 3-minute answer.",
                    "Lead with a 10-second summary before deep-diving.",
                    "Detail database schema design decisions explicitly."
                ]
            }
        else:
            return {
                "star_score": 20.0, "tech_depth_score": 19.5, "comm_score": 16.0,
                "relevance_score": 13.0, "confidence_score": 8.0, "conciseness_score": 4.0,
                "overall_score": 80.5,
                "star_feedback": {
                    "situation": "Clear outline of the performance bottleneck.",
                    "task": "Identified need to introduce Redis caching.",
                    "action": "Set up Redis cluster and optimized SQL queries.",
                    "result": "Reduced API latency from 600ms to 45ms."
                },
                "top_strength": "Excellent technical depth and quantitative delivery.",
                "top_weakness": "Occasional filler phrases reduced delivery impact.",
                "filler_words": ["basically", "actually"],
                "ideal_answer_skeleton": "State the metric regression → profiling tool → individual changes → final latency stats."
            }

    try:
        config = generation_config or {"temperature": 0.3}
        active_model = fast_model if use_fast else model

        if "response_mime_type" in config and config["response_mime_type"] == "application/json":
            response = active_model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=config.get("temperature", 0.0),
                    response_mime_type="application/json"
                )
            )
        else:
            response = active_model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(**config)
            )

        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text.strip())
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return {"error": "Gemini API call failed", "message": str(e)}
