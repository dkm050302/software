from pydantic import BaseModel
from typing import Optional, List

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
    admin_id: Optional[int] = None
    user_type: Optional[str] = None  # 'student', 'teacher', 'parent', 'admin'

# Teacher相关Schema
class TeacherBase(BaseModel):
    email: str
    class_name: Optional[str] = None

class TeacherCreate(TeacherBase):
    password: str
    subject: str  # 学科（必填）

class Teacher(TeacherBase):
    id: int
    subject: Optional[str] = None

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

# Admin相关Schema
class AdminBase(BaseModel):
    username: str
    name: Optional[str] = None

class AdminCreate(AdminBase):
    password: str

class Admin(AdminBase):
    id: int

    class Config:
        from_attributes = True

# 更新个人信息相关Schema
class StudentUpdate(BaseModel):
    name: Optional[str] = None
    class_name: Optional[str] = None

class TeacherUpdate(BaseModel):
    email: Optional[str] = None
    subject: Optional[str] = None
    class_name: Optional[str] = None

class ParentUpdate(BaseModel):
    phone: Optional[str] = None

class AdminUpdate(BaseModel):
    username: Optional[str] = None
    name: Optional[str] = None

# 登录相关Schema
class LoginRequest(BaseModel):
    user_type: str  # 'student', 'teacher', 'parent', 'admin'
    username: str  # student_id, email, phone, 或 admin username
    password: str

# KnowledgeTag相关Schema
class KnowledgeTagBase(BaseModel):
    pass # Placeholder if needed

class StudentInfo(BaseModel):
    student_id: str
    name: str
    class_name: Optional[str]
    teacher_ids: List[int]
    parent_ids: List[int]
    teachers: List[Teacher]

    class Config:
        from_attributes = True

class KnowledgeTagCreate(KnowledgeTagBase):
    parent_id: Optional[int] = None
    order: Optional[int] = 0

class KnowledgeTagUpdate(KnowledgeTagBase):
    order: Optional[int] = None

class KnowledgeTag(KnowledgeTagBase):
    id: int
    parent_id: Optional[int] = None
    teacher_id: int
    order: int
    created_at: str
    updated_at: str
    children: Optional[List[dict]] = None  # 子标签列表（递归结构）

    class Config:
        from_attributes = True
