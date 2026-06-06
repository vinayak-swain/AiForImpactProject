"""
Role-specific interview competency maps and prompt strategies.
Used to generate targeted, domain-specific questions and acknowledgments.
"""

# --- ROLE COMPETENCY MAPS ---
# Each role has: domains (topic areas to cover), question_types, seniority_focus
ROLE_CONFIG = {
    "Backend SDE": {
        "domains": [
            "System Design & Scalability",
            "Database Design (SQL/NoSQL, indexing, query optimization)",
            "API Design (REST, gRPC, GraphQL)",
            "Caching strategies (Redis, Memcached)",
            "Concurrency & Multithreading",
            "Microservices & Event-driven architecture",
            "Security (Auth, JWT, OAuth, HTTPS)",
            "Performance profiling & debugging",
            "CI/CD & DevOps basics",
        ],
        "tech_stack_examples": "Node.js, Python, Java, Go, PostgreSQL, Redis, Docker, Kafka",
        "star_context": "backend services, API design, database performance, system reliability",
        "key_expectations": "You should test deep technical knowledge of distributed systems, data consistency, and performance optimization. Avoid generic CS theory — focus on practical applied backend scenarios.",
    },

    "Frontend SDE": {
        "domains": [
            "React/Vue/Angular component lifecycle and rendering optimization",
            "State management (Redux, Zustand, Context API, Recoil)",
            "Browser rendering pipeline (layout, paint, compositing)",
            "Performance optimization (lazy loading, code splitting, memoization)",
            "Accessibility (WCAG, ARIA roles, semantic HTML)",
            "CSS architecture (BEM, CSS Modules, Tailwind, animations)",
            "Network requests (fetch, axios, error handling, caching)",
            "Testing (Jest, React Testing Library, Cypress, Storybook)",
            "Build tools (Vite, Webpack, esbuild)",
        ],
        "tech_stack_examples": "React, TypeScript, Next.js, Vite, Tailwind CSS, Jest, Cypress",
        "star_context": "UI performance improvements, component architecture, accessibility wins",
        "key_expectations": "Focus on practical implementation depth. Ask about trade-offs in framework choices, performance debugging stories, and how they handle complex UI state.",
    },

    "Full Stack SDE": {
        "domains": [
            "End-to-end application architecture (frontend + backend + DB)",
            "REST API design and consumption from frontend",
            "Database selection criteria (SQL vs NoSQL trade-offs)",
            "Authentication flows (JWT, session cookies, OAuth)",
            "Deployment strategies (Docker, CI/CD, Vercel, AWS)",
            "React/Next.js with server-side vs client-side rendering",
            "Real-time features (WebSockets, SSE, polling)",
            "Monorepo architecture and code sharing",
            "Debugging across the stack",
        ],
        "tech_stack_examples": "React, Node.js, PostgreSQL, Redis, Docker, Prisma, Next.js",
        "star_context": "cross-stack features, integration challenges, deployment war stories",
        "key_expectations": "Test ability to reason about the entire system. Ask about specific cross-stack challenges — where does the data come from, how is it cached, what breaks first under load?",
    },

    "ML Engineer": {
        "domains": [
            "Model selection and evaluation (bias-variance, metrics: AUC, F1, RMSE)",
            "Feature engineering and preprocessing pipelines",
            "Training pipeline design (batching, augmentation, distributed training)",
            "Model deployment and serving (FastAPI, TorchServe, ONNX, BentoML)",
            "MLOps (experiment tracking with MLflow/W&B, versioning, monitoring)",
            "Deep learning fundamentals (CNNs, Transformers, attention mechanisms)",
            "NLP tasks (tokenization, fine-tuning LLMs, RAG systems)",
            "Data engineering for ML (ETL, feature stores, data drift detection)",
            "Productionization (latency optimization, batching, caching predictions)",
        ],
        "tech_stack_examples": "Python, PyTorch, TensorFlow, scikit-learn, MLflow, Hugging Face, FastAPI, Spark",
        "star_context": "model improvements, data pipeline design, production ML challenges",
        "key_expectations": "Focus on applied ML, not pure theory. Ask about real model debugging, how they handle class imbalance, and how they've moved models from notebooks to production.",
    },

    "Data Scientist": {
        "domains": [
            "Statistical foundations (hypothesis testing, p-values, confidence intervals)",
            "Exploratory Data Analysis (EDA) and visualization",
            "Supervised/Unsupervised learning (regression, clustering, classification)",
            "Feature selection and dimensionality reduction (PCA, UMAP)",
            "A/B testing design and analysis",
            "SQL for data extraction and transformation",
            "Python data stack (pandas, NumPy, matplotlib, seaborn)",
            "Business communication of insights and storytelling with data",
            "Time series analysis and forecasting",
        ],
        "tech_stack_examples": "Python, pandas, scikit-learn, SQL, Tableau, dbt, Spark, Jupyter",
        "star_context": "business impact of data projects, experiment design, insight communication",
        "key_expectations": "Blend technical rigor with business impact. Ask how they've influenced decisions with data. Test statistical intuition with concrete scenarios, not formulas.",
    },

    "Java Developer": {
        "domains": [
            "Java core (JVM internals, memory model, GC tuning, Java 17+ features)",
            "Spring Boot (dependency injection, REST APIs, Spring Security)",
            "Concurrency (ExecutorService, CompletableFuture, synchronized, volatile)",
            "Design Patterns (Builder, Factory, Strategy, Observer, Singleton pitfalls)",
            "JPA/Hibernate (lazy vs eager loading, N+1 problem, transactions)",
            "Microservices with Spring Cloud (service discovery, circuit breakers)",
            "Build tools (Maven, Gradle) and testing (JUnit 5, Mockito)",
            "Performance (profiling with JProfiler/VisualVM, heap dumps)",
            "Message queuing (Kafka, RabbitMQ with Spring AMQP)",
        ],
        "tech_stack_examples": "Java 17+, Spring Boot 3, Hibernate, Maven, Kafka, Docker, PostgreSQL",
        "star_context": "Spring app performance, JVM tuning, service design patterns",
        "key_expectations": "Test Java-specific knowledge deeply — JVM behavior, Spring internals, and real concurrency problems. Avoid surface-level 'what is polymorphism' questions.",
    },

    "Mobile Engineer": {
        "domains": [
            "React Native / Flutter cross-platform architecture",
            "iOS (Swift, UIKit, SwiftUI, CoreData, XCode)",
            "Android (Kotlin, Jetpack Compose, Room, MVVM)",
            "App performance (frame rates, memory, battery optimization)",
            "State management on mobile (Redux/Zustand for RN, ViewModel for Android)",
            "App store deployment (CI/CD, code signing, TestFlight, Play Console)",
            "Push notifications and background processing",
            "Offline-first patterns and local data sync",
            "Native bridging and third-party SDK integration",
        ],
        "tech_stack_examples": "React Native, Flutter, Swift, Kotlin, Firebase, Expo, Fastlane",
        "star_context": "performance improvements, cross-platform challenges, app store submissions",
        "key_expectations": "Focus on platform-specific trade-offs and real performance wins. Ask about specific bugs they've fixed in the wild (crashes, memory leaks, jank).",
    },

    "Product Manager": {
        "domains": [
            "Product strategy and roadmap prioritization (RICE, MoSCoW, Kano)",
            "User research (interviews, surveys, usability testing)",
            "Metrics definition (North Star, OKRs, KPIs, leading vs lagging indicators)",
            "Stakeholder management and cross-functional alignment",
            "Feature scoping and requirement writing (PRDs, user stories)",
            "A/B testing and data-driven decision making",
            "Go-to-market strategy and product launches",
            "Competitive analysis and market positioning",
            "Technical literacy (working with engineers, understanding APIs/systems)",
        ],
        "tech_stack_examples": "Jira, Figma, Mixpanel, Amplitude, SQL, Google Analytics, Notion",
        "star_context": "product launches, stakeholder conflicts, metric improvements",
        "key_expectations": "Focus on decision frameworks, trade-off reasoning, and impact storytelling. Test how they handle ambiguity, competing priorities, and disagreements with engineering.",
    },
}

