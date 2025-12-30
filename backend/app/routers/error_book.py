from fastapi import APIRouter, UploadFile, File, HTTPException, Body, Depends, Form, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
import os
import json
import shutil
import re
from datetime import datetime
from app.services.ocr_service import ocr_service
from app.services.llm_service import llm_service
from app import models, schemas
from app.dependencies import get_db, get_current_user

router = APIRouter()

class AnalyzeRequest(BaseModel):
    text: str

@router.get("/knowledge-tags")
def get_knowledge_tags():
    """Get knowledge tags from cache"""
    cache_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data_cache", "knowledge_tags.json")
    if os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

@router.get("/filters")
def get_mistake_filters(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """Get filter options based on student's existing mistakes"""
    if current_user_data["user_type"] != "student":
        raise HTTPException(status_code=403, detail="Only students can access their filters")
    
    user = current_user_data["user"]
    
    # Fetch all mistakes for the student to extract tags
    # We only need subject, chapter, knowledge_point columns
    mistakes = db.query(
        models.LearningMistake.subject,
        models.LearningMistake.chapter,
        models.LearningMistake.knowledge_point
    ).filter(
        models.LearningMistake.student_id == user.student_id
    ).all()
    
    filters = []
    for m in mistakes:
        # Parse knowledge points
        kps = []
        if m.knowledge_point:
            try:
                parsed = json.loads(m.knowledge_point)
                if isinstance(parsed, list):
                    kps = parsed
                else:
                    kps = [str(parsed)]
            except:
                kps = [kp.strip() for kp in m.knowledge_point.split(',') if kp.strip()]
        
        # If no KPs, still add the subject/chapter structure
        if not kps:
            filters.append({
                "subject": m.subject,
                "chapter": m.chapter,
                "knowledge_point": None
            })
        else:
            for kp in kps:
                filters.append({
                    "subject": m.subject,
                    "chapter": m.chapter,
                    "knowledge_point": kp
                })
                
    return filters

@router.post("/mistakes")
async def create_mistake(
    subject: str = Form(...),
    chapter: str = Form(...),
    knowledge_point: str = Form(...), # Expecting JSON string of list or comma separated
    content: str = Form(...),
    note: str = Form(...),
    date: str = Form(...),
    graph_1: UploadFile = File(...),
    graph_2: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    user = current_user_data["user"]
    if current_user_data["user_type"] != "student":
        raise HTTPException(status_code=403, detail="Only students can create mistakes")

    # Save images
    upload_dir = "uploads/mistakes"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filenames
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    
    # Sanitize filename (remove path separators and other dangerous characters)
    def sanitize_filename(filename):
        if not filename:
            return "image"
        # Remove path separators and other dangerous characters
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        return filename[:100]  # Limit length
    
    graph_1_filename = sanitize_filename(graph_1.filename)
    # Store relative path without 'uploads/' prefix for cleaner URL construction
    graph_1_path = f"{upload_dir}/{user.student_id}_{timestamp}_1_{graph_1_filename}"
    graph_1_db_path = f"mistakes/{user.student_id}_{timestamp}_1_{graph_1_filename}"
    
    try:
        with open(graph_1_path, "wb") as buffer:
            shutil.copyfileobj(graph_1.file, buffer)
    except Exception as e:
        print(f"Error saving graph_1: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")
        
    graph_2_path = None
    graph_2_db_path = None
    if graph_2:
        graph_2_filename = sanitize_filename(graph_2.filename)
        graph_2_path = f"{upload_dir}/{user.student_id}_{timestamp}_2_{graph_2_filename}"
        graph_2_db_path = f"mistakes/{user.student_id}_{timestamp}_2_{graph_2_filename}"
        try:
            with open(graph_2_path, "wb") as buffer:
                shutil.copyfileobj(graph_2.file, buffer)
        except Exception as e:
            print(f"Error saving graph_2: {e}")
            # If graph_2 fails, we can still save the mistake with just graph_1
            graph_2_path = None
            graph_2_db_path = None

    # Parse date
    try:
        mistake_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
    except ValueError:
        mistake_date = datetime.now()

    # Generate Tip using LLM (with error handling)
    tip = None
    try:
        tip = await llm_service.generate_mistake_tip(content, subject)
    except Exception as e:
        import traceback
        error_msg = f"Error generating tip for mistake (student_id: {user.student_id}, subject: {subject}): {str(e)}"
        print(error_msg)
        print(f"Traceback: {traceback.format_exc()}")
        # 如果LLM服务失败，使用默认tip，不影响错题保存
        tip = f"这是一道{subject}题目分析：无法生成分析结果。难度：?/10"

    # Create DB entry
    # Note: ID is auto-incremented by database
    # Store relative path without 'uploads/' prefix for cleaner URL construction
    mistake = models.LearningMistake(
        student_id=user.student_id,
        date=mistake_date,
        subject=subject,
        chapter=chapter,
        knowledge_point=knowledge_point,
        content=content,
        note=note,
        tip=tip,
        graph_1=graph_1_db_path,
        graph_2=graph_2_db_path
    )
    
    try:
        db.add(mistake)
        db.commit()
        db.refresh(mistake)
    except Exception as e:
        db.rollback()
        # 如果数据库操作失败，尝试删除已保存的图片
        try:
            if os.path.exists(graph_1_path):
                os.remove(graph_1_path)
            if graph_2_path and os.path.exists(graph_2_path):
                os.remove(graph_2_path)
        except:
            pass
        print(f"Error saving mistake to database: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save mistake: {str(e)}")
    
    return {"message": "Mistake created successfully", "id": mistake.id}

@router.post("/ocr")
async def ocr_problem(file: UploadFile = File(...)):
    print(f"Received OCR request: {file.filename}")
    try:
        # 1. OCR
        problem_text = await ocr_service.extract_text(file)
        print(f"OCR Result: {problem_text[:50]}...")
        return {"text": problem_text}
    except Exception as e:
        print(f"Error in ocr_problem: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
async def analyze_problem(request: AnalyzeRequest):
    print(f"Received analysis request")
    try:
        # 2. Analyze
        analysis = await llm_service.analyze_question(request.text)
        return {"analysis": analysis}
    except Exception as e:
        print(f"Error in analyze_problem: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
def get_mistakes(
    subject: Optional[str] = None,
    chapter: Optional[str] = None,
    knowledge_points: Optional[str] = None, # Comma separated or JSON string
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    if current_user_data["user_type"] != "student":
        raise HTTPException(status_code=403, detail="Only students can view their mistakes")
    
    user = current_user_data["user"]
    query = db.query(models.LearningMistake).filter(models.LearningMistake.student_id == user.student_id)
    
    if subject:
        query = query.filter(models.LearningMistake.subject == subject)
    if chapter:
        query = query.filter(models.LearningMistake.chapter == chapter)
        
    mistakes = query.all()
    
    # Filter by knowledge points in Python
    if knowledge_points:
        try:
            # Try parsing as JSON first
            kp_filter = json.loads(knowledge_points)
            if not isinstance(kp_filter, list):
                kp_filter = [knowledge_points]
        except:
            # Fallback to comma separated
            kp_filter = [kp.strip() for kp in knowledge_points.split(',') if kp.strip()]
            
        if kp_filter:
            filtered_mistakes = []
            for m in mistakes:
                if not m.knowledge_point:
                    continue
                try:
                    # Parse stored knowledge points
                    # It might be stored as JSON string or plain string
                    try:
                        m_kps = json.loads(m.knowledge_point)
                        if not isinstance(m_kps, list):
                            m_kps = [m.knowledge_point]
                    except:
                        m_kps = [kp.strip() for kp in m.knowledge_point.split(',') if kp.strip()]
                    
                    # Check if all filter tags are present in the mistake's tags
                    if set(kp_filter).issubset(set(m_kps)):
                        filtered_mistakes.append(m)
                except Exception as e:
                    print(f"Error parsing knowledge point for mistake {m.id}: {e}")
                    continue
            mistakes = filtered_mistakes

    return mistakes

class MistakeUpdate(BaseModel):
    content: Optional[str] = None
    note: Optional[str] = None

@router.put("/{mistake_id}")
def update_mistake(
    mistake_id: int,
    update_data: MistakeUpdate,
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    if current_user_data["user_type"] != "student":
        raise HTTPException(status_code=403, detail="Only students can update mistakes")
        
    mistake = db.query(models.LearningMistake).filter(models.LearningMistake.id == mistake_id).first()
    if not mistake:
        raise HTTPException(status_code=404, detail="Mistake not found")
        
    if mistake.student_id != current_user_data["user"].student_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this mistake")
        
    if update_data.content is not None:
        mistake.content = update_data.content
    if update_data.note is not None:
        mistake.note = update_data.note
        
    db.commit()
    db.refresh(mistake)
    return mistake

@router.delete("/{mistake_id}")
def delete_mistake(
    mistake_id: int,
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    if current_user_data["user_type"] != "student":
        raise HTTPException(status_code=403, detail="Only students can delete mistakes")
        
    mistake = db.query(models.LearningMistake).filter(models.LearningMistake.id == mistake_id).first()
    if not mistake:
        raise HTTPException(status_code=404, detail="Mistake not found")
        
    if mistake.student_id != current_user_data["user"].student_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this mistake")
        
    # Delete files
    if mistake.graph_1 and os.path.exists(mistake.graph_1):
        try:
            os.remove(mistake.graph_1)
        except:
            pass
    if mistake.graph_2 and os.path.exists(mistake.graph_2):
        try:
            os.remove(mistake.graph_2)
        except:
            pass
            
    db.delete(mistake)
    db.commit()
    return {"message": "Mistake deleted successfully"}

class BatchDeleteRequest(BaseModel):
    ids: List[int]

@router.post("/batch-delete")
def batch_delete_mistakes(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    if current_user_data["user_type"] != "student":
        raise HTTPException(status_code=403, detail="Only students can delete mistakes")
    
    user = current_user_data["user"]
    
    # Fetch mistakes to verify ownership and get file paths
    mistakes = db.query(models.LearningMistake).filter(
        models.LearningMistake.id.in_(request.ids),
        models.LearningMistake.student_id == user.student_id
    ).all()
    
    if not mistakes:
        return {"message": "No matching mistakes found to delete"}
        
    for mistake in mistakes:
        # Delete files
        if mistake.graph_1 and os.path.exists(mistake.graph_1):
            try:
                os.remove(mistake.graph_1)
            except:
                pass
        if mistake.graph_2 and os.path.exists(mistake.graph_2):
            try:
                os.remove(mistake.graph_2)
            except:
                pass
        db.delete(mistake)
        
    db.commit()
    return {"message": f"Successfully deleted {len(mistakes)} mistakes"}
