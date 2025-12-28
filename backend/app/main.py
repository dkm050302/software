from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import note_assistant, map_generation, error_book, dashboard, parent_view, auth, admin
from app.database import engine
from app import models
from app.routers import map_save


# Create Database Tables
models.Base.metadata.create_all(bind=engine)
app = FastAPI(
    title="AI Tutor API",
    description="Backend for AI Tutor Application",
    version="1.0.0"
)
app.include_router(map_save.router, prefix="/api/maps", tags=["maps"])


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

# Include Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(note_assistant.router, prefix="/api/notes", tags=["Note Assistant"])
app.include_router(map_generation.router, prefix="/api/maps", tags=["Map Generation"])
app.include_router(error_book.router, prefix="/api/errors", tags=["Error Book"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(parent_view.router, prefix="/api/parents", tags=["Parent View"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

@app.get("/")
async def root():
    return {"message": "Welcome to AI Tutor API"}
