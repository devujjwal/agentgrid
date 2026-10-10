FROM python:3.13-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.py /app/server.py
USER 65534:65534
EXPOSE 8080
CMD ["python", "/app/server.py"]