# Default fallback for unknown roles
DEFAULT_ROLE_CONFIG = {
    "domains": [
        "Problem-solving and analytical thinking",
        "System design fundamentals",
        "Communication and collaboration",
        "Previous project experience",
        "Technical decision-making",
    ],
    "tech_stack_examples": "Varies by specialization",
    "star_context": "past projects, team collaboration, technical decisions",
    "key_expectations": "Focus on structured problem-solving, clear communication, and evidence of learning from challenges.",
}

def get_role_config(role: str) -> dict:
    """Get role-specific config, with fuzzy matching for common variations."""
    role_lower = role.lower()

    # Exact match first
    if role in ROLE_CONFIG:
        return ROLE_CONFIG[role]

    # Fuzzy match
    role_map = {
        "backend": "Backend SDE",
        "frontend": "Frontend SDE",
        "fullstack": "Full Stack SDE",
        "full stack": "Full Stack SDE",
        "machine learning": "ML Engineer",
        "ml": "ML Engineer",
        "ai engineer": "ML Engineer",
        "data science": "Data Scientist",
        "data analyst": "Data Scientist",
        "java": "Java Developer",
        "android": "Mobile Engineer",
        "ios": "Mobile Engineer",
        "react native": "Mobile Engineer",
        "flutter": "Mobile Engineer",
        "mobile": "Mobile Engineer",
        "product": "Product Manager",
        "pm": "Product Manager",
    }

    for key, mapped_role in role_map.items():
        if key in role_lower:
            return ROLE_CONFIG[mapped_role]

    return DEFAULT_ROLE_CONFIG


