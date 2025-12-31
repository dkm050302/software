from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import io
import pandas as pd
from app import models, schemas
from app.dependencies import get_db, get_current_user
from passlib.context import CryptContext

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ========== 学生管理 ==========

@router.get("/students", response_model=List[schemas.Student])
def get_students(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user_data: dict = Depends(get_current_user)):
    """获取学生列表"""
    students = db.query(models.Student).offset(skip).limit(limit).all()
    return students

@router.delete("/students/{student_id}")
def delete_student(student_id: str, db: Session = Depends(get_db), current_user_data: dict = Depends(get_current_user)):
    """删除学生（级联删除关联数据）"""
    student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # 删除学生-教师关系
    db.query(models.StudentTeacher).filter(models.StudentTeacher.student_id == student_id).delete()
    
    # 删除学生-家长关系
    db.query(models.StudentParent).filter(models.StudentParent.student_id == student_id).delete()
    
    # 删除学习错题
    db.query(models.LearningMistake).filter(models.LearningMistake.student_id == student_id).delete()
    
    # 删除笔记
    db.query(models.Note).filter(models.Note.student_id == student_id).delete()
    
    # 删除习题
    db.query(models.Exercise).filter(models.Exercise.student_id == student_id).delete()
    
    # 删除学生
    db.delete(student)
    db.commit()
    
    return {"message": "Student deleted successfully"}

# ========== 教师管理 ==========

@router.get("/teachers", response_model=List[schemas.Teacher])
def get_teachers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user_data: dict = Depends(get_current_user)):
    """获取教师列表"""
    teachers = db.query(models.Teacher).offset(skip).limit(limit).all()
    return teachers

@router.delete("/teachers/{teacher_id}")
def delete_teacher(teacher_id: int, db: Session = Depends(get_db), current_user_data: dict = Depends(get_current_user)):
    """删除教师（级联删除关联关系）"""
    teacher = db.query(models.Teacher).filter(models.Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    # 删除学生-教师关系
    db.query(models.StudentTeacher).filter(models.StudentTeacher.teacher_id == teacher_id).delete()
    
    # 删除知识标签
    db.query(models.KnowledgeTag).filter(models.KnowledgeTag.teacher_id == teacher_id).delete()
    
    # 删除教师
    db.delete(teacher)
    db.commit()
    
    return {"message": "Teacher deleted successfully"}

# ========== 家长管理 ==========

@router.get("/parents", response_model=List[schemas.Parent])
def get_parents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user_data: dict = Depends(get_current_user)):
    """获取家长列表"""
    parents = db.query(models.Parent).offset(skip).limit(limit).all()
    return parents

@router.delete("/parents/{parent_id}")
def delete_parent(parent_id: int, db: Session = Depends(get_db), current_user_data: dict = Depends(get_current_user)):
    """删除家长（级联删除关联关系）"""
    parent = db.query(models.Parent).filter(models.Parent.id == parent_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    
    # 删除学生-家长关系
    db.query(models.StudentParent).filter(models.StudentParent.parent_id == parent_id).delete()
    
    # 删除家长
    db.delete(parent)
    db.commit()
    
    return {"message": "Parent deleted successfully"}

# ========== Excel导入导出 ==========

@router.get("/export-template")
def export_template(current_user_data: dict = Depends(get_current_user)):
    """导出Excel模板文件"""
    # 创建Excel文件
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # 学生Sheet
        student_df = pd.DataFrame(columns=['student_id', 'name', 'class_name'])
        student_df.to_excel(writer, sheet_name='学生', index=False)
        
        # 教师Sheet
        teacher_df = pd.DataFrame(columns=['email', 'subject', 'class_name'])
        teacher_df.to_excel(writer, sheet_name='教师', index=False)
        
        # 家长Sheet
        parent_df = pd.DataFrame(columns=['phone', 'student_id'])
        parent_df.to_excel(writer, sheet_name='家长', index=False)
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.read()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=import_template.xlsx"}
    )

