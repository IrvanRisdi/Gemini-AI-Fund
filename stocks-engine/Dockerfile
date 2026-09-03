FROM python:3.12-slim

WORKDIR /app
COPY . /app

ENV NQ_ENV=production \
    NQ_HOST=0.0.0.0 \
    PORT=4173 \
    NQ_DATA_DIR=/data \
    NQ_DEMO_MODE=false \
    NQ_PAPER_ONLY=true \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

VOLUME ["/data"]
EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4173/api/health', timeout=3).read()"]
CMD ["python", "server.py"]
