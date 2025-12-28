from fastapi import APIRouter, UploadFile, File
from app.services.ocr_service import ocr_service
from app.services.llm_service import llm_service

router = APIRouter()

@router.post("/upload-problem")
async def upload_problem(file: UploadFile = File(...)):
    # 1. OCR
    problem_text = ocr_service.extract_text(file)
    
    # 2. Analyze
    analysis = await llm_service.analyze_question(problem_text)
    
    return {"text": problem_text, "analysis": analysis}
