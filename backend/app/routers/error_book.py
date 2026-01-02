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
from app.services.local_storage import local_storage
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
    title: Optional[str] = Form(None),
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

    # Handle title logic
    if not title or not title.strip():
        # If title is empty, use knowledge_point
        # knowledge_point might be a JSON string or comma separated string
        try:
            kp_parsed = json.loads(knowledge_point)
            if isinstance(kp_parsed, list):
                title = ", ".join(kp_parsed)
            else:
                title = str(kp_parsed)
        except:
            title = knowledge_point

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
        title=title,
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
        
        # Save to local storage
        try:
            local_storage.create_mistake_entry(
                student_id=user.student_id,
                chapter=chapter,
                title=title,
                content=content,
                note=note,
                graph_1_src_path=graph_1_path,
                graph_2_src_path=graph_2_path,
                metadata={
                    "subject": subject,
                    "knowledge_point": knowledge_point,
                    "date": date,
                    "tip": tip
                }
            )
        except Exception as e:
            print(f"Error saving to local storage: {e}")
            # We don't rollback DB transaction here as the primary storage is DB
            
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

from app.routers.dashboard import get_week_range

def cleanup_weekly_mistakes(db: Session, student_id: str):
    """
    Deletes mistakes from the database that are older than the current week's start.
    """
    start_week, _ = get_week_range()
    
    # Find old mistakes
    old_mistakes = db.query(models.LearningMistake).filter(
        models.LearningMistake.student_id == student_id,
        models.LearningMistake.date < start_week
    ).all()
    
    if not old_mistakes:
        return
        
    print(f"Cleaning up {len(old_mistakes)} old mistakes for student {student_id}")
    
    for mistake in old_mistakes:
        # We ONLY delete from DB, keeping local files intact as archive
        # We also delete the 'uploads' files to save space on server if they are considered temporary
        # But wait, the user said "storage to local".
        # If we delete from DB, we should probably delete from 'uploads' too, 
        # assuming 'local storage' (data folder) is the permanent one.
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
    
    # 1. Cleanup old mistakes from DB
    cleanup_weekly_mistakes(db, user.student_id)
    
    # 2. Read from Local Storage
    mistakes = local_storage.list_mistakes(user.student_id)
    
    # 3. Filter in memory
    if subject and subject != "__ALL__":
        mistakes = [m for m in mistakes if m.get("subject") == subject]
        
    if chapter:
        mistakes = [m for m in mistakes if m.get("chapter") == chapter]
        
    if knowledge_points:
        try:
            kp_filter = json.loads(knowledge_points)
            if not isinstance(kp_filter, list):
                kp_filter = [knowledge_points]
        except:
            kp_filter = [kp.strip() for kp in knowledge_points.split(',') if kp.strip()]
            
        if kp_filter:
            filtered_mistakes = []
            for m in mistakes:
                m_kp_str = m.get("knowledge_point", "")
                if not m_kp_str:
                    continue
                try:
                    try:
                        m_kps = json.loads(m_kp_str)
                        if not isinstance(m_kps, list):
                            m_kps = [m_kp_str]
                    except:
                        m_kps = [kp.strip() for kp in m_kp_str.split(',') if kp.strip()]
                    
                    if set(kp_filter).issubset(set(m_kps)):
                        filtered_mistakes.append(m)
                except:
                    continue
            mistakes = filtered_mistakes

    return mistakes

class MistakeUpdate(BaseModel):
    content: Optional[str] = None
    note: Optional[str] = None
    title: Optional[str] = None

