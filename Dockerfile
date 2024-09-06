FROM python:3.9

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY frontend/build/ /app/static/

CMD ["flask", "run", "--host=0.0.0.0"]