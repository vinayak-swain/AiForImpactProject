import os
import json
import logging
import time
import requests
import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime
from sqlalchemy import create_engine, text
import redis
import boto3

# Import ReportLab modules
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# Setup Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] pdf_worker: %(message)s")
logger = logging.getLogger("pdf_worker")

# Load environment
db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/techprep")
redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
ai_service_url = os.environ.get("AI_SERVICE_URL", "http://localhost:8000")
is_mock_s3 = os.environ.get("AWS_ACCESS_KEY_ID") == "mock" or not os.environ.get("AWS_ACCESS_KEY_ID")
bucket_name = os.environ.get("S3_BUCKET_NAME", "techprep-ai-reports")

# Database setup
engine = create_engine(db_url)

# Redis setup
try:
    redis_client = redis.from_url(redis_url)
    logger.info("Connected to Redis successfully.")
except Exception as e:
    logger.error(f"Redis connection failed: {e}")
    redis_client = None

def fetch_session_data(session_id: str):
    """Fetches complete session, questions, answers, and scores from DB using raw SQL."""
    with engine.connect() as conn:
        # Fetch Session
        session_res = conn.execute(text('SELECT * FROM "Session" WHERE id = :id'), {"id": session_id}).first()
        if not session_res:
            return None
        
        session = dict(session_res._mapping)
        
        # Fetch User
        user_res = conn.execute(text('SELECT * FROM "User" WHERE id = :id'), {"id": session["userId"]}).first()
        user = dict(user_res._mapping) if user_res else {"name": "Candidate", "email": ""}
        
        # Fetch Questions
        questions_res = conn.execute(
            text('SELECT * FROM "Question" WHERE "sessionId" = :sid ORDER BY "orderIndex" ASC'),
            {"sid": session_id}
        ).fetchall()
        
        questions = []
        for q_row in questions_res:
            q = dict(q_row._mapping)
            # Fetch Answer
            ans_res = conn.execute(text('SELECT * FROM "Answer" WHERE "questionId" = :qid'), {"qid": q["id"]}).first()
            if ans_res:
                ans = dict(ans_res._mapping)
                # Fetch Score
                score_res = conn.execute(text('SELECT * FROM "Score" WHERE "answerId" = :aid'), {"aid": ans["id"]}).first()
                ans["score"] = dict(score_res._mapping) if score_res else None
                q["answer"] = ans
            else:
                q["answer"] = None
            questions.append(q)
            
        session["user"] = user
        session["questions"] = questions
        return session

def generate_radar_chart(session_id: str, dimension_avgs: dict) -> str:
    """Generates a radar chart using matplotlib and saves as local PNG."""
    categories = ['STAR Structure', 'Technical Depth', 'Communication', 'Relevance', 'Confidence', 'Conciseness']
    
    # Scale dimension averages out of 100 for visual uniformity
    # max marks: star(25), tech(25), comm(20), relevance(15), confidence(10), conciseness(5)
    values = [
        (dimension_avgs.get('star', 0) / 25) * 100,
        (dimension_avgs.get('techDepth', 0) / 25) * 100,
        (dimension_avgs.get('comm', 0) / 20) * 100,
        (dimension_avgs.get('relevance', 0) / 15) * 100,
        (dimension_avgs.get('confidence', 0) / 10) * 100,
        (dimension_avgs.get('conciseness', 0) / 5) * 100
    ]
    
    # Repeat first value to close the circular loop
    categories = [*categories, categories[0]]
    values = [*values, values[0]]
    
    label_loc = np.linspace(start=0, stop=2 * np.pi, num=len(values))
    
    plt.figure(figsize=(6, 5), facecolor='white')
    plt.subplot(polar=True)
    plt.plot(label_loc, values, label='Current Session', color='#6366f1', linewidth=2)
    plt.fill(label_loc, values, color='#6366f1', alpha=0.3)
    
    # Format axes
    plt.title('Performance Dimensions (%)', size=14, color='#1f2937', weight='bold', pad=15)
    lines, labels = plt.thetagrids(np.degrees(label_loc[:-1]), categories[:-1])
    for label in labels:
        label.set_color('#4b5563')
        label.set_fontsize(9)
        
    plt.ylim(0, 100)
    plt.grid(color='#e5e7eb', linestyle='--')
    
    chart_path = f"/tmp/{session_id}_radar.png"
    # Create temp directory if doesn't exist (useful in docker / temp)
    os.makedirs("/tmp", exist_ok=True)
    plt.savefig(chart_path, bbox_inches='tight', dpi=150)
    plt.close()
    return chart_path

