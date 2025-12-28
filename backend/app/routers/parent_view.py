from fastapi import APIRouter
from app.services.llm_service import llm_service

router = APIRouter()

@router.get("/report")
async def get_parent_report():
    # Mock student data retrieval
    student_data = {"recent_grades": [90, 85], "activity": "High"}
    
    report = await llm_service.generate_parent_report(student_data)
    return {"report": report}
