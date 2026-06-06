# TechPrep AI — AI Interview Practice Platform

TechPrep AI is a full-stack, production-ready AI interview practice platform that helps computer science students prepare for technical job interviews. The application generates customized questions based on user roles and resumes, scores answers across 6 dimensions, streams real-time coaching feedback using Server-Sent Events (SSE), and generates beautiful downloadable PDF reports.

## 🚀 Key Features

*   **Custom AI Question Generator**: Generates customized technical, behavioral, or resume-based interview questions based on the candidate's target role and experience.
*   **6-Dimensional Rubric Scorer**: Grades answers on STAR Structure, Technical Depth, Communication, Relevance, Confidence, and Conciseness.
*   **SSE Streaming AI Coach**: Streams supportive verbal evaluations and gaps identification character-by-character as you complete each question.
*   **Async PDF Reports Generator**: Listens to message queues, draws polar/bar charts, constructs multi-page performance reports, and uploads them to S3.
*   **Preparation Dashboard**: Focus training area recommendations based on weakest dimensions, streak tracking, recent sessions table, and Recharts trends.

## 🛠️ Tech Stack

*   **Backend API**: Node.js 20 LTS, Fastify 4, Prisma ORM, PostgreSQL 16
*   **Caching & Queue**: Redis 7, ioredis
*   **AI Service**: Python 3.12, FastAPI, Google Gemini 1.5 Pro (via SDK)
*   **File Storage**: AWS S3 (via `@aws-sdk/client-s3`) / local dev fallback
*   **PDF Worker**: Python ReportLab, Matplotlib
*   **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, Recharts, TanStack Query v5, Zustand

## 📂 Project Structure

```text
techprep-ai/
├── apps/
│   ├── api/                  # Fastify Node.js API backend
│   ├── ai-service/           # FastAPI Python AI Service & Workers
│   └── web/                  # React Vite TS Frontend SPA
├── docker-compose.yml        # Docker composition setup
└── .env.example              # Environments template
```

## 🏃 Getting Started

Simply run Docker Compose in the root directory:
```bash
docker-compose up --build
```

For detailed natively hosted instructions, codebase layout, and architectural diagrams, please see the [walkthrough.md](C:/Users/swaya/.gemini/antigravity-ide/brain/661d63d7-778e-4a6d-9669-f82842047c65/walkthrough.md) and [implementation_plan.md](C:/Users/swaya/.gemini/antigravity-ide/brain/661d63d7-778e-4a6d-9669-f82842047c65/implementation_plan.md) files.
