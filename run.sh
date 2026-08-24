#!/usr/bin/env bash
echo "Starting CineMetrics AI Box Office Prediction Engine..."
python3 -m pip install -r requirements.txt
if [ ! -f "models/movie_predictor.joblib" ]; then
    echo "Training ML models..."
    python3 train_model.py
fi
echo "Launching FastAPI server on http://localhost:8000"
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
