# TechPrep AI — The Ultimate AI Interview Practice Platform

TechPrep AI is a full-stack, production-ready interview practice platform designed to help computer science students and software engineers prepare for technical and behavioral job interviews. The application generates customized questions based on user roles, scores answers across 6 unique dimensions, streams real-time coaching feedback using Server-Sent Events (SSE), and generates beautiful downloadable PDF reports.

## 🚀 Key Features

*   **Custom AI Question Generator**: Generates customized technical, behavioral, or resume-based interview questions based on the candidate's target role (e.g., Backend SDE, Machine Learning Engineer) and experience level.
*   **6-Dimensional Rubric Scorer**: Grades answers instantly on STAR Structure, Technical Depth, Communication, Relevance, Confidence, and Conciseness.
*   **Interactive Voice & Chat Coach**: Supports fully interactive voice-mode where the AI coach speaks to you using Web Speech Synthesis and listens to your responses.
*   **SSE Streaming Feedback**: Streams supportive verbal evaluations and gaps identification character-by-character as you complete each question.
*   **Async PDF Reports Generator**: Listens to message queues, draws polar/bar charts, constructs multi-page performance reports using Python ReportLab, and uploads them to S3.
*   **Preparation Dashboard**: Focus training area recommendations based on weakest dimensions, streak tracking, recent sessions table, and Recharts performance trends.
*   **OAuth Authentication**: Frictionless login using Google and GitHub.

## 🛠️ Tech Stack

### Frontend
*   **Framework**: React 18 with TypeScript and Vite
*   **Styling**: Tailwind CSS v4, Material Symbols
*   **State Management**: Zustand
*   **Data Fetching**: TanStack Query v5
*   **Data Visualization**: Recharts

### Backend API (Node.js)
*   **Framework**: Fastify 4 (Node.js 20 LTS)
*   **Database**: PostgreSQL 16
*   **ORM**: Prisma
*   **Authentication**: Custom JWT with `@fastify/jwt` and `@fastify/cookie`, Google/GitHub OAuth
*   **Caching & Queues**: Redis 7, `ioredis`
*   **File Storage**: AWS S3 via `@aws-sdk/client-s3`

### AI Service (Python)
*   **Framework**: FastAPI (Python 3.12)
*   **LLM Integration**: Google Generative AI (Gemini 1.5 Pro)
*   **PDF Generation**: ReportLab, Matplotlib, pandas
*   **Queue Consumer**: Background Worker pulling jobs from Redis

## 📂 Project Structure

```text
techprep-ai/
├── apps/
│   ├── api/                  # Fastify Node.js API backend (Port 3000)
│   ├── ai-service/           # FastAPI Python AI Service & Workers (Port 8000)
│   └── frontend/             # React Vite TS Frontend SPA (Port 5173)
├── docker-compose.yml        # Full-stack Docker composition setup
└── .env.example              # Environments template
```

## 🏃 Getting Started (Local Development)

The easiest way to run the entire stack locally is using Docker Compose.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vinayak-swain/AiForImpactProject.git
   cd AiForImpactProject
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env` in the root directory. You must supply your own Google Gemini API Key.
   ```bash
   cp .env.example .env
   ```

3. **Start the stack:**
   ```bash
   docker-compose up --build
   ```
   This will spin up Postgres, Redis, the Node API, the Python AI Service, the PDF Worker, and the React Frontend.

4. **Access the Application:**
   Open `http://localhost:5173` in your browser.

## ☁️ Deployment

TechPrep AI is designed for modern serverless and containerized deployment environments.
*   **Frontend**: Deployed to [Vercel](https://vercel.com/)
*   **Node.js API**: Deployed as a Web Service to [Render](https://render.com/)
*   **Python AI Service**: Deployed as a Web Service to [Render](https://render.com/)
*   **Database & Redis**: Managed Postgres and Redis clusters

### Production Environment Variables Checklist
When deploying, ensure the following environment variables are set correctly:

**Frontend (Vercel)**
*   `VITE_API_URL`: URL of your Node API (e.g., `https://my-api.onrender.com/api`)

**Node.js API (Render)**
*   `DATABASE_URL`: Postgres Connection String
*   `REDIS_URL`: Redis Connection String
*   `AI_SERVICE_URL`: URL of your Python AI Service (e.g., `https://my-ai-service.onrender.com`)
*   `WEB_URL`: URL of your Frontend (e.g., `https://my-frontend.vercel.app`)
*   `JWT_SECRET`: A long random string for signing JWTs
*   `COOKIE_SECRET`: A long random string for signing Cookies
*   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: For Google OAuth
*   `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: For GitHub OAuth

**Python AI Service (Render)**
*   `GEMINI_API_KEY`: Your Google Gemini API Key
*   `REDIS_URL`: Redis Connection String
*   `DATABASE_URL`: Postgres Connection String
*   `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET_NAME`: For PDF storage

## 📄 License
This project is proprietary.
