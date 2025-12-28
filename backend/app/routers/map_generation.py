# app/routers/map_generation.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.llm_service import llm_service
import re

router = APIRouter()

class NoteContent(BaseModel):
    content: str = Field(..., min_length=3, max_length=8000)
    template: str = Field("default", pattern=r"^(default|timeline|compare|layer)$")

def half_width(text: str) -> str:
    # 中文→英文标点，一一对应，长度必须相等
    return text.translate(str.maketrans({
        '，': ',', '。': '.', '；': ';', '：': ':',
        '“': '"', '”': '"', '‘': "'", '’': "'",
        '（': '(', '）': ')', '！': '!', '？': '?'
    }))

@router.post("/generate")
async def generate_mindmap(note: NoteContent):
    prompt = (
            "你是‘知识导图生成器’，必须按下面规则输出，否则视为失败：\n"
            "1. 输出必须是 Mermaid ‘mindmap’ 语法，根节点固定为 root(第8章 两个样本推断)；\n"
            "2. 只许出现 2 层子节点，关键词 4~8 字，禁止整句抄原文；\n"
            "3. 节点文字里禁止出现英文括号 ( ) 和方括号 [ ]，避免渲染失败；\n"
            "4. 不要 markdown 包裹，不要解释，只给代码；\n"
            "5. 示例格式：\n"
            "mindmap\n"
            "root(第8章 两个样本推断)\n"
            "  目标参数\n"
            "    均值差异\n"
            "    比例差异\n"
            "  均值比较\n"
            "    大样本\n"
            "    小样本\n"
            "  比例比较\n"
            "    置信区间\n"
            "    样本量\n"
            "请对下文提炼并生成：\n" + note.content
    )
    raw = await llm_service.generate_plain(prompt)
    code = re.sub(r'```mermaid|```', '', raw).strip()
    code = half_width(code)
    if not code:
        raise HTTPException(status_code=500, detail="LLM 返回空代码")
    # 把 mindmap 也加入白名单
    if not re.match(r'^(graph|flowchart|timeline|gitGraph|mindmap)', code.lstrip()):
        raise HTTPException(status_code=500, detail=f"LLM 语法错误，原始内容：{code[:200]}")
    return {"mermaid_source": code}