def generate_bar_chart(session_id: str, questions: list) -> str:
    """Generates a bar chart showing score trends across questions."""
    q_indexes = [f"Q{q['orderIndex'] + 1}" for q in questions if q['answer'] and q['answer']['score']]
    scores = [q['answer']['score']['overallScore'] for q in questions if q['answer'] and q['answer']['score']]
    
    if not scores:
        q_indexes = ['Q1']
        scores = [0]

    plt.figure(figsize=(6, 4), facecolor='white')
    colors_list = ['#6366f1' if s >= 80 else ('#f59e0b' if s >= 50 else '#ef4444') for s in scores]
    
    plt.bar(q_indexes, scores, color=colors_list, width=0.5, edgecolor='#4338ca', linewidth=0.5)
    plt.title('Score per Question', size=12, color='#1f2937', weight='bold', pad=10)
    plt.ylabel('Overall Score (0-100)', size=9, color='#4b5563')
    plt.ylim(0, 105)
    
    # Styling grids
    plt.grid(axis='y', linestyle=':', alpha=0.5)
    plt.gca().set_axisbelow(True)
    
    chart_path = f"/tmp/{session_id}_bar.png"
    plt.savefig(chart_path, bbox_inches='tight', dpi=150)
    plt.close()
    return chart_path

