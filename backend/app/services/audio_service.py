# app/services/audio_service.py
import whisper
import zhconv  # 新增
from fastapi import UploadFile
import tempfile, os

model = whisper.load_model("base")

class AudioService:
    def transcribe(self, audio_file: UploadFile) -> str:
        suffix = f".{audio_file.filename.split('.')[-1]}"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_file.file.read())
            tmp_path = tmp.name
        try:
            result = model.transcribe(tmp_path, language="Chinese")
            text = result["text"]
            # 繁体 → 简体
            return zhconv.convert(text, "zh-cn")
        finally:
            os.remove(tmp_path)


audio_service = AudioService()
