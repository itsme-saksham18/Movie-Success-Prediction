import os
import json
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model_service import MoviePredictionService

app = FastAPI(
    title="CineMetrics AI - Movie Success & Box Office Prediction Engine",
    description="Full-stack Machine Learning web application for predicting movie revenue, success tiers, comparable film analysis, and scenario simulation.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)
os.makedirs("templates", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Initialize ML Service
service = MoviePredictionService()

# Pydantic Schemas
class PredictionRequest(BaseModel):
    title: Optional[str] = Field(default="Untitled Film", description="Working title")
    genres: List[str] = Field(default=["Action", "Adventure"], description="List of genres")
    director: Optional[str] = Field(default="", description="Director name")
    actors: Optional[List[str]] = Field(default=[], description="List of primary lead actors")
    runtime: float = Field(default=120.0, ge=45.0, le=300.0, description="Runtime in minutes")
    rating: float = Field(default=7.0, ge=1.0, le=10.0, description="Anticipated IMDb Rating")
    metascore: float = Field(default=60.0, ge=0.0, le=100.0, description="Anticipated Metascore (0-100)")
    votes: int = Field(default=100000, ge=100, le=3000000, description="Estimated IMDb votes / Audience reach")
    year: int = Field(default=2024, ge=2000, le=2030, description="Release Year")

class WhatIfRequest(BaseModel):
    base_input: PredictionRequest
    variations: Dict[str, Any]

# Curated Presets
PRESETS = [
    {
        "id": "scifi_epic",
        "name": "Intergalactic Sci-Fi Epic",
        "description": "Big-budget sci-fi spectacle with world-class visual effects, high concept runtime, and acclaimed director.",
        "icon": "fa-rocket",
        "badge": "Blockbuster Archetype",
        "data": {
            "title": "Cosmic Horizon",
            "genres": ["Action", "Adventure", "Sci-Fi"],
            "director": "Christopher Nolan",
            "actors": ["Matthew McConaughey", "Anne Hathaway", "Michael Caine"],
            "runtime": 155,
            "rating": 8.5,
            "metascore": 78,
            "votes": 850000,
            "year": 2024
        }
    },
    {
        "id": "marvel_superhero",
        "name": "Comic Book Superhero Tentpole",
        "description": "High-octane crowd-pleaser with broad multi-generational appeal, massive marketing reach, and ensemble cast.",
        "icon": "fa-mask",
        "badge": "Tentpole Franchise",
        "data": {
            "title": "Avenger Vanguard",
            "genres": ["Action", "Adventure", "Sci-Fi"],
            "director": "Joss Whedon",
            "actors": ["Robert Downey Jr.", "Chris Evans", "Scarlett Johansson"],
            "runtime": 142,
            "rating": 8.0,
            "metascore": 69,
            "votes": 920000,
            "year": 2024
        }
    },
    {
        "id": "indie_drama",
        "name": "A24-Style Award Contender",
        "description": "Prestige emotional drama targeted for film festivals, critical acclaim, and Oscar season longevity.",
        "icon": "fa-trophy",
        "badge": "Prestige Indie",
        "data": {
            "title": "Whispers of Autumn",
            "genres": ["Drama", "Romance"],
            "director": "Damien Chazelle",
            "actors": ["Ryan Gosling", "Emma Stone"],
            "runtime": 118,
            "rating": 8.2,
            "metascore": 88,
            "votes": 180000,
            "year": 2024
        }
    },
    {
        "id": "horror_phenom",
        "name": "Psychological Horror Hit",
        "description": "High-concept suspense thriller with intense social media virality, rapid word-of-mouth, and high profit margin.",
        "icon": "fa-ghost",
        "badge": "High ROI Thriller",
        "data": {
            "title": "The Hollow Room",
            "genres": ["Horror", "Mystery", "Thriller"],
            "director": "M. Night Shyamalan",
            "actors": ["James McAvoy", "Anya Taylor-Joy"],
            "runtime": 104,
            "rating": 7.4,
            "metascore": 66,
            "votes": 220000,
            "year": 2024
        }
    },
    {
        "id": "animated_family",
        "name": "Pixar / Illumination Family Hit",
        "description": "Vibrant 3D animation appealing to families, international markets, and merchandise tie-ins.",
        "icon": "fa-wand-magic-sparkles",
        "badge": "Family Blockbuster",
        "data": {
            "title": "Chronicles of Whispering Forest",
            "genres": ["Animation", "Adventure", "Comedy"],
            "director": "Chris Renaud",
            "actors": ["Matthew McConaughey", "Reese Witherspoon", "Kevin Hart"],
            "runtime": 98,
            "rating": 7.6,
            "metascore": 72,
            "votes": 160000,
            "year": 2024
        }
    },
    {
        "id": "action_thriller",
        "name": "Gritty Action Thriller",
        "description": "Fast-paced revenge or espionage thriller with intense choreography and established action star.",
        "icon": "fa-crosshairs",
        "badge": "Action Mainstay",
        "data": {
            "title": "Shadow Protocol",
            "genres": ["Action", "Crime", "Thriller"],
            "director": "David Ayer",
            "actors": ["Matt Damon", "Tom Hardy"],
            "runtime": 115,
            "rating": 6.9,
            "metascore": 55,
            "votes": 140000,
            "year": 2024
        }
    }
]

@app.get("/", response_class=HTMLResponse)
async def serve_home(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "metadata": service.metadata,
        "presets": PRESETS
    })

@app.post("/api/predict")
async def predict_movie(req: PredictionRequest):
    try:
        res = service.predict(
            title=req.title,
            genres=req.genres,
            director=req.director,
            actors=req.actors,
            runtime=req.runtime,
            rating=req.rating,
            metascore=req.metascore,
            votes=req.votes,
            year=req.year
        )
        return JSONResponse(content={"status": "success", "data": res})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/what-if")
async def what_if_simulation(req: WhatIfRequest):
    try:
        base_dict = req.base_input.model_dump()
        res = service.what_if(base_dict, req.variations)
        return JSONResponse(content={"status": "success", "data": res})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/movies")
async def list_movies(
    query: str = Query(default="", description="Search query"),
    genre: str = Query(default="All", description="Filter genre"),
    sort_by: str = Query(default="Revenue (Millions)", description="Sort column"),
    sort_order: str = Query(default="desc", description="Sort order asc/desc"),
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=12, ge=1, le=50, description="Items per page")
):
    try:
        res = service.search_movies(query, genre, sort_by, sort_order, page, per_page)
        return JSONResponse(content={"status": "success", "data": res})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats():
    return JSONResponse(content={"status": "success", "data": service.get_stats_data()})

@app.get("/api/presets")
async def get_presets():
    return JSONResponse(content={"status": "success", "data": PRESETS})

@app.get("/api/autocomplete")
async def get_autocomplete(q: str = Query(default="", description="Search term")):
    q_low = q.lower().strip()
    directors = [d["name"] for d in service.metadata.get("top_directors", []) if not q_low or q_low in d["name"].lower()]
    actors = [a["name"] for a in service.metadata.get("top_actors", []) if not q_low or q_low in a["name"].lower()]
    genres = [g for g in service.metadata.get("all_genres", []) if not q_low or q_low in g.lower()]
    return JSONResponse(content={
        "status": "success",
        "data": {
            "directors": directors[:15],
            "actors": actors[:20],
            "genres": genres
        }
    })

@app.get("/api/model-info")
async def get_model_info():
    return JSONResponse(content={
        "status": "success",
        "data": {
            "architecture": "Ensemble Regressor (Random Forest + Gradient Boosting) with Bayesian Target-Encoded Priors & Cosine Nearest-Neighbors",
            "metrics": service.metadata.get("model_metrics", {}),
            "feature_importances": service.metadata.get("feature_importances", []),
            "tier_distribution": service.metadata.get("tier_distribution", {})
        }
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
