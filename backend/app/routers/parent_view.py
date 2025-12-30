from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import json
from datetime import datetime, timedelta
from app.services.llm_service import llm_service
from app import models
from app.dependencies import get_db, get_current_user

router = APIRouter()

def get_week_range():
    today = datetime.now()
    start_of_week = today - timedelta(days=today.weekday())  # Monday
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_week = start_of_week + timedelta(days=7)
    return start_of_week, end_of_week

@router.get("/report")
async def get_parent_report():
    # Mock student data retrieval
    student_data = {"recent_grades": [90, 85], "activity": "High"}
    
    report = await llm_service.generate_parent_report(student_data)
    return {"report": report}

@router.get("/dashboard/stats")
async def get_student_dashboard_stats(
    student_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """获取学生的 Dashboard 统计数据（家长查看）"""
    if current_user_data["user_type"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    parent = current_user_data["user"]
    
    # 获取家长关联的所有学生ID
    student_parents = db.query(models.StudentParent).filter(
        models.StudentParent.parent_id == parent.id
    ).all()
    
    if not student_parents:
        raise HTTPException(status_code=404, detail="No students associated with this parent")
    
    authorized_student_ids = [sp.student_id for sp in student_parents]
    
    # 如果指定了student_id，验证是否有权限
    if student_id:
        if student_id not in authorized_student_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this student's data")
        target_student_id = student_id
    else:
        # 如果没有指定，使用第一个学生
        target_student_id = authorized_student_ids[0]
    
    # 获取统计数据
    start_week, _ = get_week_range()
    mistake_count = db.query(models.LearningMistake).filter(
        models.LearningMistake.student_id == target_student_id,
        models.LearningMistake.date >= start_week
    ).count()
    note_count = db.query(models.Note).filter(
        models.Note.student_id == target_student_id,
        models.Note.date >= start_week
    ).count()
    
    return {
        "mistake_count": mistake_count,
        "note_count": note_count,
        "study_hours": 12.5,  # Mock
        "progress": 75  # Mock
    }

@router.get("/dashboard/weekly-reports")
async def get_student_weekly_reports(
    student_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """获取学生的周报（家长查看）"""
    if current_user_data["user_type"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    parent = current_user_data["user"]
    
    # 获取家长关联的所有学生ID
    student_parents = db.query(models.StudentParent).filter(
        models.StudentParent.parent_id == parent.id
    ).all()
    
    if not student_parents:
        raise HTTPException(status_code=404, detail="No students associated with this parent")
    
    authorized_student_ids = [sp.student_id for sp in student_parents]
    
    # 如果指定了student_id，验证是否有权限
    if student_id:
        if student_id not in authorized_student_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this student's data")
        target_student_id = student_id
    else:
        # 如果没有指定，使用第一个学生
        target_student_id = authorized_student_ids[0]
    
    # 获取最新的报告
    latest_tip = db.query(models.StudentTip).filter(
        models.StudentTip.student_id == target_student_id
    ).order_by(models.StudentTip.time.desc()).first()
    
    if not latest_tip:
        return {}
    
    # 检查是否来自本周
    start_week, end_week = get_week_range()
    if start_week <= latest_tip.time < end_week:
        try:
            report_data = json.loads(latest_tip.tip)
            return report_data
        except:
            return {}
    
    return {}

@router.get("/dashboard/subjects")
async def get_student_subjects(
    student_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """获取学生的学科列表（家长查看）"""
    if current_user_data["user_type"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    parent = current_user_data["user"]
    
    # 获取家长关联的所有学生ID
    student_parents = db.query(models.StudentParent).filter(
        models.StudentParent.parent_id == parent.id
    ).all()
    
    if not student_parents:
        raise HTTPException(status_code=404, detail="No students associated with this parent")
    
    authorized_student_ids = [sp.student_id for sp in student_parents]
    
    # 如果指定了student_id，验证是否有权限
    if student_id:
        if student_id not in authorized_student_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this student's data")
        target_student_id = student_id
    else:
        # 如果没有指定，使用第一个学生
        target_student_id = authorized_student_ids[0]
    
    # 查询该学生的所有学科
    note_subjects = db.query(models.Note.subject).filter(
        models.Note.student_id == target_student_id,
        models.Note.subject != None
    ).distinct().all()
    
    mistake_subjects = db.query(models.LearningMistake.subject).filter(
        models.LearningMistake.student_id == target_student_id,
        models.LearningMistake.subject != None
    ).distinct().all()
    
    exercise_subjects = db.query(models.Exercise.subject).filter(
        models.Exercise.student_id == target_student_id,
        models.Exercise.subject != None
    ).distinct().all()
    
    # 合并所有学科
    subjects = set()
    for s in note_subjects:
        if s[0]: subjects.add(s[0])
    for s in mistake_subjects:
        if s[0]: subjects.add(s[0])
    for s in exercise_subjects:
        if s[0]: subjects.add(s[0])
    
    return {"subjects": list(subjects)}

@router.get("/student-id")
def get_parent_student_id(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """获取家长关联的学生学号"""
    if current_user_data["user_type"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    parent = current_user_data["user"]
    
    # 获取家长关联的所有学生
    student_parents = db.query(models.StudentParent).filter(
        models.StudentParent.parent_id == parent.id
    ).all()
    
    if not student_parents:
        raise HTTPException(status_code=404, detail="No students associated with this parent")
    
    # 返回所有关联的学生ID（一个家长可能关联多个学生）
    student_ids = [sp.student_id for sp in student_parents]
    
    return {"student_ids": student_ids}

@router.get("/mistakes")
def get_student_mistakes(
    student_id: Optional[str] = None,
    subject: Optional[str] = None,
    chapter: Optional[str] = None,
    knowledge_points: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """家长查看学生的错题本"""
    if current_user_data["user_type"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    parent = current_user_data["user"]
    
    # 获取家长关联的所有学生ID
    student_parents = db.query(models.StudentParent).filter(
        models.StudentParent.parent_id == parent.id
    ).all()
    
    if not student_parents:
        raise HTTPException(status_code=404, detail="No students associated with this parent")
    
    authorized_student_ids = [sp.student_id for sp in student_parents]
    
    # 如果指定了student_id，验证是否有权限
    if student_id:
        if student_id not in authorized_student_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this student's mistakes")
        query = db.query(models.LearningMistake).filter(models.LearningMistake.student_id == student_id)
    else:
        # 如果没有指定，返回所有关联学生的错题
        query = db.query(models.LearningMistake).filter(
            models.LearningMistake.student_id.in_(authorized_student_ids)
        )
    
    if subject:
        query = query.filter(models.LearningMistake.subject == subject)
    if chapter:
        query = query.filter(models.LearningMistake.chapter == chapter)
        
    mistakes = query.all()
    
    # Filter by knowledge points in Python
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
                if not m.knowledge_point:
                    continue
                try:
                    try:
                        m_kps = json.loads(m.knowledge_point)
                        if not isinstance(m_kps, list):
                            m_kps = [m.knowledge_point]
                    except:
                        m_kps = [kp.strip() for kp in m.knowledge_point.split(',') if kp.strip()]
                    
                    if set(kp_filter).issubset(set(m_kps)):
                        filtered_mistakes.append(m)
                except Exception as e:
                    print(f"Error parsing knowledge point for mistake {m.id}: {e}")
                    continue
            mistakes = filtered_mistakes

    return mistakes

@router.get("/mistakes/filters")
def get_mistake_filters(
    student_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """获取错题本的筛选选项"""
    if current_user_data["user_type"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    parent = current_user_data["user"]
    
    # 获取家长关联的所有学生ID
    student_parents = db.query(models.StudentParent).filter(
        models.StudentParent.parent_id == parent.id
    ).all()
    
    if not student_parents:
        return []
    
    authorized_student_ids = [sp.student_id for sp in student_parents]
    
    # 如果指定了student_id，验证是否有权限
    if student_id:
        if student_id not in authorized_student_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this student's mistakes")
        student_ids = [student_id]
    else:
        student_ids = authorized_student_ids
    
    # 获取这些学生的所有错题来提取筛选选项
    mistakes = db.query(
        models.LearningMistake.subject,
        models.LearningMistake.chapter,
        models.LearningMistake.knowledge_point
    ).filter(
        models.LearningMistake.student_id.in_(student_ids)
    ).all()
    
    filters = []
    for m in mistakes:
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
