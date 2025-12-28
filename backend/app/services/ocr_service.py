import io
import os
import base64
import requests
from PIL import Image
import numpy as np
import cv2
from app.config import settings

# 读阿里 Key
DASHSCOPE_KEY = settings.DASHSCOPE_API_KEY
ALI_OCR_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"


class OCRService:
    # 旧接口保留，别人继续用
    def extract_text(self, image_file) -> str:
        return "Solve for x: 2x + 5 = 15"

    # 新接口：阿里 OCR，截图/混排友好
    def extract_plain_text(self, image_file) -> str:
        import base64, requests
        from app.config import settings

        img_bytes = image_file.file.read()
        b64 = base64.b64encode(img_bytes).decode()

        # ① 官方推荐：OpenAI-compatible 格式
        payload = {
            "model": "qwen-vl-plus",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                        {"type": "text", "text": "识别图中文字"}
                    ]
                }
            ]
        }

        # ② 正确地址（关键）
        url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

        resp = requests.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
                "Content-Type": "application/json"
            },
            timeout=15
        )

        if resp.status_code != 200:
            raise RuntimeError("Ali-OCR fail: " + resp.text)

        # ③ 取文字
        return resp.json()["choices"][0]["message"]["content"]


ocr_service = OCRService()