def get_question_generation_prompt(
    role: str,
    interview_type: str,
    experience_level: str,
    chat_history: list,
    previous_questions: list,
    resume_ctx: str,
) -> str:
    """
    Build a rich, role-specific prompt for question generation.
    Implements CONTEXTUAL MEMORY: every answer permanently shapes future questions,
    difficulty calibration, and the interviewer's tone throughout the entire session.
    """
    cfg = get_role_config(role)
    domains_list = "\n".join(f"  - {d}" for d in cfg["domains"])

    # Build full conversation history and analyze candidate performance
    conversation_str = ""
    last_answer = ""
    total_answers = 0
    strong_areas = []
    weak_areas = []

    if chat_history:
        for i, turn in enumerate(chat_history):
            q = turn.get("question", "")
            a = turn.get("answer", "")
            if q:
                conversation_str += f"Q{i+1}: {q}\n"
            if a:
                conversation_str += f"Candidate's Answer: {a}\n\n"
                total_answers += 1
                if i == len(chat_history) - 1:
                    last_answer = a

                # Heuristic analysis: long, specific answers = stronger performance
                word_count = len(a.split())
                if word_count > 120 and any(kw in a.lower() for kw in ["because", "which", "resulted in", "reduced", "improved", "%", "implemented"]):
                    strong_areas.append(f"Q{i+1}")
                elif word_count < 60 or a.count("I ") < 2:
                    weak_areas.append(f"Q{i+1}")

    is_first_question = not bool(conversation_str.strip())

    # Determine adaptive difficulty based on performance history
    if total_answers == 0:
        adaptive_difficulty = "easy"
        difficulty_rationale = "Starting with an accessible warm-up question."
    elif len(strong_areas) > len(weak_areas):
        adaptive_difficulty = "hard"
        difficulty_rationale = f"Candidate showed depth in {len(strong_areas)} answers. Escalate to harder, more specific scenarios."
    elif len(weak_areas) > len(strong_areas):
        adaptive_difficulty = "easy"
        difficulty_rationale = f"Candidate gave shallow answers in {len(weak_areas)} turns. Use a supportive, scaffolded question to rebuild confidence."
    else:
        adaptive_difficulty = "medium"
        difficulty_rationale = "Mixed performance — use a focused, medium-difficulty question."

    # Interview type instructions
    type_instructions = {
        "technical": f"""
- Ask applied technical questions, NOT textbook definitions
- Target depth in: {', '.join(cfg['domains'][:4])}
- Challenge them with realistic scenarios (e.g., 'Your API is returning 503s at 10k RPS, how do you debug this?')
- Adaptive: if previous answers were strong, increase specificity and complexity; if weak, simplify and scaffold
""",
        "behavioural": f"""
- Use STAR-prompting language (Situation, Task, Action, Result)
- Ask about real past experiences in: {cfg['star_context']}
- If the answer lacked a Result, explicitly ask 'And what was the measurable outcome?'
- Focus on ownership language ('I did X' not 'we did X')
""",
        "resume_based": f"""
- Base questions directly on their resume context below
- Ask them to explain specific projects or experience entries in depth
- If resume is generic, probe their process: 'Walk me through exactly how you built X'
- Follow up with 'What would you do differently now?'
""",
    }
    type_guide = type_instructions.get(interview_type, type_instructions["technical"])

    prompt = f"""You are a professional technical interviewer conducting a live interview for: **{role}**
Experience level: {experience_level}
Interview type: {interview_type}

=== YOUR ROLE-SPECIFIC FOCUS AREAS ===
{domains_list}

Tech stack context: {cfg['tech_stack_examples']}

=== INTERVIEW STRATEGY ===
{type_guide}
{cfg['key_expectations']}

=== RESUME CONTEXT ===
{resume_ctx}

=== FULL CONVERSATION SO FAR (PERMANENT CONTEXT) ===
{conversation_str if conversation_str else "This is the very start of the interview. No questions asked yet."}

=== CONTEXTUAL MEMORY ANALYSIS ===
Total answers given: {total_answers}
Strong responses (detailed, specific): {', '.join(strong_areas) if strong_areas else 'None yet'}
Weak responses (vague, short): {', '.join(weak_areas) if weak_areas else 'None yet'}
Recommended difficulty for next question: {adaptive_difficulty.upper()}
Rationale: {difficulty_rationale}

=== QUESTIONS ALREADY ASKED (do NOT repeat these) ===
{', '.join(previous_questions) if previous_questions else "None yet."}

=== YOUR TASK ===
{"Since this is the first question, warmly greet the candidate as their interviewer and ask the first role-specific question at easy difficulty." if is_first_question else f'''
The candidate just answered: "{last_answer[:600]}..."

FIRST, analyze their answer using contextual memory:
- Did they directly address the question with specifics?
- Is this consistent with their previous performance pattern?
- Should you probe deeper (if strong) or scaffold (if struggling)?

THEN generate your response:
- brief_acknowledgment: 1-2 natural sentences reacting to what THEY SPECIFICALLY SAID. Reference a detail they mentioned. If incomplete, note it precisely (e.g., "You mentioned Redis but didn't explain how you handled cache invalidation."). Keep it human and direct.
- Next question: choose {adaptive_difficulty} difficulty based on contextual memory analysis above.
'''}

Return ONLY this JSON (no markdown, no commentary):
{{
  "brief_acknowledgment": "string — 1-2 sentences reacting naturally to their specific last answer. If this is Q1, use: 'Hello! I am your interviewer today. Let\\'s get started.'",
  "question_text": "string — the actual question to ask next",
  "question_type": "technical" | "behavioural" | "resume_based",
  "difficulty": "{adaptive_difficulty}",
  "follow_up_hint": "string — what to ask if their next answer is vague"
}}
"""
    return prompt



