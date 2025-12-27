from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path
from app.routers import note_assistant, map_generation, error_book, dashboard, parent_view, auth, admin, syllabus
from app.database import engine
from app import models
from app.services import data_sync
from contextlib import asynccontextmanager

# Create Database Tables
models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    data_sync.start_scheduler()
    yield
    # Shutdown

app = FastAPI(
    title="AI Tutor API",
    description="Backend for AI Tutor Application",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
origins = [
    "http://localhost:5173", # Vite default
    "http://localhost:3000", # React default
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files
# Ensure uploads directory exists
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
if not UPLOADS_DIR.exists():
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Include Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(note_assistant.router, prefix="/api/notes", tags=["Note Assistant"])
app.include_router(map_generation.router, prefix="/api/maps", tags=["Map Generation"])
app.include_router(error_book.router, prefix="/api/errors", tags=["Error Book"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(parent_view.router, prefix="/api/parents", tags=["Parent View"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(syllabus.router, prefix="/api/syllabus", tags=["Syllabus"])

@app.get("/")
async def root():
    return {"message": "Welcome to AI Tutor API"}
