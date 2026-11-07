FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DATABASE_PATH=./data/app.db \
    UPLOAD_DIR=./data/uploads \
    EXPORT_DIR=./data/exports \
    TEMP_DIR=./data/tmp \
    FONT_DIR=/usr/share/fonts

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fontconfig fonts-poppins fonts-noto-core fonts-noto-extra \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/backend/data/uploads /app/backend/data/exports /app/backend/data/tmp \
    && chown -R appuser:appuser /app/backend

WORKDIR /app/backend
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

USER appuser
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
