@echo off
echo =======================================================
echo   Starting CineMetrics AI Box Office Prediction Engine
echo =======================================================
echo Checking Python environment...
python -c "import fastapi, uvicorn, sklearn, pandas, joblib; print('All dependencies verified!')"
if %errorlevel% neq 0 (
    echo Installing missing requirements...
    python -m pip install -r requirements.txt
)
if not exist "models\movie_predictor.joblib" (
    echo Training initial ML models...
    python train_model.py
)
echo Launching CineMetrics AI Web Server...
echo Visit: http://localhost:8000
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
pause
