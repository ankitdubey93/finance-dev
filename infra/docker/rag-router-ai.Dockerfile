# FastAPI AI service for the RAG Router (routing + synthesis + retrieval).
FROM python:3.12-slim

WORKDIR /app

# System deps kept minimal; psycopg[binary] ships its own libpq.
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY apps/rag-router-ai/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY apps/rag-router-ai/app ./app

EXPOSE 8101
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8101"]
