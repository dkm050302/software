# app/routers/map_save.py
import os, pathlib, shutil
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.config import settings
from fastapi import Depends, UploadFile, File, Query
from app.dependencies import get_current_user as _get_user

def get_current_user(user: dict = Depends(_get_user)) -> str:
    # 统一用学号当文件名前缀
    return user["user"].student_id

router = APIRouter()

SAVE_DIR = pathlib.Path(settings.NOTE_DIR).parent / "image"
SAVE_DIR.mkdir(parents=True, exist_ok=True)

class SaveReq(BaseModel):
    svgCode: str          # 前端把 mermaid 源码发过来
    fileName: str         # 带扩展名 .mmd  例如  alice_map001.mmd

def _check_owner(file_name: str, user: str):
    """文件名必须以 用户名_ 开头"""
    if not file_name.startswith(user + "_"):
        raise HTTPException(403, detail="只能操作自己的文件")

@router.post("/save")
async def save_map(req: SaveReq, user: str = Depends(get_current_user)):
    # 自动加前缀：学号_原文件名
    safe_name = f"{user}_{req.fileName}"
    path = SAVE_DIR / safe_name

    # 防止目录穿越
    if path.resolve().parent != SAVE_DIR.resolve():
        raise HTTPException(400, detail="非法路径")

    with open(path, "w", encoding="utf-8") as f:
        f.write(req.svgCode)

    return {"msg": "saved", "file": safe_name}

@router.get("/list")
async def list_maps(user: str = Depends(get_current_user)):
    # 只列出 用户名_*.mmd
    files = []
    for ext in ("mmd", "png"):
        files.extend(f.name for f in SAVE_DIR.glob(f"{user}_*.{ext}"))
    return {"files": files}

@router.get("/content/{file_name}")
async def get_map(file_name: str, user: str = Depends(get_current_user)):
    _check_owner(file_name, user)
    path = SAVE_DIR / file_name
    if not path.exists():
        raise HTTPException(404, detail="文件不存在")

    # 1. 文本文件直接读
    if path.suffix.lower() == ".mmd":
        with open(path, encoding="utf-8") as f:
            return {"content": f.read()}

    # 2. 二进制文件走 FastAPI 的 FileResponse 供前端下载
    from fastapi.responses import FileResponse
    return FileResponse(path, media_type="image/png" if path.suffix.lower() == ".png" else "application/octet-stream")


@router.post("/upload-png")
async def upload_png(file: UploadFile = File(...),
                     user: str = Depends(get_current_user)):
    """前端把生成的 png 直接当文件传上来"""
    if not file.filename or not file.filename.lower().endswith(".png"):
        raise HTTPException(400, "只允许上传 png")
    safe_name = f"{user}_{file.filename.split('/')[-1]}"  # 去掉路径
    out_path = SAVE_DIR / safe_name
    with out_path.open("wb") as f:
        f.write(await file.read())
    return {"msg": "saved", "file": safe_name}


@router.delete("/delete")
def delete_map(
    file_name: str = Query(..., description="带扩展名的文件名，如 alice_map001.mmd"),
    user: str = Depends(get_current_user)
):
    _check_owner(file_name, user)          # 必须自己的文件
    path = SAVE_DIR / file_name
    if not path.exists():
        raise HTTPException(404, detail="文件不存在")

    # 同时删掉可能存在的同名 png
    for ext in ("mmd", "png"):
        (SAVE_DIR / f"{file_name.rsplit('.', 1)[0]}.{ext}").unlink(missing_ok=True)

    return {"msg": "deleted", "file": file_name}