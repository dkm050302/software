# app/routers/map_generation.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.llm_service import llm_service
import re

router = APIRouter()


class NoteContent(BaseModel):
    content: str = Field(..., min_length=3, max_length=8000)
    template: str = Field("default", pattern=r"^(default|timeline|compare|layer)$")
    title: str | None = Field(None, max_length=60)   # 新增：自定义根节点标题


def half_width(text: str) -> str:
    """中文标点→英文标点，长度一一对应"""
    return text.translate(str.maketrans({
        '，': ',', '。': '.', '；': ';', '：': ':',
        '“': '"', '”': '"', '‘': "'", '’': "'",
        '（': '(', '）': ')', '！': '!', '？': '?'
    }))


@router.post("/generate")
async def generate_mindmap(note: NoteContent):
    # 如果前端没传标题，就沿用旧默认值（可再改成让模型自己提炼）
    root_title = note.title if note.title else "root"

    prompt = (
        f"你是‘知识导图生成器’，必须按下面规则输出，否则视为失败：\n"
        f"1. 输出必须是 Mermaid ‘mindmap’ 语法，根节点固定为 {root_title}；\n"
        "2. 只许出现 2 层子节点，关键词 4~8 字，禁止整句抄原文；\n"
        "3. 节点文字里禁止出现英文括号 ( ) 和方括号 [ ]，避免渲染失败；\n"
        "4. 不要 markdown 包裹，不要解释，只给代码；\n"
        "5. 示例格式：\n"
        "mindmap\n"
        f"{root_title}\n"
        "  目标参数\n"
        "    均值差异\n"
        "    比例差异\n"
        "请对下文提炼并生成：\n" + note.content
    )

    raw = await llm_service.generate_plain(prompt)
    code = re.sub(r'```mermaid|```', '', raw).strip()
    code = half_width(code)

    if not code:
        raise HTTPException(status_code=500, detail="LLM 返回空代码")

    if not re.match(r'^(graph|flowchart|timeline|gitGraph|mindmap)', code.lstrip()):
        raise HTTPException(status_code=500, detail=f"LLM 语法错误，原始内容：{code[:200]}")

    return {"mermaid_source": code}