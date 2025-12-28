import base64
import httpx
import traceback
from app.config import settings
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
    def __init__(self):
        self.api_key = settings.DASHSCOPE_API_KEY
        self.base_url = settings.DASHSCOPE_BASE_URL

    async def extract_text(self, image_file) -> str:
        if not self.api_key:
            print("Error: DASHSCOPE_API_KEY is missing.")
            return "配置错误：未设置 DASHSCOPE_API_KEY。"

        try:
            print(f"Processing image with Qwen-VL: {image_file.filename}")

            # Reset file cursor and read content
            await image_file.seek(0)
            content = await image_file.read()

            if not content:
                print("Error: Read empty content from file.")
                return "错误：无法读取图片内容。"

            # Encode to base64
            # Determine mime type based on filename extension roughly, or just use image/jpeg as generic for base64 header often works,
            # but better to be slightly specific.
            filename = image_file.filename.lower() if image_file.filename else "image.jpg"
            mime_type = "image/jpeg"
            if filename.endswith(".png"):
                mime_type = "image/png"
            elif filename.endswith(".webp"):
                mime_type = "image/webp"

            base64_image = base64.b64encode(content).decode('utf-8')
            data_url = f"data:{mime_type};base64,{base64_image}"

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            # Using qwen-vl-max for best OCR performance
            payload = {
                "model": "qwen-vl-max",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "请提取这张图片中的所有文字，不要包含任何描述性语言，只返回提取的文字内容。如果包含数学公式，请使用LaTeX格式。"},
                            {"type": "image_url", "image_url": {"url": data_url}}
                        ]
                    }
                ]
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)

                if response.status_code != 200:
                    print(f"DashScope API Error: {response.status_code} - {response.text}")
                    return f"OCR服务请求失败: {response.status_code} - {response.text[:100]}"

                result = response.json()
                if "choices" in result and len(result["choices"]) > 0:
                    return result["choices"][0]["message"]["content"]
                else:
                    print(f"Unexpected API response: {result}")
                    return "未能识别出文字。"

        except Exception as e:
            print(f"OCR Service Error: {repr(e)}")
            traceback.print_exc()
            return f"OCR处理出错: {str(e)}"

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