from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import re
import json
from app import models
from app.dependencies import get_db, get_current_user
from app.services.llm_service import llm_service
from datetime import datetime

router = APIRouter()

@router.get("/student-status")
def get_student_status(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """获取教师班级学生的学习情况（从StudentSumUp表）"""
    user = current_user_data["user"]
    user_type = current_user_data["user_type"]
    
    if user_type != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")
    
    # 获取教师的班级和学科
    teacher_class = user.class_name
    teacher_subject = user.subject
    
    if not teacher_class:
        return []
    
    # 查找同班级的所有学生
    students = db.query(models.Student).filter(
        models.Student.class_name == teacher_class
    ).all()
    
    # 获取这些学生的StudentSumUp数据
    student_statuses = []
    for student in students:
        # 获取最新的StudentSumUp记录
        sum_up = db.query(models.StudentSumUp).filter(
            models.StudentSumUp.student_id == student.student_id
        ).order_by(models.StudentSumUp.time.desc()).first()
        
        if sum_up and sum_up.tip:
            # 尝试提取对应学科的内容
            tip_content = extract_subject_content(sum_up.tip, teacher_subject)
            
            # 如果提取不到内容，且没有指定学科，或者提取失败但有原始内容（兼容旧数据），
            # 这里策略是：如果指定了学科但没提取到，说明该学科没数据，返回空字符串。
            # 如果没指定学科，返回整个 JSON 字符串（或者原始内容）。
            if not teacher_subject:
                tip_content = sum_up.tip
            
            student_statuses.append({
                "student_id": student.student_id,
                "student_name": student.name,
                "tip": tip_content,
                "time": sum_up.time.isoformat() if sum_up.time else None
            })
        else:
            # 如果没有数据，也返回学生信息，tip为空
            student_statuses.append({
                "student_id": student.student_id,
                "student_name": student.name,
                "tip": None,
                "time": None
            })
    
    return {
        "teacher_subject": teacher_subject,
        "teacher_class": teacher_class,
        "students": student_statuses
    }

def extract_subject_content(tip: str, subject: str) -> str:
    """从tip中提取对应学科的内容"""
    if not tip or not subject:
        return ""
    
    # 尝试解析 JSON
    try:
        tip_dict = json.loads(tip)
        if isinstance(tip_dict, dict):
            if subject in tip_dict:
                return tip_dict[subject]
            return ""
    except:
        pass
    
    # 尝试多种格式匹配
    patterns = [
        # 格式1: **学科名** 后面的内容
        re.compile(
            f"\\*\\*{re.escape(subject)}\\*\\*\\s*\\n?([^\\*]+?)(?=\\*\\*|$)",
            re.DOTALL
        ),
        # 格式2: 【学科名】 后面的内容
        re.compile(
            f"【{re.escape(subject)}】\\s*\\n?([^【]+?)(?=【|$)",
            re.DOTALL
        ),
        # 格式3: 学科名： 后面的内容（冒号格式）
        re.compile(
            f"{re.escape(subject)}：\\s*\\n?([^\\n]+?)(?=\\n\\s*[^\\s]|$)",
            re.DOTALL
        ),
        # 格式4: 学科名: 后面的内容（英文冒号）
        re.compile(
            f"{re.escape(subject)}:\\s*\\n?([^\\n]+?)(?=\\n\\s*[^\\s]|$)",
            re.DOTALL
        ),
    ]
    
    for pattern in patterns:
        match = pattern.search(tip)
        if match and match.group(1):
            content = match.group(1).strip()
            if content:  # 确保内容不为空
                return content
    
    # 如果所有模式都不匹配，尝试直接搜索学科名，返回包含该学科名的段落
    lines = tip.split('\n')
    in_subject_section = False
    result_lines = []
    
    for line in lines:
        # 检查是否包含学科名
        if subject in line:
            in_subject_section = True
            # 提取该行中学科名后面的内容
            idx = line.find(subject)
            if idx != -1:
                remaining = line[idx + len(subject):].strip()
                # 移除可能的标记符号
                remaining = re.sub(r'^[：:【】\*\s]+', '', remaining)
                if remaining:
                    result_lines.append(remaining)
        elif in_subject_section:
            # 如果遇到空行或新的学科标记，停止收集
            if line.strip() == '' or re.match(r'^[【\*]', line.strip()):
                break
            result_lines.append(line)
    
    if result_lines:
        return '\n'.join(result_lines).strip()
    
    return ""

@router.post("/generate-student-status")
async def generate_student_status(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """生成学生学习情况"""
    user = current_user_data["user"]
    user_type = current_user_data["user_type"]
    
    if user_type != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")
    
    teacher_id = user.id
    teacher_subject = user.subject
    teacher_class = user.class_name
    
    if not teacher_class or not teacher_subject:
        raise HTTPException(status_code=400, detail="Teacher class or subject not set")
    
    # 查找同班级的所有学生
    students = db.query(models.Student).filter(
        models.Student.class_name == teacher_class
    ).all()
    
    # 收集所有学生的对应学科tip内容
    all_subject_contents = []
    debug_info = []  # 用于调试
    
    for student in students:
        sum_up = db.query(models.StudentSumUp).filter(
            models.StudentSumUp.student_id == student.student_id
        ).order_by(models.StudentSumUp.time.desc()).first()
        
        if sum_up and sum_up.tip:
            subject_content = extract_subject_content(sum_up.tip, teacher_subject)
            if subject_content:
                all_subject_contents.append(f"{student.student_id}（{student.name or ''}）的{teacher_subject}学科情况：\n{subject_content}")
            else:
                # 记录调试信息：为什么没有提取到内容
                debug_info.append(f"学生 {student.student_id} ({student.name}) 的 tip 存在但无法提取 {teacher_subject} 学科内容。tip 前100字符: {sum_up.tip[:100]}")
        else:
            debug_info.append(f"学生 {student.student_id} ({student.name}) 没有 StudentSumUp 数据")
    
    if not all_subject_contents:
        error_msg = f"No student data available for this subject ({teacher_subject})"
        if debug_info:
            error_msg += f". Debug info: {'; '.join(debug_info)}"
        raise HTTPException(status_code=400, detail=error_msg)
    
    # 整合所有内容，发送给LLM
    combined_content = "\n\n".join(all_subject_contents)
    prompt = f"""请根据以下所有学生的{teacher_subject}学科学习情况，统计并分析：

{combined_content}

请严格按照以下格式输出（必须包含这两部分）：
高频知识点有：
[列出所有高频知识点，每行一个]

每个高频知识点出现次数：
[列出每个知识点及其出现次数，格式：知识点名称：出现次数]"""
    
    try:
        student_status_result = await llm_service.generate_simple_chat(prompt)
    except Exception as e:
        import traceback
        error_msg = f"Failed to generate student status: {str(e)}"
        print(f"Error generating student status: {error_msg}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)
    
    # 保存到数据库
    try:
        existing_plan = db.query(models.TeacherTeachingPlan).filter(
            models.TeacherTeachingPlan.teacher_id == teacher_id
        ).first()
        
        if existing_plan:
            existing_plan.student_status = student_status_result
            existing_plan.time = datetime.now()
        else:
            new_plan = models.TeacherTeachingPlan(
                teacher_id=teacher_id,
                student_status=student_status_result,
                teaching_plan=None,
                time=datetime.now()
            )
            db.add(new_plan)
        
        db.commit()
    except Exception as e:
        db.rollback()
        import traceback
        error_msg = f"Failed to save student status to database: {str(e)}"
        print(f"Database error: {error_msg}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)
    
    return {
        "student_status": student_status_result,
        "message": "学生学习情况生成成功"
    }

@router.post("/generate-teaching-plan")
async def generate_teaching_plan(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """生成教学方案"""
    user = current_user_data["user"]
    user_type = current_user_data["user_type"]
    
    if user_type != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")
    
    teacher_id = user.id
    teacher_subject = user.subject
    
    # 检查是否有学生学习情况
    existing_plan = db.query(models.TeacherTeachingPlan).filter(
        models.TeacherTeachingPlan.teacher_id == teacher_id
    ).first()
    
    if not existing_plan or not existing_plan.student_status:
        raise HTTPException(status_code=400, detail="Please generate student status first")
    
    student_status = existing_plan.student_status
    
    # 生成教学方案
    prompt = f"""根据以下学生的学习情况，生成教学方案：

{student_status}

请提供：
1. 接下来重点讲什么内容
2. 可以注意什么内容

请以清晰的结构输出教学方案。"""
    
    try:
        teaching_plan_result = await llm_service.generate_simple_chat(prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate teaching plan: {str(e)}")
    
    # 更新数据库
    existing_plan.teaching_plan = teaching_plan_result
    existing_plan.time = datetime.now()
    db.commit()
    
    return {
        "teaching_plan": teaching_plan_result,
        "message": "教学方案生成成功"
    }

@router.get("/teaching-plan")
def get_teaching_plan(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """获取教师的教学方案数据"""
    user = current_user_data["user"]
    user_type = current_user_data["user_type"]
    
    if user_type != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")
    
    teacher_id = user.id
    
    plan = db.query(models.TeacherTeachingPlan).filter(
        models.TeacherTeachingPlan.teacher_id == teacher_id
    ).first()
    
    if not plan:
        return {
            "student_status": None,
            "teaching_plan": None,
            "time": None
        }
    
    return {
        "student_status": plan.student_status,
        "teaching_plan": plan.teaching_plan,
        "time": plan.time.isoformat() if plan.time else None
    }

@router.delete("/student-status")
def delete_student_status(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """删除学生学习情况"""
    user = current_user_data["user"]
    user_type = current_user_data["user_type"]
    
    if user_type != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")
    
    teacher_id = user.id
    
    plan = db.query(models.TeacherTeachingPlan).filter(
        models.TeacherTeachingPlan.teacher_id == teacher_id
    ).first()
    
    if plan:
        plan.student_status = None
        # 如果教学方案也存在，也一并删除（因为教学方案依赖于学生学习情况）
        plan.teaching_plan = None
        db.commit()
    
    return {"message": "学生学习情况已删除"}

@router.delete("/teaching-plan")
def delete_teaching_plan(
    db: Session = Depends(get_db),
    current_user_data: dict = Depends(get_current_user)
):
    """删除教学方案"""
    user = current_user_data["user"]
    user_type = current_user_data["user_type"]
    
    if user_type != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")
    
    teacher_id = user.id
    
    plan = db.query(models.TeacherTeachingPlan).filter(
        models.TeacherTeachingPlan.teacher_id == teacher_id
    ).first()
    
    if plan:
        plan.teaching_plan = None
        db.commit()
    
    return {"message": "教学方案已删除"}