@router.post("/import")
async def import_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """从Excel文件导入数据"""
    try:
        # 读取Excel文件
        contents = await file.read()
        excel_file = io.BytesIO(contents)
        
        # 读取各个sheet
        student_df = pd.read_excel(excel_file, sheet_name='学生', engine='openpyxl')
        teacher_df = pd.read_excel(excel_file, sheet_name='教师', engine='openpyxl')
        parent_df = pd.read_excel(excel_file, sheet_name='家长', engine='openpyxl')
        
        results = {
            "students": {"success": 0, "failed": 0, "errors": []},
            "teachers": {"success": 0, "failed": 0, "errors": []},
            "parents": {"success": 0, "failed": 0, "errors": []}
        }
        
        # 导入学生
        for idx, row in student_df.iterrows():
            try:
                student_id = str(row.get('student_id', '')).strip()
                name = str(row.get('name', '')).strip()
                class_name = str(row.get('class_name', '')).strip() if pd.notna(row.get('class_name')) else None
                
                if not student_id or not name:
                    results["students"]["failed"] += 1
                    results["students"]["errors"].append(f"第{idx+2}行：学号和姓名不能为空")
                    continue
                
                # 检查是否已存在
                existing = db.query(models.Student).filter(models.Student.student_id == student_id).first()
                if existing:
                    results["students"]["failed"] += 1
                    results["students"]["errors"].append(f"第{idx+2}行：学号 {student_id} 已存在")
                    continue
                
                # 创建学生（默认密码为学号）
                hashed_password = pwd_context.hash(student_id)
                student = models.Student(
                    student_id=student_id,
                    name=name,
                    class_name=class_name if class_name else None,
                    password=hashed_password
                )
                db.add(student)
                results["students"]["success"] += 1
            except Exception as e:
                results["students"]["failed"] += 1
                results["students"]["errors"].append(f"第{idx+2}行：{str(e)}")
        
        # 导入教师
        for idx, row in teacher_df.iterrows():
            try:
                email = str(row.get('email', '')).strip()
                subject = str(row.get('subject', '')).strip()
                class_name = str(row.get('class_name', '')).strip() if pd.notna(row.get('class_name')) else None
                
                if not email or not subject:
                    results["teachers"]["failed"] += 1
                    results["teachers"]["errors"].append(f"第{idx+2}行：邮箱和学科不能为空")
                    continue
                
                # 检查是否已存在
                existing = db.query(models.Teacher).filter(models.Teacher.email == email).first()
                if existing:
                    results["teachers"]["failed"] += 1
                    results["teachers"]["errors"].append(f"第{idx+2}行：邮箱 {email} 已存在")
                    continue
                
                # 创建教师（默认密码为邮箱）
                hashed_password = pwd_context.hash(email)
                teacher = models.Teacher(
                    email=email,
                    subject=subject,
                    class_name=class_name if class_name else None,
                    password=hashed_password
                )
                db.add(teacher)
                results["teachers"]["success"] += 1
            except Exception as e:
                results["teachers"]["failed"] += 1
                results["teachers"]["errors"].append(f"第{idx+2}行：{str(e)}")
        
        # 导入家长
        for idx, row in parent_df.iterrows():
            try:
                phone = str(row.get('phone', '')).strip()
                student_id = str(row.get('student_id', '')).strip()
                
                if not phone or not student_id:
                    results["parents"]["failed"] += 1
                    results["parents"]["errors"].append(f"第{idx+2}行：电话和学生学号不能为空")
                    continue
                
                # 检查学生是否存在
                student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
                if not student:
                    results["parents"]["failed"] += 1
                    results["parents"]["errors"].append(f"第{idx+2}行：学生学号 {student_id} 不存在")
                    continue
                
                # 检查家长是否已存在
                parent = db.query(models.Parent).filter(models.Parent.phone == phone).first()
                if not parent:
                    # 创建新家长（默认密码为电话）
                    hashed_password = pwd_context.hash(phone)
                    parent = models.Parent(
                        phone=phone,
                        password=hashed_password
                    )
                    db.add(parent)
                    db.flush()  # 获取parent.id
                
                # 检查关系是否已存在
                existing_relation = db.query(models.StudentParent).filter(
                    models.StudentParent.student_id == student_id,
                    models.StudentParent.parent_id == parent.id
                ).first()
                
                if not existing_relation:
                    # 创建学生-家长关系
                    relation = models.StudentParent(
                        student_id=student_id,
                        parent_id=parent.id
                    )
                    db.add(relation)
                    results["parents"]["success"] += 1
                else:
                    results["parents"]["failed"] += 1
                    results["parents"]["errors"].append(f"第{idx+2}行：关系已存在")
            except Exception as e:
                results["parents"]["failed"] += 1
                results["parents"]["errors"].append(f"第{idx+2}行：{str(e)}")
        
        db.commit()
        
        return {
            "message": "导入完成",
            "results": results
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"导入失败：{str(e)}")

