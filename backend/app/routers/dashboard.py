from fastapi import APIRouter

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats():
    # Mock data
    return {
        "study_hours": 12.5,
        "skills": {"Math": 80, "English": 60},
        "progress": 75
    }
