from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
import os
import asyncio
import shutil
from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..services.llm_service import llm_service
from ..services.local_storage import local_storage
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

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
        # notes = db.query(models.Note).filter(
        #     models.Note.student_id == user.student_id,
        #     models.Note.date >= start_week
        # ).all()
        
        all_subjects = set([m.subject for m in mistakes if m.subject])
        subjects_to_analyze = list(all_subjects)
        if "General" not in subjects_to_analyze:
            subjects_to_analyze.append("General")

    # 3. Process each subject
    
    # Load existing StudentTip from DB
    existing_tip_entry = db.query(models.StudentTip).filter(
        models.StudentTip.student_id == user.student_id,
        models.StudentTip.time >= start_week
    ).first()
    
    student_tip_dict = {}
    if existing_tip_entry and existing_tip_entry.tip:
        try:
            student_tip_dict = json.loads(existing_tip_entry.tip)
        except:
            pass

    # Load existing StudentSumUp from DB
    existing_sum_up_entry = db.query(models.StudentSumUp).filter(
        models.StudentSumUp.student_id == user.student_id,
        models.StudentSumUp.time >= start_week
    ).first()

    student_sum_up_dict = {}
    if existing_sum_up_entry and existing_sum_up_entry.tip:
        try:
            student_sum_up_dict = json.loads(existing_sum_up_entry.tip)
        except:
            pass
    
    # Store LLM tasks
    tasks_analysis = []
    tasks_sumup = []
    task_subjects = []

    for sub in subjects_to_analyze:
        # Collect data for this subject
        sub_data = {"mistakes": [], "notes": []}
        mistake_tips_for_sumup = []

        if sub == "General":
            # Collect ALL data
            mistakes = db.query(models.LearningMistake).filter(
                models.LearningMistake.student_id == user.student_id,
                models.LearningMistake.date >= start_week
            ).all()
        else:
            mistakes = db.query(models.LearningMistake).filter(
                models.LearningMistake.student_id == user.student_id,
                models.LearningMistake.date >= start_week,
                models.LearningMistake.subject == sub
            ).all()

        for m in mistakes:
            sub_data["mistakes"].append({
                "content": m.note if m.note else "无笔记内容",
                "knowledge_point": m.knowledge_point,
                "tip": m.tip
            })
            if m.tip:
                mistake_tips_for_sumup.append(m.tip)
            
        # Update JSON file data structure (for local file)
        full_data[sub] = sub_data
        
        # Create LLM tasks
        tasks_analysis.append(llm_service.generate_weekly_analysis(sub_data, sub))
        tasks_sumup.append(llm_service.generate_weekly_summary_from_tips(mistake_tips_for_sumup, sub))
        task_subjects.append(sub)

    # Execute all LLM tasks
    new_generated_sumup = {}
    if tasks_analysis:
        results_analysis = await asyncio.gather(*tasks_analysis)
        results_sumup = await asyncio.gather(*tasks_sumup)
        
        # Update dictionaries
        for i, sub in enumerate(task_subjects):
            student_tip_dict[sub] = results_analysis[i]
            student_sum_up_dict[sub] = results_sumup[i]
            new_generated_sumup[sub] = results_sumup[i]

    # 4. Save JSON file (Local Report)
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

    # 5. Save StudentTip to DB
    if existing_tip_entry:
        existing_tip_entry.tip = json.dumps(student_tip_dict, ensure_ascii=False)
        existing_tip_entry.time = datetime.now() 
    else:
        new_tip = models.StudentTip(
            student_id=user.student_id,
            tip=json.dumps(student_tip_dict, ensure_ascii=False),
            time=datetime.now()
        )
        db.add(new_tip)
    
    # 6. Save StudentSumUp to DB (Optimized for Concurrency)
    # Lock all existing records for this student to prevent race conditions
    existing_sum_up_rows = db.query(models.StudentSumUp).filter(
        models.StudentSumUp.student_id == user.student_id
    ).with_for_update().all()

    # Get the latest data from DB (in case it changed while we were generating LLM)
    current_db_sum_up_dict = {}
    if existing_sum_up_rows:
        # Sort to find the latest if multiple exist
        latest_row = sorted(existing_sum_up_rows, key=lambda x: x.time, reverse=True)[0]
        if latest_row.tip:
            try:
                current_db_sum_up_dict = json.loads(latest_row.tip)
            except:
                pass
    
    # Merge the NEWLY generated results into the FRESH DB data
    if new_generated_sumup:
        current_db_sum_up_dict.update(new_generated_sumup)

    # Delete all existing records
    for row in existing_sum_up_rows:
        db.delete(row)
    
    # Insert the consolidated record
    new_sum_up = models.StudentSumUp(
        student_id=user.student_id,
        tip=json.dumps(current_db_sum_up_dict, ensure_ascii=False),
        time=datetime.now()
    )
    db.add(new_sum_up)

    db.commit()
    
    return {"status": "success", "report": student_tip_dict}

