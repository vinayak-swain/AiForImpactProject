import os
import json
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Configure Gemini
api_key = os.environ.get("GEMINI_API_KEY", "")
is_mock = not api_key or api_key == "mock" or api_key == "mock-or-insert-key-here"

if not is_mock:
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-pro")
        logger.info("Gemini AI Client configured successfully.")
    except Exception as e:
        logger.error(f"Error configuring Gemini Client: {e}. Falling back to Mock mode.")
        is_mock = True
        model = None
else:
    logger.warning("Gemini API Key is not set or set to mock. Running in MOCK Mode.")
    model = None

def get_model():
    return model

def run_gemini_json(prompt: str, generation_config: dict = None) -> dict:
    """Runs a request to Gemini and returns parsed JSON. Fallbacks to mock response in mock mode."""
    if is_mock or not model:
        # Fallback to mock data parsing depending on prompt intent
        if "resume" in prompt.lower():
            return {
                "projects": [
                    {
                        "name": "E-Commerce Microservices",
                        "tech_stack": ["Node.js", "Express", "Docker", "RabbitMQ"],
                        "description": "Architected event-driven order processing service cutting latency by 35%."
                    },
                    {
                        "name": "AI Search Engine",
                        "tech_stack": ["Python", "FastAPI", "Elasticsearch", "React"],
                        "description": "Built semantic question answering system with Vector database indexing."
                    }
                ],
                "skills": ["JavaScript", "TypeScript", "Python", "React", "Node.js", "Docker", "PostgreSQL", "Redis"],
                "experiences": [
                    {
                        "company": "Stripe",
                        "role": "Software Engineering Intern",
                        "duration": "May 2025 - August 2025",
                        "tech": ["Ruby", "Go", "React"]
                    }
                ],
                "education": [
                    {
                        "degree": "B.S. in Computer Science",
                        "institution": "Stanford University",
                        "year": "2026"
                    }
                ]
            }
        elif "generate ONE interview question" in prompt or "question" in prompt.lower():
            return {
                "question_text": "Describe a scenario where you had to debug a complex performance issue in a distributed system. What tools did you use and how did you resolve it?",
                "question_type": "technical",
                "difficulty": "medium",
                "follow_up_hint": "Ask them to specify how they identified the bottleneck (e.g. CPU, memory, network, database query patterns)."
            }
        elif "post-interview performance report" in prompt or "report-summary" in prompt.lower():
            return {
                "executive_summary": "The candidate displayed strong technical foundations and structural storytelling using the STAR method. Their backend knowledge regarding API architecture is impressive, but their communication could be tightened. The primary area of focus should be avoiding filler word usage.",
                "action_plan": [
                    "Practice STAR structures by detailing specific data-layer optimizations - target 20% latency reduction explanation.",
                    "Explain architectural microservice decoupling by mapping message queues - target clear event-driven diagrams.",
                    "Practice verbal pacing to eliminate 'like' and 'actually' - target 0 filler words in a 3-minute answer.",
                    "Structure technical answers with quick 10-second summaries of your approach - target higher clarity.",
                    "Detail database schema designs with indexes and normalization - target solid query performance discussion."
                ]
            }
        else:
            # Evaluator/Scorer mockup
            return {
                "star_score": 20.0,
                "tech_depth_score": 19.5,
                "comm_score": 16.0,
                "relevance_score": 13.0,
                "confidence_score": 8.0,
                "conciseness_score": 4.0,
                "overall_score": 80.5,
                "star_feedback": {
                    "situation": "Very clear outline of the performance bottleneck on the high-throughput payment gateway.",
                    "task": "Identified the need to introduce Redis caching to reduce database read load by 80%.",
                    "action": "Individually set up Redis cluster, configured cache invalidation policies, and optimized SQL queries.",
                    "result": "Reduced API response latency from 600ms to 45ms and handled 3x more concurrent requests."
                },
                "top_strength": "Excellent technical depth and quantitative result delivery.",
                "top_weakness": "Utilized some filler phrases ('basically', 'actually') which slightly reduced delivery impact.",
                "filler_words": ["basically", "actually"],
                "ideal_answer_skeleton": "Mention the metric regression, outline the distributed tracer profiling tool, details of individual code changes, and final latency stats."
            }

    try:
        config = generation_config or {"temperature": 0.2}
        # Force JSON response type if configured
        if "response_mime_type" in config and config["response_mime_type"] == "application/json":
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=config.get("temperature", 0.0),
                    response_mime_type="application/json"
                )
            )
        else:
            response = model.generate_content(prompt, generation_config=genai.GenerationConfig(**config))

        text = response.text.strip()
        # strip markdown formatting if any exists
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        return json.loads(text)
    except Exception as e:
        logger.error(f"Error calling Gemini: {e}")
        # Return fallback on error
        return {
            "error": "Gemini API call failed",
            "message": str(e)
        }
