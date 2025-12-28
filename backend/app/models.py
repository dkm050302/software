from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.database import Base

# 学生表
class Student(Base):
    __tablename__ = "students"

    student_id = Column(String, primary_key=True, index=True)  # 学号
    name = Column(String, nullable=False)  # 姓名
    password = Column(String, nullable=False)  # 密码
    class_name = Column(String, nullable=True)  # 班级

    # 关系
    teachers = relationship("StudentTeacher", back_populates="student")
    parents = relationship("StudentParent", back_populates="student")
    learning_mistakes = relationship("LearningMistake", back_populates="student")
    notes = relationship("Note", back_populates="student")
    exercises = relationship("Exercise", back_populates="student")


# 教师表
class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    class_name = Column(String, nullable=True)  # 班级
    password = Column(String, nullable=False)  # 密码
    email = Column(String, unique=True, index=True)  # 邮箱

    # 关系
    students = relationship("StudentTeacher", back_populates="teacher")


# 家长表
class Parent(Base):
    __tablename__ = "parents"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True, nullable=False)  # 电话
    password = Column(String, nullable=False)  # 密码

    # 关系
    students = relationship("StudentParent", back_populates="parent")


# 学生-教师关系表（多对多）
class StudentTeacher(Base):
    __tablename__ = "student_teachers"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)

    # 关系
    student = relationship("Student", back_populates="teachers")
    teacher = relationship("Teacher", back_populates="students")


# 学生-家长关系表（一对多：一个学生可以有多个家长）
class StudentParent(Base):
    __tablename__ = "student_parents"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("parents.id"), nullable=False)

    # 关系
    student = relationship("Student", back_populates="parents")
    parent = relationship("Parent", back_populates="students")


# 学习错题表
class LearningMistake(Base):
    __tablename__ = "learning_mistakes"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    date = Column(DateTime, nullable=True)  # 日期
    time = Column(String, nullable=True)  # 时间
    subject = Column(String, nullable=True)  # 学科
    content = Column(Text, nullable=True)  # 内容
    chapter = Column(String, nullable=True)  # 章节
    knowledge_point = Column(String, nullable=True)  # 知识点

    # 关系
    student = relationship("Student", back_populates="learning_mistakes")


# 笔记表
class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    date = Column(DateTime, nullable=True)  # 日期
    time = Column(String, nullable=True)  # 时间
    subject = Column(String, nullable=True)  # 学科
    content = Column(Text, nullable=True)  # 内容
    chapter = Column(String, nullable=True)  # 章节
    knowledge_point = Column(String, nullable=True)  # 知识点

    # 关系
    student = relationship("Student", back_populates="notes")


# 习题表/导图表
class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    date = Column(DateTime, nullable=True)  # 日期
    time = Column(String, nullable=True)  # 时间
    subject = Column(String, nullable=True)  # 学科
    content = Column(Text, nullable=True)  # 内容
    chapter = Column(String, nullable=True)  # 章节
    knowledge_point = Column(String, nullable=True)  # 知识点

    # 关系
    student = relationship("Student", back_populates="exercises")
