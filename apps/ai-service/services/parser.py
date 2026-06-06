import os
import logging
import pdfplumber
import boto3
from botocore.exceptions import NoCredentialsError

logger = logging.getLogger(__name__)

def extract_text_from_pdf(file_path: str) -> str:
    """Extracts text from a local PDF file using pdfplumber."""
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Failed to extract PDF text from {file_path}: {e}")
        raise e

def get_file_text(s3_key: str) -> str:
    """Gets the raw text of a file. In mock/local mode, it reads from local storage."""
    is_mock = os.environ.get("AWS_ACCESS_KEY_ID") == "mock" or not os.environ.get("AWS_ACCESS_KEY_ID")
    
    if is_mock:
        # In mock mode, files are written to the Fastify API folder 'local_storage'.
        # Since they are run in the same root workspace, we can find it in ../api/local_storage
        # or ./local_storage (if started from docker / same directory).
        # Let's check a few standard relative paths:
        possible_paths = [
            path for path in [
                os.path.join(os.getcwd(), "local_storage", s3_key.replace("/", "_")),
                os.path.join(os.getcwd(), "..", "api", "local_storage", s3_key.replace("/", "_")),
                os.path.join(os.path.dirname(os.getcwd()), "api", "local_storage", s3_key.replace("/", "_")),
                os.path.join("C:\\Users\\swaya\\OneDrive\\Desktop\\ai\\techprep-ai\\apps\\api\\local_storage", s3_key.replace("/", "_"))
            ]
        ]
        
        file_path = None
        for p in possible_paths:
            if os.path.exists(p):
                file_path = p
                break
                
        if not file_path:
            logger.error(f"Local file not found for key {s3_key}. Paths searched: {possible_paths}")
            # Fallback text
            return "Mock Candidate Resume Profile. Skills: JavaScript, React, Python, Node.js."

        if file_path.lower().endswith(".pdf"):
            return extract_text_from_pdf(file_path)
        else:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
    else:
        # Real S3 download
        bucket_name = os.environ.get("S3_BUCKET_NAME", "techprep-ai-reports")
        try:
            s3 = boto3.client(
                "s3",
                aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
                region_name=os.environ.get("AWS_REGION", "us-east-1")
            )
            # Download file locally to a temp path to extract text
            temp_path = f"/tmp/{s3_key.replace('/', '_')}"
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            s3.download_file(bucket_name, s3_key, temp_path)
            
            if temp_path.lower().endswith(".pdf"):
                text = extract_text_from_pdf(temp_path)
            else:
                with open(temp_path, "r", encoding="utf-8") as f:
                    text = f.read()
            
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return text
        except Exception as e:
            logger.error(f"S3 download failed for key {s3_key}: {e}")
            raise e
BlockContent = """
"""