def build_pdf(session: dict, summary_data: dict, radar_path: str, bar_path: str, dest_path: str):
    """Constructs the PDF report using ReportLab Flowables."""
    doc = SimpleDocTemplate(
        dest_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=28,
        textColor=colors.HexColor('#111827'),
        leading=34,
        alignment=1, # Center
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=14,
        textColor=colors.HexColor('#4b5563'),
        leading=18,
        alignment=1,
        spaceAfter=30
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#1f2937'),
        leading=22,
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        textColor=colors.HexColor('#4f46e5'),
        leading=16,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#374151'),
        leading=14,
        spaceAfter=8
    )
    
    bold_body_style = ParagraphStyle(
        'BoldBody',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    story = []
    
    # --- PAGE 1: COVER ---
    story.append(Spacer(1, 100))
    story.append(Paragraph("TechPrep AI", title_style))
    story.append(Paragraph(f"Interview Practice Performance Report", subtitle_style))
    story.append(Spacer(1, 40))
    
    # Cover Metadata Block
    date_str = datetime.now().strftime("%B %d, %Y")
    meta_data = [
        [Paragraph("Candidate Name:", bold_body_style), Paragraph(session['user']['name'], body_style)],
        [Paragraph("Interview Role Target:", bold_body_style), Paragraph(session['role'], body_style)],
        [Paragraph("Interview Type:", bold_body_style), Paragraph(session['interviewType'].replace('_', ' ').capitalize(), body_style)],
        [Paragraph("Evaluation Date:", bold_body_style), Paragraph(date_str, body_style)],
        [Paragraph("Session Duration:", bold_body_style), Paragraph(f"{session['durationMins']} mins", body_style)]
    ]
    t_meta = Table(meta_data, colWidths=[160, 260])
    t_meta.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#f3f4f6')),
    ]))
    story.append(t_meta)
    
    story.append(Spacer(1, 60))
    
    # Grade Badge
    grade = session.get('grade', 'C')
    grade_colors = {
        'A': '#10b981', # emerald
        'B': '#3b82f6', # blue
        'C': '#f59e0b', # amber
        'D': '#ef4444', # red
        'F': '#6b7280'
    }
    badge_bg = grade_colors.get(grade, '#f59e0b')
    
    badge_style = ParagraphStyle(
        'Badge',
        fontName='Helvetica-Bold',
        fontSize=42,
        textColor=colors.white,
        alignment=1
    )
    
    score_sub_style = ParagraphStyle(
        'ScoreSub',
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor('#6b7280'),
        alignment=1,
        spaceBefore=10
    )
    
    badge_data = [
        [Paragraph(grade, badge_style)],
        [Paragraph(f"OVERALL SCORE: {round(session.get('overallScore', 0.0), 1)} / 100", score_sub_style)]
    ]
    t_badge = Table(badge_data, colWidths=[200])
    t_badge.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor(badge_bg)),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,0), 15),
        ('BOTTOMPADDING', (0,0), (-1,0), 15),
        ('BOX', (0,0), (-1,-1), 2, colors.HexColor('#e5e7eb')),
    ]))
    story.append(t_badge)
    
    story.append(PageBreak())
    
    # --- PAGE 2: EXECUTIVE SUMMARY & ACTION PLAN ---
    story.append(Paragraph("Executive Summary", h1_style))
    story.append(Paragraph(summary_data.get('executive_summary', ''), body_style))
    story.append(Spacer(1, 15))
    
    story.append(Paragraph("Targeted Action Plan", h1_style))
    action_items = summary_data.get('action_plan', [])
    for idx, item in enumerate(action_items):
        plan_style = ParagraphStyle(
            f'PlanItem_{idx}',
            parent=body_style,
            leftIndent=20,
            firstLineIndent=-10
        )
        story.append(Paragraph(f"{idx+1}. {item}", plan_style))
        story.append(Spacer(1, 5))
        
    story.append(Spacer(1, 25))
    
    # Visual Performance Metrics Section
    story.append(Paragraph("Visual Performance Metrics", h1_style))
    
    # Embed Charts Side-by-Side in Table
    charts_table_data = [
        [Image(radar_path, width=240, height=200), Image(bar_path, width=240, height=160)]
    ]
    t_charts = Table(charts_table_data, colWidths=[250, 250])
    t_charts.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_charts)
    
    story.append(PageBreak())
    
    # --- PAGES 3+: Q&A BREAKDOWN ---
    story.append(Paragraph("Detailed Questions & Answers", h1_style))
    
    for idx, q in enumerate(session['questions']):
        if not q['answer'] or not q['answer']['score']:
            continue
            
        ans = q['answer']
        score = ans['score']
        feedback = score['aiFeedbackJson']
        
        story.append(Paragraph(f"Question {idx+1}: {q['questionText']}", h2_style))
        story.append(Paragraph(f"<b>Candidate Answer:</b> {ans['answerText']}", body_style))
        story.append(Spacer(1, 5))
        
        # Dimension Scores Table
        score_table_data = [
            ['Dimension', 'Score Earned', 'Max Score', 'Feedback Summary'],
            ['STAR Structure', f"{score['starScore']}/25", '25', feedback.get('star', {}).get('action', 'Structured STAR response')],
            ['Technical Depth', f"{score['techDepthScore']}/25", '25', 'Quality of algorithms and architectural discussion'],
            ['Communication', f"{score['commScore']}/20", '20', f"Found overused filler words: {', '.join(feedback.get('fillerWords', [])) or 'None'}"],
            ['Relevance', f"{score['relevanceScore']}/15", '15', 'Direct focus on problem constraints'],
            ['Confidence', f"{score['confidenceScore']}/10", '10', 'Assertive presentation style'],
            ['Conciseness', f"{score['concisenessScore']}/5", '5', f"{ans['wordCount']} words response length"],
            ['Overall Evaluated', f"{score['overallScore']}/100", '100', 'Aggregated scoring criteria']
        ]
        
        t_scores = Table(score_table_data, colWidths=[120, 80, 70, 230])
        t_scores.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f3f4f6')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1f2937')),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 9),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
            ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
            ('FONTSIZE', (0,1), (-1,-1), 8.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t_scores)
        story.append(Spacer(1, 10))
        
        # Strength & Weakness Bullet Points
        story.append(Paragraph(f"<b>Top Strength:</b> {feedback.get('topStrength', 'N/A')}", body_style))
        story.append(Paragraph(f"<b>Top Weakness:</b> {feedback.get('topWeakness', 'N/A')}", body_style))
        story.append(Paragraph(f"<b>Ideal Approach Structure:</b> {feedback.get('idealAnswerSkeleton', 'N/A')}", body_style))
        story.append(Spacer(1, 15))
        
    story.append(PageBreak())
    
    # --- FINAL PAGE: RESOURCES ---
    story.append(Paragraph("Recommended Training Resources", h1_style))
    story.append(Paragraph("Based on your weakest performance metrics, we recommend focusing on the following areas:", body_style))
    story.append(Spacer(1, 10))
    
    # Choose resources depending on weak score dimensions
    resources_data = [
        [Paragraph("<b>STAR Method Coach</b>", bold_body_style), Paragraph("Review instructions on STAR storytelling structures. Focus on framing Actions clearly with first-person ownership.", body_style)],
        [Paragraph("<b>System Design Primer</b>", bold_body_style), Paragraph("Read references on scalable systems, caching configs, load balancing, message broker integration, and SQL query tuning.", body_style)],
        [Paragraph("<b>Technical Coding Patterns</b>", bold_body_style), Paragraph("Practice algorithm complexity trade-offs, dynamic programming, and vector array indexing.", body_style)],
        [Paragraph("<b>Mock Verbal Drills</b>", bold_body_style), Paragraph("Record yourself answering behavioral prompts. Focus on eliminating filler words like 'basically' and speaking assertively.", body_style)]
    ]
    
    t_res = Table(resources_data, colWidths=[140, 360])
    t_res.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#f3f4f6')),
    ]))
    story.append(t_res)
    
    doc.build(story)