def get_scoring_prompt(role: str, question: str, answer: str, interview_type: str) -> str:
    """Build a role-aware scoring prompt."""
    cfg = get_role_config(role)

    return f"""You are an expert interview evaluator for: {role}
Interview type: {interview_type}

Question asked: {question}
Candidate's answer: {answer}

Role context: This role requires expertise in {', '.join(cfg['domains'][:3])}.
Judge the answer from the perspective of a hiring manager for this specific role.

Score dimensions (be strict but fair):
- star_score (0-25): STAR structure. Penalize heavily if Action uses 'we' instead of 'I', or is vague.
- tech_depth_score (0-25): Correct, applied use of relevant technologies for {role}. Zero if no tech content.
- comm_score (0-20): Clarity, grammar, no filler words.
- relevance_score (0-15): Directly answers the question.
- confidence_score (0-10): Assertive first-person language. Penalize hedging.
- conciseness_score (0-5): 0 if <40 words, 5 if 100-400 words, 3 if 400-600, 1 if >600.

Return ONLY valid JSON:
{{
  "star_score": float,
  "tech_depth_score": float,
  "comm_score": float,
  "relevance_score": float,
  "confidence_score": float,
  "conciseness_score": float,
  "overall_score": float,
  "star_feedback": {{
    "situation": "1-sentence feedback",
    "task": "1-sentence feedback",
    "action": "1-sentence feedback",
    "result": "1-sentence feedback"
  }},
  "top_strength": "1 sentence, specific to this role and answer",
  "top_weakness": "1 sentence, specific and actionable",
  "filler_words": ["list", "of", "overused", "words"],
  "ideal_answer_skeleton": "2-3 sentence structure guide for this specific question"
}}
"""
