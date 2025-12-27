from app.database import SessionLocal
from app import models

db = SessionLocal()
teachers = db.query(models.Teacher).all()
print(f"Found {len(teachers)} teachers.")
for t in teachers:
    print(f"ID: {t.id}, Name: {t.email}, Subject: {t.subject}")

tags = db.query(models.KnowledgeTag).all()
print(f"Found {len(tags)} knowledge tags.")
for tag in tags:
    print(f"Tag ID: {tag.id}, Teacher ID: {tag.teacher_id}, Subject: {tag.subject}, Chapter: {tag.chapter}, Point: {tag.knowledge_point}")
