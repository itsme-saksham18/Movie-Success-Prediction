# CineMetrics.AI - Movie Success & Box Office Prediction Engine

A production-grade, full-stack Machine Learning web application designed to forecast theatrical box office revenue, predict commercial success tiers, perform interactive what-if sensitivity simulations, and surface historical comparable benchmarks.

![Python](https://img.shields.io/badge/Python-3.11%2B-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)
![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.7%2B-F7931E?logo=scikit-learn&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)
![ML Performance](https://img.shields.io/badge/Model_R%C2%B2-83.63%25-brightgreen)

---

## 🌟 Key Highlights & Features

### 1. 🔮 AI Box Office Predictor
- **Ensemble Regression ($M Revenue)**: Powered by a stacked ensemble of **Tuned Random Forest Regressors** and **Gradient Boosted Decision Trees** achieving an **$R^2$ of 0.8363** and Mean Absolute Error (MAE) of **$22.92M**.
- **Commercial Success Tier Classification**: Multi-class classification model categorizing projects into **Blockbuster** ($\ge \$150\text{M}$), **Hit** ($\$70\text{M} - \$150\text{M}$), **Moderate Success** ($\$25\text{M} - \$70\text{M}$), and **Flop / Niche** ($< \$25\text{M}$) with **80.5% validation accuracy**.
- **Commercial Viability Index (0-100)**: Non-linear composite index evaluating overall financial appeal.
- **Empirical Bayesian Prior Smoothing**: Eliminates overfitting on debut/single-film directors and actors using Bayesian target encoding ($m=2.0$).
- **Key Revenue Drivers (Explainability)**: Transparent attribution breakdown explaining what positive/negative factors contributed to the forecast.
- **Nearest-Neighbor Historical Comparables**: Uses Cosine distance over normalized high-dimensional embeddings to match the top 4 most similar historical movies from the 1,000-film dataset.

### 2. 🎛️ What-If Sensitivity Simulator
- Live real-time sliders allowing creators, studios, and analysts to simulate:
  - *"What if critical Metascore shifts by $\pm 15$ points?"*
  - *"What if organic audience hype/votes doubles?"*
  - *"What if runtime is trimmed or expanded?"*
- Computes dynamic net dollar delta, percentage shift, and renders live sensitivity curves.

### 3. 📊 Box Office Visualizations & Analytics
- Interactive **Chart.js** data intelligence:
  - **Highest Grossing Genres** (Average Box Office Gross)
  - **Success Tier Distribution** (Breakdown across 1,000 films)
  - **Top Grossing Directors Leaderboard**
  - **IMDb Rating vs Box Office Revenue** scatter visualization

### 4. 🎬 Movie Dataset Explorer
- Searchable and filterable database of 1,000 top films.
- Multi-column sorting (Revenue, Rating, Votes, Metascore, Runtime, Year).
- Detailed film modal with complete metadata, crew, synopsis, and financial figures.

### 5. ⚡ Pre-Configured Archetype Presets
- 1-Click instant autofill presets:
  - *Intergalactic Sci-Fi Epic* (e.g., Nolan style)
  - *Comic Book Superhero Tentpole* (Marvel style)
  - *A24-Style Award Contender* (Indie festival drama)
  - *Psychological Horror Hit* (Blumhouse / Shyamalan style)
  - *Pixar / Illumination Family Hit* (3D animated blockbuster)
  - *Gritty Action Thriller*

---

## 🏗️ Technical Architecture

```
Movie-Success-Prediction/
├── app.py                      # FastAPI web server and REST endpoints
├── train_model.py              # ML Training pipeline & metric evaluation
├── model_service.py            # Model inference, what-if, explainability & nearest-neighbor matching
├── requirements.txt            # Python dependencies
├── movies.csv                  # Dataset (1,000 top IMDb movies with revenues & metascores)
├── models/
│   ├── movie_predictor.joblib  # Serialized model bundle (RF, GBR, Classifier, Scaler, Maps)
│   ├── dataset_metadata.json   # Precomputed benchmarks, top directors/actors, genre stats
│   └── movies_enhanced.csv     # Processed and enriched dataset
├── templates/
│   └── index.html              # Modern, responsive Single-Page UI
├── static/
│   ├── css/custom.css          # Glassmorphism dark-theme styling
│   └── js/app.js               # Frontend application state, API connectors, live charts
├── run.bat                     # Windows one-click start script
└── run.sh                      # Linux / macOS start script
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python 3.10+**

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Train / Verify ML Models
```bash
python train_model.py
```

### 3. Launch Web Server
```bash
# Windows
run.bat

# Or directly with Python / Uvicorn
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Open in Browser
Navigate to: **`http://localhost:8000`**  
Interactive Swagger API documentation: **`http://localhost:8000/docs`**

---

## 📡 REST API Documentation

| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET` | Serves the Single-Page Application |
| `/api/predict` | `POST` | Generates revenue forecast, success tier, score, and comparables |
| `/api/what-if` | `POST` | Computes sensitivity simulation and margin deltas |
| `/api/movies` | `GET` | Searchable, paginated movie list with filters and sorting |
| `/api/stats` | `GET` | Dataset macro statistics and chart series |
| `/api/presets` | `GET` | Pre-built archetype configurations |
| `/api/autocomplete`| `GET` | Auto-complete suggestions for directors, cast, and genres |
| `/api/model-info` | `GET` | Model validation metrics and feature importances |

---

## 📊 Machine Learning Model Benchmarks

| Metric | Random Forest | Gradient Boosting | Stacked Ensemble |
|---|---|---|---|
| **$R^2$ Score** | 0.8258 | 0.8342 | **0.8363 (83.6%)** |
| **MAE ($M)** | $22.97M | $23.70M | **$22.92M** |
| **RMSE ($M)** | $40.36M | $39.37M | **$39.37M** |
| **Tier Classifier Accuracy** | — | — | **80.50%** |

---

## 📜 License
MIT License. Open for educational and commercial exploration.
