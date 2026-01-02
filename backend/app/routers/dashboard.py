from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
import os
import asyncio
from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..services.llm_service import llm_service
from ..services.local_storage import local_storage

router = APIRouter()

REPORT_DIR = "data_cache/weekly_reports"
if not os.path.exists(REPORT_DIR):
    os.makedirs(REPORT_DIR)

def get_week_range():
    today = datetime.now()
    start_of_week = today - timedelta(days=today.weekday())  # Monday
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_week = start_of_week + timedelta(days=7)
    return start_of_week, end_of_week

def get_report_file_path(student_id, start_of_week):
    date_str = start_of_week.strftime("%Y%m%d")
    return os.path.join(REPORT_DIR, f"{student_id}_{date_str}.json")

@router.get("/subjects")
async def get_student_subjects(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    user = current_user_data["user"]
    if current_user_data["user_type"] != "student":
         raise HTTPException(status_code=403, detail="Only students can access subjects")

    # Query distinct subjects from Note, LearningMistake, and Exercise
    note_subjects = db.query(models.Note.subject).filter(
        models.Note.student_id == user.student_id,
        models.Note.subject != None
    ).distinct().all()
    
    mistake_subjects = db.query(models.LearningMistake.subject).filter(
        models.LearningMistake.student_id == user.student_id,
        models.LearningMistake.subject != None
    ).distinct().all()
    
    exercise_subjects = db.query(models.Exercise.subject).filter(
        models.Exercise.student_id == user.student_id,
        models.Exercise.subject != None
    ).distinct().all()

    # Flatten and union
    subjects = set()
    for s in note_subjects:
        if s[0]: subjects.add(s[0])
    for s in mistake_subjects:
        if s[0]: subjects.add(s[0])
    for s in exercise_subjects:
        if s[0]: subjects.add(s[0])

    return {"subjects": list(subjects)}

@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    user = current_user_data["user"]
    if current_user_data["user_type"] == "student":
        start_week, _ = get_week_range()
        mistake_count = db.query(models.LearningMistake).filter(
            models.LearningMistake.student_id == user.student_id,
            models.LearningMistake.date >= start_week
        ).count()
        note_count = db.query(models.Note).filter(
            models.Note.student_id == user.student_id,
            models.Note.date >= start_week
        ).count()
        return {
            "mistake_count": mistake_count,
            "note_count": note_count,
            "study_hours": 12.5, # Mock
            "progress": 75 # Mock
        }
    return {}

@router.get("/weekly-reports")
async def get_weekly_reports(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    user = current_user_data["user"]
    if current_user_data["user_type"] != "student":
         raise HTTPException(status_code=403, detail="Only students can access reports")

    # Get the latest report
    latest_tip = db.query(models.StudentTip).filter(
        models.StudentTip.student_id == user.student_id
    ).order_by(models.StudentTip.time.desc()).first()

    if not latest_tip:
        return {}

    # Check if it's from this week
    start_week, end_week = get_week_range()
    if start_week <= latest_tip.time < end_week:
        try:
            report_data = json.loads(latest_tip.tip)
            return report_data 
        except:
            return {}
    
    return {}

@router.post("/analyze-report")
async def analyze_weekly_report(
    subject: str = Body(None, embed=True), # "General" or specific subject or None
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    user = current_user_data["user"]
    if current_user_data["user_type"] != "student":
         raise HTTPException(status_code=403, detail="Only students can generate reports")

    start_week, end_week = get_week_range()
    
    # 1. Fetch or Create existing JSON file
    file_path = get_report_file_path(user.student_id, start_week)
    
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                full_data = json.load(f)
            except:
                full_data = {}
    else:
        full_data = {}

    # 2. Determine what to analyze
    subjects_to_analyze = []
    if subject:
        subjects_to_analyze = [subject]
    else:
        # If None, analyze everything
        mistakes = db.query(models.LearningMistake).filter(
            models.LearningMistake.student_id == user.student_id,
            models.LearningMistake.date >= start_week
        ).all()
        notes = db.query(models.Note).filter(
            models.Note.student_id == user.student_id,
            models.Note.date >= start_week
        ).all()
        
        all_subjects = set([m.subject for m in mistakes if m.subject] + [n.subject for n in notes if n.subject])
        subjects_to_analyze = list(all_subjects)
        if "General" not in subjects_to_analyze:
            subjects_to_analyze.append("General")

    # 3. Process each subject
    updated_reports = {}
    
    # Load existing reports from DB if available to merge
    existing_tip_entry = db.query(models.StudentTip).filter(
        models.StudentTip.student_id == user.student_id,
        models.StudentTip.time >= start_week
    ).first()
    
    if existing_tip_entry and existing_tip_entry.tip:
        try:
            updated_reports = json.loads(existing_tip_entry.tip)
        except:
            pass

    # 用于 StudentSumUp 的数据收集
    sum_up_data = {}
    
    # 存储 LLM 任务
    tasks = []
    task_subjects = []

    for sub in subjects_to_analyze:
        # Collect data for this subject
        sub_data = {"mistakes": [], "notes": []}
        
        # 收集用于 SumUp 的错题 tip 列表
        mistake_tips_for_sumup = []

        if sub == "General":
            # Collect ALL data
            mistakes = db.query(models.LearningMistake).filter(
                models.LearningMistake.student_id == user.student_id,
                models.LearningMistake.date >= start_week
            ).all()
            notes = db.query(models.Note).filter(
                models.Note.student_id == user.student_id,
                models.Note.date >= start_week
            ).all()
        else:
            mistakes = db.query(models.LearningMistake).filter(
                models.LearningMistake.student_id == user.student_id,
                models.LearningMistake.date >= start_week,
                models.LearningMistake.subject == sub
            ).all()
            notes = db.query(models.Note).filter(
                models.Note.student_id == user.student_id,
                models.Note.date >= start_week,
                models.Note.subject == sub
            ).all()

        for m in mistakes:
            sub_data["mistakes"].append({
                "content": m.note if m.note else "无笔记内容",
                "knowledge_point": m.knowledge_point,
                "tip": m.tip
            })
            # 收集 tip 用于 SumUp
            if m.tip:
                mistake_tips_for_sumup.append(m.tip)

        for n in notes:
            sub_data["notes"].append({
                "content": n.content if n.content else "无内容",
                "knowledge_point": n.knowledge_point,
                "tip": n.tip
            })
            
        # Update JSON file data
        full_data[sub] = sub_data
        
        # Create LLM task (do not await here)
        tasks.append(llm_service.generate_weekly_analysis(sub_data, sub))
        task_subjects.append(sub)

        # 收集 SumUp 数据 (按学科分段)
        if sub != "General" and mistake_tips_for_sumup:
             sum_up_data[sub] = mistake_tips_for_sumup

    # 并行执行所有 LLM 任务
    if tasks:
        llm_results = await asyncio.gather(*tasks)
        
        # 将结果填回 updated_reports
        for i, result in enumerate(llm_results):
            sub_name = task_subjects[i]
            updated_reports[sub_name] = result

    # 4. Save JSON file
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(full_data, f, ensure_ascii=False, indent=2)

    # Save to local storage
    try:
        local_storage.save_weekly_report(
            student_id=user.student_id,
            report_data=full_data,
            filename=os.path.basename(file_path)
        )
    except Exception as e:
        print(f"Error saving weekly report to local storage: {e}")

    # 5. Save to DB
    if existing_tip_entry:
        existing_tip_entry.tip = json.dumps(updated_reports, ensure_ascii=False)
        existing_tip_entry.time = datetime.now() 
    else:
        new_tip = models.StudentTip(
            student_id=user.student_id,
            tip=json.dumps(updated_reports, ensure_ascii=False),
            time=datetime.now()
        )
        db.add(new_tip)
    
    # 6. Process StudentSumUp (New Logic)
    if sum_up_data:
        sum_up_prompt_content = "请根据以下各学科的错题提示(Tips)，统计当前学生的错题情况。输出格式要求：每个学科一段，描述有多少错题，主要涉及哪些知识点。\n\n"
        for s_sub, s_tips in sum_up_data.items():
            sum_up_prompt_content += f"【{s_sub}】:\n" + "\n".join(s_tips) + "\n\n"
        
        sum_up_result = await llm_service.generate_simple_chat(sum_up_prompt_content) 
        
        # Save to DB (StudentSumUp)
        existing_sum_up = db.query(models.StudentSumUp).filter(
            models.StudentSumUp.student_id == user.student_id,
            models.StudentSumUp.time >= start_week
        ).first()

        if existing_sum_up:
            existing_sum_up.tip = sum_up_result
            existing_sum_up.time = datetime.now()
        else:
            new_sum_up = models.StudentSumUp(
                student_id=user.student_id,
                tip=sum_up_result,
                time=datetime.now()
            )
            db.add(new_sum_up)

    db.commit()
    
    return updated_reports
