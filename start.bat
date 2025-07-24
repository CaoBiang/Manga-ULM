@echo off
ECHO Starting Manga-ULM services...
ECHO Three new command prompt windows will be opened.
ECHO Please keep them open to run the application.
ECHO To stop the services, close all three new windows.

REM Activate virtual environment
ECHO Activating virtual environment...
call .venv\Scripts\activate.bat

REM Set FLASK_APP environment variable for this session
set FLASK_APP=main:app

REM Add the backend directory to PYTHONPATH to ensure modules are found
set PYTHONPATH=%cd%\backend

REM Initialize or update the database
ECHO Initializing database...
flask db upgrade

REM Start Backend Services
ECHO Starting backend...
start "Huey Worker (keep open)" cmd /k "call .venv\Scripts\activate.bat && huey_consumer main.huey"
start "Flask API (keep open)" cmd /k "call .venv\Scripts\activate.bat && cd backend && gunicorn --workers 4 --worker-class eventlet --bind 0.0.0.0:5000 main:app"

REM Start Frontend Service
ECHO Starting frontend...
start "Vite Frontend" cmd /k "cd frontend && echo --- VITE FRONTEND SERVER --- && npm install && npm run dev"

ECHO All services launched.
ECHO You can now access the application at http://127.0.0.1:5173
timeout /t 10 > nul 