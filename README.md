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

## ☁️ Deployment & Production Setup

TechPrep AI is designed for modern serverless and containerized deployment environments.
*   **Frontend**: Deployed to [Vercel](https://vercel.com/) (e.g., `https://ai-for-impact-project-frontend.vercel.app`)
*   **Node.js API**: Deployed as a Web Service to [Render](https://render.com/) (e.g., `https://aiforimpactproject.onrender.com`)
*   **Python AI Service**: Deployed as a Web Service to [Render](https://render.com/) (e.g., `https://aiforimpactproject-ai.onrender.com`)
*   **Database & Redis**: Supabase Postgres and Upstash Redis clusters

---

## 🔑 Comprehensive OAuth Configuration Guide

To enable Google and GitHub authentication, you must register the application on their developer portals and configure the exact callback URIs.

### 1. Google OAuth 2.0 Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Go to **APIs & Services > OAuth consent screen**:
   * Select **External** user type.
   * Complete the app information (App name, support email, developer contact).
   * In **Scopes**, add `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
4. Go to **APIs & Services > Credentials**:
   * Click **+ Create Credentials** and select **OAuth client ID**.
   * Select **Web application** as the application type.
   * Add **Authorized JavaScript origins**:
     * Development: `http://localhost:3000`
     * Production: `https://aiforimpactproject.onrender.com` (Your Render API URL)
   * Add **Authorized redirect URIs**:
     * Development: `http://localhost:3000/api/auth/oauth/google/callback`
     * Production: `https://aiforimpactproject.onrender.com/api/auth/oauth/google/callback`
5. Copy the generated **Client ID** and **Client Secret** and add them to your environment variables (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`).

### 2. GitHub OAuth Setup
1. Go to your GitHub profile settings and navigate to **Developer Settings > OAuth Apps**.
2. Click **Register a new application**:
   * **Application name**: TechPrep AI
   * **Homepage URL**:
     * Development: `http://localhost:5173`
     * Production: `https://ai-for-impact-project-frontend.vercel.app` (Your Vercel Frontend URL)
   * **Authorization callback URL**:
     * Development: `http://localhost:3000/api/auth/oauth/github/callback`
     * Production: `https://aiforimpactproject.onrender.com/api/auth/oauth/github/callback` (Your Render API URL)
3. Register the application, then click **Generate a new client secret**.
4. Copy the **Client ID** and **Client Secret** and add them to your environment variables (`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`).

---

## ⚙️ Environment Variables Checklist

Ensure these variables are correctly set in the environment settings of your deployment platforms:

### 1. Frontend (Vercel)
| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL of your Node API backend | `https://aiforimpactproject.onrender.com/api` |

### 2. Node.js API (Render Web Service)
| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Mode of operation | `production` |
| `PORT` | Port for the backend | `10000` (Render handles this dynamically) |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://postgres:...` (Supabase or Render DB) |
| `REDIS_URL` | Redis connection URL | `rediss://default:...` (Upstash Redis) |
| `AI_SERVICE_URL` | URL of the Python AI Service | `https://aiforimpactproject-ai.onrender.com` |
| `WEB_URL` | URL of the frontend app | `https://ai-for-impact-project-frontend.vercel.app` |
| `JWT_SECRET` | Secret key used to sign JWT access tokens | *A long, secure random string* |
| `COOKIE_SECRET` | Secret key used to sign cookies | *A long, secure random string* |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `your-google-client-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET`| Google OAuth Client Secret | `GOCSPX-your-google-client-secret` |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | `your-github-client-id` |
| `GITHUB_CLIENT_SECRET`| GitHub OAuth Client Secret | `your-github-client-secret` |

### 3. Python AI Service (Render Web Service / Background Worker)
| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API Key for model queries | `AIzaSy...` (Get from Google AI Studio) |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://postgres:...` |
| `REDIS_URL` | Redis connection URL | `rediss://default:...` |
| `AWS_ACCESS_KEY_ID` | AWS Access Key ID for S3 storage | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY`| AWS Secret Access Key for S3 storage | `your-s3-secret-key` |
| `AWS_REGION` | AWS Region for S3 bucket | `us-east-1` |
| `S3_BUCKET_NAME` | Name of the bucket to store generated reports| `techprep-ai-reports` |

---

## 📄 License
This project is proprietary.

