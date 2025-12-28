from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from pydantic import BaseModel
from app.services.audio_service import audio_service
from app.services.llm_service import llm_service
from app.services.ocr_service import ocr_service
import io
from pptx import Presentation
import pdfplumber
import json, time
from pathlib import Path
from app.config import settings
from app.dependencies import get_current_user

router = APIRouter()

# ---------- 原有上传接口（不动） ----------
@router.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    transcript = audio_service.transcribe(file)
    knowledge = await llm_service.summarize_knowledge_points(transcript)
    return {"transcript": transcript, "structured_notes": knowledge}

@router.post("/upload-ppt")
async def upload_ppt(file: UploadFile = File(...)):
    prs = Presentation(io.BytesIO(await file.read()))
    text = ""
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                text += shape.text + "\n"
    knowledge = await llm_service.summarize_knowledge_points(text)
    return {"transcript": text, "structured_notes": knowledge}

@router.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    text = ""
    with pdfplumber.open(io.BytesIO(await file.read())) as pdf:
        for page in pdf.pages:
            text += (page.extract_text() or "") + "\n"
    knowledge = await llm_service.summarize_knowledge_points(text)
    return {"transcript": text, "structured_notes": knowledge}

@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    text = ocr_service.extract_plain_text(file)
    knowledge = await llm_service.summarize_knowledge_points(text)
    return {"transcript": text, "structured_notes": knowledge}


# ---------- 新增：纯文件版保存/读取 ----------
class NoteSaveRequest(BaseModel):
    title: str
    notes: str
    subject: str | None = None
    chapter: str | None = None
    knowledge_point: str | None = None


@router.post("/save-file")
def save_note_file(payload: NoteSaveRequest,
                   user: dict = Depends(get_current_user)):
    """保存笔记为独立 JSON 文件"""
    student_id = user["user"].student_id
    ts = int(time.time())
    safe_title = "".join(c for c in payload.title if c.isalnum() or c in (" ", "-", "_")).rstrip()
    filename = f"{student_id}_note_{safe_title}_{ts}.json"
    file_path: Path = settings.NOTE_DIR / filename

    payload_dict = payload.dict()
    payload_dict.update({
        "student_id": student_id,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    })

    with file_path.open("w", encoding="utf-8") as f:
        json.dump(payload_dict, f, ensure_ascii=False, indent=2)

    return {"message": "saved", "file": filename}


@router.get("/list-files")
def list_note_files(user: dict = Depends(get_current_user)):
    """返回该学生所有笔记文件摘要"""
    student_id = user["user"].student_id
    pattern = f"note_{student_id}_*.json"
    files = sorted(settings.NOTE_DIR.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return [{"file": f.name, "title": json.load(f.open(encoding="utf-8")).get("title")} for f in files]


@router.get("/file/{filename}")
def get_note_file(filename: str, user: dict = Depends(get_current_user)):
    """下载/查看单个笔记文件"""
    student_id = user["user"].student_id
    if not filename.startswith(f"note_{student_id}_"):
        raise HTTPException(403, "No permission")
    file_path = settings.NOTE_DIR / filename
    if not file_path.is_file():
        raise HTTPException(404, "File not found")
    return FileResponse(file_path, media_type="application/json")


from fastapi import Query, Body
import json, re


# 1. 列表：仅返回 文件名 + 标题 + 修改时间
@router.get("/my-notes")
def list_my_notes(user=Depends(get_current_user)):
    pattern = f"{user['user'].student_id}_note_*.json"
    files = sorted(settings.NOTE_DIR.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        {
            "filename": f.name,
            "title": json.loads(f.read_text(encoding="utf-8")).get("title"),
            "mtime": f.stat().st_mtime,
        }
        for f in files
    ]


# 2. 读取完整内容
@router.get("/content")
def get_note_content(
    filename: str = Query(..., description="文件名"),
    user=Depends(get_current_user)
):
    # 安全：只能读自己的
    if not filename.startswith(f"{user['user'].student_id}_note_"):
        raise HTTPException(403, "只能查看自己的笔记")
    file_path = settings.NOTE_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, "文件不存在")
    return json.loads(file_path.read_text(encoding="utf-8"))

# 3. 修改（标题+内容+重命名）
class NoteUpdate(BaseModel):
    old_filename: str
    new_title: str
    new_notes: str


@router.put("/update")
def update_note(payload: NoteUpdate, user=Depends(get_current_user)):
    uid = user['user'].student_id
    if not payload.old_filename.startswith(f"{uid}_note_"):
        raise HTTPException(403, "只能修改自己的笔记")

    old_path = settings.NOTE_DIR / payload.old_filename
    if not old_path.exists():
        raise HTTPException(404, "原文件不存在")

    # 生成新文件名：保留前缀，用新标题+当前时间戳
    safe_title = "".join(c for c in payload.new_title if c.isalnum() or c in (" ", "-", "_")).rstrip()
    new_filename = f"{uid}_note_{safe_title}_{int(time.time())}.json"
    new_path = settings.NOTE_DIR / new_filename

    # 把文件内字段也同步更新
    data = json.loads(old_path.read_text(encoding="utf-8"))
    data.update({
        "title": payload.new_title,
        "notes": payload.new_notes,
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")  # 可选
    })

    # 写新文件 → 删除旧文件 → 返回新文件名
    new_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    old_path.unlink()
    return {"message": "已更新", "new_filename": new_filename}


@router.delete("/delete")
def delete_note(
    filename: str = Query(..., description="文件名"),
    user=Depends(get_current_user)
):
    uid = user["user"].student_id
    if not filename.startswith(f"{uid}_note_"):
        raise HTTPException(403, "只能删除自己的笔记")

    file_path: Path = settings.NOTE_DIR / filename
    if not file_path.is_file():
        raise HTTPException(404, "文件不存在")

    file_path.unlink()          # 真正删除
    return {"message": "已删除"}