@router.put("/{mistake_id}")
def update_mistake(
    mistake_id: str,
    update_data: MistakeUpdate,
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    if current_user_data["user_type"] != "student":
        raise HTTPException(status_code=403, detail="Only students can update mistakes")
    
    user = current_user_data["user"]
    
    # Try to parse mistake_id as int (DB ID) or string (Local ID)
    db_mistake = None
    local_chapter = None
    local_title = None
    
    if mistake_id.isdigit():
        # It's a DB ID
        db_mistake = db.query(models.LearningMistake).filter(models.LearningMistake.id == int(mistake_id)).first()
    else:
        # It's a Local ID (base64 encoded "chapter::title")
        try:
            import base64
            decoded = base64.urlsafe_b64decode(mistake_id).decode()
            local_chapter, local_title = decoded.split("::")
            
            # Try to find in DB by chapter/title/student just in case
            db_mistake = db.query(models.LearningMistake).filter(
                models.LearningMistake.student_id == user.student_id,
                models.LearningMistake.chapter == local_chapter,
                models.LearningMistake.title == local_title
            ).first()
        except:
            raise HTTPException(status_code=400, detail="Invalid mistake ID format")

    # If found in DB, update DB
    if db_mistake:
        if db_mistake.student_id != user.student_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        old_chapter = db_mistake.chapter
        old_title = db_mistake.title
        
        if update_data.content is not None:
            db_mistake.content = update_data.content
        if update_data.note is not None:
            db_mistake.note = update_data.note
        if update_data.title is not None:
            db_mistake.title = update_data.title
            
        db.commit()
        db.refresh(db_mistake)
        
        # Update Local
        try:
            local_storage.update_mistake_entry(
                student_id=user.student_id,
                old_chapter=old_chapter,
                old_title=old_title,
                new_chapter=db_mistake.chapter,
                new_title=db_mistake.title,
                new_content=update_data.content,
                new_note=update_data.note
            )
        except Exception as e:
            print(f"Error updating local storage: {e}")
            
        return db_mistake
        
    elif local_chapter and local_title:
        # Only in Local Storage
        try:
            new_title = update_data.title if update_data.title else local_title
            local_storage.update_mistake_entry(
                student_id=user.student_id,
                old_chapter=local_chapter,
                old_title=local_title,
                new_chapter=local_chapter, # We don't support changing chapter via update yet
                new_title=new_title,
                new_content=update_data.content,
                new_note=update_data.note
            )
            return {"message": "Local mistake updated", "id": mistake_id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update local mistake: {e}")
            
    else:
        raise HTTPException(status_code=404, detail="Mistake not found")

@router.delete("/{mistake_id}")
def delete_mistake(
    mistake_id: str,
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    if current_user_data["user_type"] != "student":
        raise HTTPException(status_code=403, detail="Only students can delete mistakes")
        
    user = current_user_data["user"]
    
    db_mistake = None
    local_chapter = None
    local_title = None
    
    if mistake_id.isdigit():
        db_mistake = db.query(models.LearningMistake).filter(models.LearningMistake.id == int(mistake_id)).first()
    else:
        try:
            import base64
            decoded = base64.urlsafe_b64decode(mistake_id).decode()
            local_chapter, local_title = decoded.split("::")
            
            db_mistake = db.query(models.LearningMistake).filter(
                models.LearningMistake.student_id == user.student_id,
                models.LearningMistake.chapter == local_chapter,
                models.LearningMistake.title == local_title
            ).first()
        except:
            pass # Might be invalid ID or just not found

    # Delete from DB if exists
    if db_mistake:
        if db_mistake.student_id != user.student_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        # Delete files
        if db_mistake.graph_1 and os.path.exists(db_mistake.graph_1):
            try: os.remove(db_mistake.graph_1)
            except: pass
        if db_mistake.graph_2 and os.path.exists(db_mistake.graph_2):
            try: os.remove(db_mistake.graph_2)
            except: pass
            
        # Use DB info to delete local
        try:
            local_storage.delete_mistake_entry(
                student_id=user.student_id,
                chapter=db_mistake.chapter,
                title=db_mistake.title
            )
        except Exception as e:
            print(f"Error deleting from local storage: {e}")
            
        db.delete(db_mistake)
        db.commit()
        
    elif local_chapter and local_title:
        # Only Local
        try:
            local_storage.delete_mistake_entry(
                student_id=user.student_id,
                chapter=local_chapter,
                title=local_title
            )
        except Exception as e:
            print(f"Error deleting from local storage: {e}")
            
    else:
        raise HTTPException(status_code=404, detail="Mistake not found")
        
    return {"message": "Mistake deleted successfully"}

class BatchDeleteRequest(BaseModel):
    ids: List[str]

@router.post("/batch-delete")
def batch_delete_mistakes(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    if current_user_data["user_type"] != "student":
        raise HTTPException(status_code=403, detail="Only students can delete mistakes")
    
    user = current_user_data["user"]
    
    # We need to handle both DB IDs and Local IDs
    # This is complex for batch delete.
    # We will iterate and call delete logic for each.
    
    deleted_count = 0
    
    for mistake_id in request.ids:
        try:
            delete_mistake(mistake_id, db, current_user_data)
            deleted_count += 1
        except Exception as e:
            print(f"Error deleting mistake {mistake_id}: {e}")
            
    return {"message": f"Successfully deleted {deleted_count} mistakes"}