def run_worker():
    """Listens on Redis channel and builds PDF report."""
    logger.info("PDF generation worker is running and subscribing to channel 'pdf:generate'...")
    pubsub = redis_client.pubsub()
    pubsub.subscribe("pdf:generate")
    
    for message in pubsub.listen():
        if message["type"] != "message":
            continue
            
        try:
            data = json.loads(message["data"].decode("utf-8"))
            session_id = data.get("session_id")
            user_id = data.get("user_id")
            
            logger.info(f"Received PDF generation job for session {session_id}")
            
            # 1. Fetch Session Data
            session = fetch_session_data(session_id)
            if not session:
                logger.error(f"Session {session_id} not found in DB")
                continue
                
            # 2. Call FastAPI for report summary
            questions_scores = []
            for q in session["questions"]:
                if q["answer"] and q["answer"]["score"]:
                    questions_scores.append({
                        "question": q["questionText"],
                        "score": q["answer"]["score"]["overallScore"]
                    })
                    
            # Calculate dimension averages for the prompt
            total_star = sum(q["answer"]["score"]["starScore"] for q in session["questions"] if q["answer"] and q["answer"]["score"])
            total_tech = sum(q["answer"]["score"]["techDepthScore"] for q in session["questions"] if q["answer"] and q["answer"]["score"])
            total_comm = sum(q["answer"]["score"]["commScore"] for q in session["questions"] if q["answer"] and q["answer"]["score"])
            total_rel = sum(q["answer"]["score"]["relevanceScore"] for q in session["questions"] if q["answer"] and q["answer"]["score"])
            total_conf = sum(q["answer"]["score"]["confidenceScore"] for q in session["questions"] if q["answer"] and q["answer"]["score"])
            total_conc = sum(q["answer"]["score"]["concisenessScore"] for q in session["questions"] if q["answer"] and q["answer"]["score"])
            score_count = sum(1 for q in session["questions"] if q["answer"] and q["answer"]["score"])
            
            dim_avgs = {
                "star": total_star / score_count if score_count > 0 else 0,
                "techDepth": total_tech / score_count if score_count > 0 else 0,
                "comm": total_comm / score_count if score_count > 0 else 0,
                "relevance": total_rel / score_count if score_count > 0 else 0,
                "confidence": total_conf / score_count if score_count > 0 else 0,
                "conciseness": total_conc / score_count if score_count > 0 else 0
            }
            
            session_data = {
                "role": session["role"],
                "interview_type": session["interviewType"],
                "overall_score": session["overallScore"],
                "questions_and_scores": questions_scores,
                "dimension_averages": dim_avgs
            }
            
            summary_data = {
                "executive_summary": "The candidate has demonstrated a solid grasp of technical concepts and structured behavioral communication. Action steps are recommended to optimize performance further.",
                "action_plan": [
                    "Practice technical depth by discussing system components explicitly.",
                    "Strengthen STAR actions by taking first-person ownership.",
                    "Verify result metrics by adding percentages.",
                    "Pace communication by removing verbal crutches.",
                    "Optimize conciseness by keeping answers around 200 words."
                ]
            }
            
            try:
                response = requests.post(
                    f"{ai_service_url}/ai/report-summary",
                    headers={"Content-Type": "application/json"},
                    json={"session_data": session_data},
                    timeout=15
                )
                if response.status_code == 200:
                    summary_data = response.json()
            except Exception as e:
                logger.error(f"Error fetching report summary from AI service: {e}. Using fallback summary.")

            # 3. Generate Matplotlib Charts
            radar_path = generate_radar_chart(session_id, dim_avgs)
            bar_path = generate_bar_chart(session_id, session["questions"])
            
            # 4. Compile PDF Report
            pdf_path = f"/tmp/{session_id}.pdf"
            build_pdf(session, summary_data, radar_path, bar_path, pdf_path)
            
            # 5. Upload PDF to storage (Mock local or Real S3)
            s3_key = f"reports/{user_id}/{session_id}.pdf"
            
            if is_mock_s3:
                # Save locally in the API local_storage folder so GET /download-local can serve it!
                api_storage_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "api", "local_storage")
                os.makedirs(api_storage_dir, exist_ok=True)
                dest_local_path = os.path.join(api_storage_dir, s3_key.replace("/", "_"))
                
                with open(pdf_path, "rb") as f_src:
                    with open(dest_local_path, "wb") as f_dest:
                        f_dest.write(f_src.read())
                        
                logger.info(f"[Mock S3] Uploaded report locally to: {dest_local_path}")
            else:
                try:
                    s3 = boto3.client(
                        "s3",
                        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
                        region_name=os.environ.get("AWS_REGION", "us-east-1")
                    )
                    s3.upload_file(pdf_path, bucket_name, s3_key, ExtraArgs={'ContentType': 'application/pdf'})
                    logger.info(f"Successfully uploaded PDF report to S3 bucket {bucket_name} at key {s3_key}")
                except Exception as s3_err:
                    logger.error(f"S3 Upload failed: {s3_err}")
            
            # 6. Update database session reportS3Key
            with engine.connect() as conn:
                conn.execute(
                    text('UPDATE "Session" SET "reportS3Key" = :key WHERE id = :sid'),
                    {"key": s3_key, "sid": session_id}
                )
                conn.commit()
                logger.info(f"Successfully updated database session {session_id} with report key: {s3_key}")
                
            # Clean up temp files
            for p in [radar_path, bar_path, pdf_path]:
                if os.path.exists(p):
                    os.remove(p)
                    
        except Exception as err:
            logger.error(f"Error processing PDF generation: {err}")

if __name__ == "__main__":
    while True:
        try:
            run_worker()
        except Exception as e:
            logger.error(f"Worker crashed with error: {e}. Restarting in 5 seconds...")
            time.sleep(5)
