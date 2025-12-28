from pydantic import BaseModel
from typing import Optional

# Student相关Schema
class StudentBase(BaseModel):
    student_id: str

class StudentCreate(StudentBase):
    password: str
    name: str
    class_name: Optional[str] = None

class Student(StudentBase):
    name: str
    class_name: Optional[str] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    student_id: Optional[str] = None
    teacher_id: Optional[int] = None
    parent_id: Optional[int] = None
    user_type: Optional[str] = None  # 'student', 'teacher', 'parent'

# Teacher相关Schema
class TeacherBase(BaseModel):
    email: str
    class_name: Optional[str] = None

class TeacherCreate(TeacherBase):
    password: str

class Teacher(TeacherBase):
    id: int

    class Config:
        from_attributes = True

# Parent相关Schema
class ParentBase(BaseModel):
    phone: str

class ParentCreate(ParentBase):
    password: str
    student_id: str  # 需要关联的学生学号

class Parent(ParentBase):
    id: int

    class Config:
        from_attributes = True

# 登录相关Schema
class LoginRequest(BaseModel):
    user_type: str  # 'student', 'teacher', 'parent'
    username: str  # student_id, email, 或 phone
    password: str
