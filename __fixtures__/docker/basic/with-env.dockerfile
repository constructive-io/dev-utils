FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
ENV APP_HOME=/app
WORKDIR ${APP_HOME}
ARG VERSION=1.0.0
LABEL version=${VERSION}
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
USER nobody
ENTRYPOINT ["python", "app.py"]