@router.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    current_user_data: dict = Depends(get_current_user)
):
    user = current_user_data["user"]
    if current_user_data["user_type"] != "student":
         raise HTTPException(status_code=403, detail="Only students can upload PDFs")

    # Prepare PDF Directory
    pdf_dir = os.path.join("data", "reports")
    if not os.path.exists(pdf_dir):
        os.makedirs(pdf_dir)
        
    # Use current date as filename
    date_str = datetime.now().strftime("%Y%m%d")
    filename = f"{date_str}.pdf"
    file_path = os.path.join(pdf_dir, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"message": "PDF uploaded successfully", "path": file_path, "filename": filename}
    except Exception as e:
        print(f"Error saving PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save PDF: {str(e)}")

@router.post("/generate-pdf")
async def generate_pdf(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    user = current_user_data["user"]
    if current_user_data["user_type"] != "student":
         raise HTTPException(status_code=403, detail="Only students can generate PDFs")

    # 1. Get Report Data
    start_week, end_week = get_week_range()
    latest_tip = db.query(models.StudentTip).filter(
        models.StudentTip.student_id == user.student_id,
        models.StudentTip.time >= start_week
    ).order_by(models.StudentTip.time.desc()).first()

    if not latest_tip or not latest_tip.tip:
        raise HTTPException(status_code=404, detail="No report found for this week")

    try:
        report_data = json.loads(latest_tip.tip)
    except:
        raise HTTPException(status_code=500, detail="Invalid report data")

    # 2. Prepare PDF Directory
    # Use data/reports as requested (or data_cache/weekly_reports if preferred, but user said "data文件夹相应的地方")
    # Let's use data/reports to be clean
    pdf_dir = os.path.join("data", "reports")
    if not os.path.exists(pdf_dir):
        os.makedirs(pdf_dir)
        
    date_str = datetime.now().strftime("%Y%m%d")
    filename = f"{date_str}.pdf"
    file_path = os.path.join(pdf_dir, filename)
    
    # 3. Generate PDF
    try:
        # Register Chinese Font
        # Try common Windows font paths
        font_path = "C:\\Windows\\Fonts\\simhei.ttf"
        if os.path.exists(font_path):
            pdfmetrics.registerFont(TTFont('SimHei', font_path))
            font_name = 'SimHei'
        else:
            # Fallback or try another
            font_name = 'Helvetica' # No Chinese support
            print("Warning: SimHei font not found. Chinese characters may not render.")

        doc = SimpleDocTemplate(file_path, pagesize=A4)
        styles = getSampleStyleSheet()
        
        # Create custom style for Chinese
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=12,
            leading=14,
            spaceAfter=10
        )
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontName=font_name,
            fontSize=18,
            leading=22,
            spaceAfter=20,
            alignment=1 # Center
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontName=font_name,
            fontSize=14,
            leading=18,
            spaceAfter=12,
            textColor=colors.blue
        )

        story = []
        
        # Title
        story.append(Paragraph(f"周报 - {date_str}", title_style))
        story.append(Spacer(1, 12))
        
        # Content
        for subject, content in report_data.items():
            story.append(Paragraph(subject, heading_style))
            
            # Simple Markdown cleanup for PDF
            # Replace newlines with <br/>
            # Remove ** for bold (or handle it if possible, but simple replacement is safer for now)
            clean_content = content.replace("\n", "<br/>")
            clean_content = clean_content.replace("**", "") # Remove bold markers
            clean_content = clean_content.replace("#", "") # Remove headers
            
            story.append(Paragraph(clean_content, normal_style))
            story.append(Spacer(1, 12))
            
        doc.build(story)
        
        return {"message": "PDF generated successfully", "path": file_path, "filename": filename}
        
    except Exception as e:
        print(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

