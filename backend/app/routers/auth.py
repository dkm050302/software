from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from app import database, models, schemas, auth_utils, config
from app.dependencies import get_db

router = APIRouter()

# ========== 注册接口 ==========

@router.post("/register/student", response_model=schemas.Student)
def register_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    """学生注册"""
    db_student = db.query(models.Student).filter(models.Student.student_id == student.student_id).first()
    if db_student:
        raise HTTPException(status_code=400, detail="Student ID already registered")
    hashed_password = auth_utils.get_password_hash(student.password)
    db_student = models.Student(
        student_id=student.student_id,
        name=student.name,
        password=hashed_password,
        class_name=student.class_name
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student

@router.post("/register/teacher", response_model=schemas.Teacher)
def register_teacher(teacher: schemas.TeacherCreate, db: Session = Depends(get_db)):
    """教师注册，如果班级和学生班级相同则自动绑定关系"""
    db_teacher = db.query(models.Teacher).filter(models.Teacher.email == teacher.email).first()
    if db_teacher:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = auth_utils.get_password_hash(teacher.password)
    db_teacher = models.Teacher(
        email=teacher.email,
        password=hashed_password,
        class_name=teacher.class_name
    )
    db.add(db_teacher)
    db.flush()  # 获取teacher.id
    
    # 如果指定了班级，查找相同班级的学生并建立关系
    if teacher.class_name:
        students = db.query(models.Student).filter(models.Student.class_name == teacher.class_name).all()
        for student in students:
            student_teacher = models.StudentTeacher(
                student_id=student.student_id,
                teacher_id=db_teacher.id
            )
            db.add(student_teacher)
    
    db.commit()
    db.refresh(db_teacher)
    return db_teacher

@router.post("/register/parent", response_model=schemas.Parent)
def register_parent(parent: schemas.ParentCreate, db: Session = Depends(get_db)):
    """家长注册，需要指定关联的学生学号"""
    db_parent = db.query(models.Parent).filter(models.Parent.phone == parent.phone).first()
    if db_parent:
        raise HTTPException(status_code=400, detail="Phone already registered")
    
    # 检查学生是否存在
    student = db.query(models.Student).filter(models.Student.student_id == parent.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    hashed_password = auth_utils.get_password_hash(parent.password)
    db_parent = models.Parent(
        phone=parent.phone,
        password=hashed_password
    )
    db.add(db_parent)
    db.flush()  # 获取parent.id
    
    # 建立学生-家长关系
    student_parent = models.StudentParent(
        student_id=parent.student_id,
        parent_id=db_parent.id
    )
    db.add(student_parent)
    
    db.commit()
    db.refresh(db_parent)
    return db_parent

# ========== 登录接口 ==========

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    """统一登录接口，支持学生、教师、家长三种身份"""
    username = form_data.username
    password = form_data.password
    
    # 尝试学生登录（username是student_id）
    student = db.query(models.Student).filter(models.Student.student_id == username).first()
    if student and auth_utils.verify_password(password, student.password):
        access_token_expires = timedelta(minutes=config.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth_utils.create_access_token(
            data={"sub": student.student_id, "user_type": "student"}, 
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    
    # 尝试教师登录（username是email）
    teacher = db.query(models.Teacher).filter(models.Teacher.email == username).first()
    if teacher and auth_utils.verify_password(password, teacher.password):
        access_token_expires = timedelta(minutes=config.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth_utils.create_access_token(
            data={"sub": str(teacher.id), "user_type": "teacher"}, 
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    
    # 尝试家长登录（username是phone）
    parent = db.query(models.Parent).filter(models.Parent.phone == username).first()
    if parent and auth_utils.verify_password(password, parent.password):
        access_token_expires = timedelta(minutes=config.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth_utils.create_access_token(
            data={"sub": str(parent.id), "user_type": "parent"}, 
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    
    # 所有尝试都失败
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )
