from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas
from app.dependencies import get_db, get_current_user

router = APIRouter()

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

