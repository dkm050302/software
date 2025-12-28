import json
import httpx
from app.config import settings

class LLMService:
    def __init__(self):
        self.base_url = settings.DEEPSEEK_BASE_URL
        self.api_key = settings.DEEPSEEK_API_KEY

    async def _call_deepseek(self, messages: list, response_format: str = "text", model: str = "deepseek-chat", timeout: float = 60.0) -> dict:
        if not self.api_key:
            raise ValueError("DeepSeek API Key is missing. Please set DEEPSEEK_API_KEY in .env")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        payload = {
            "model": model,
            "messages": messages,
            "stream": False
        }
        
        if response_format == "json_object":
             payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()

    async def summarize_notes(self, text: str) -> dict:
        prompt = f"""
        请总结以下课堂内容。
        返回一个纯 JSON 对象，不要包含 Markdown 格式。
        JSON 必须包含以下字段:
        - "title": 笔记标题
        - "key_points": 关键点列表 (字符串数组)
        - "examples": 提到的例子列表 (字符串数组)
        
        内容: {text}
        """
        
        messages = [
            {"role": "system", "content": "你是一个专业的AI助教。"},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response_data = await self._call_deepseek(messages, response_format="json_object")
            content = response_data["choices"][0]["message"]["content"]
            return json.loads(content)
        except Exception as e:
            print(f"Error calling DeepSeek: {e}")
            # Fallback or re-raise
            return {
                "title": "Error Generating Notes",
                "key_points": ["Error: " + str(e)],
                "examples": []
            }

    async def analyze_question(self, question_text: str) -> dict:
        prompt = f"""
        请详细分析以下题目。
        注意：题目文本是通过OCR（光学字符识别）从图片中提取的，可能存在识别错误或格式丢失。
        如果题目中似乎包含图表、几何图形或函数图像的描述但缺失了具体数据，请在"explanation"中指出这一点，并尝试根据现有文本进行最合理的推断或给出解题思路。
        
        请提供详尽的解析，包括：
        1. 题目考查的核心知识点。
        2. 详细的解题步骤或思路分析。
        3. 易错点提示。
        
        返回 JSON 对象，包含字段: topic, difficulty, explanation, similar_question。
        其中 explanation 字段的内容应该尽可能详细丰富。
        题目: {question_text}
        """
        
        messages = [
            {"role": "system", "content": "你是一个专业的数学老师。"},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response_data = await self._call_deepseek(messages, response_format="json_object")
            content = response_data["choices"][0]["message"]["content"]
            return json.loads(content)
        except Exception as e:
             print(f"Error calling DeepSeek: {e}")
             return {
                "topic": "Error",
                "difficulty": "Unknown",
                "explanation": str(e),
                "similar_question": ""
            }

    async def generate_mistake_tip(self, question_text: str, subject: str = "") -> str:
        prompt = f"""
        请对以下题目进行简短分析。
        
        要求：
        1. 必须以“这是一道{subject}题目分析：”开头。
        2. 只需列出题目涉及的知识点，不要讲解具体内容或解题步骤。
        3. 给出一个10分制的难度打分（例如：难度：6/10）。
        4. 总字数控制在30字左右。
        
        题目内容: {question_text}
        """
        
        messages = [
            {"role": "system", "content": "你是一个简洁明了的数学助教。"},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response_data = await self._call_deepseek(messages, response_format="text", model="deepseek-reasoner")
            content = response_data["choices"][0]["message"]["content"]
            return content.strip()
        except Exception as e:
            print(f"Error calling DeepSeek for tip: {e}")
            return f"这是一道{subject}题目分析：无法生成分析结果。难度：?/10"

    async def generate_weekly_report(self, context_json: str, subject: str = "总体") -> str:
        prompt = f"""
        你是一个专业的学习顾问。请根据以下学生本周的学习记录（包含错题和笔记的简短分析），生成一份{subject}学习状况报告。
        
        输入数据 (JSON):
        {context_json}
        
        要求：
        1. 输出格式必须是纯 LaTeX 代码（不要包含 ```latex 标记）。
        2. 报告应包含：
           - 本周学习概览
           - 知识点掌握情况分析
           - 存在的问题与建议
        3. 如果是具体学科，请侧重分析该学科的薄弱点。
        4. 如果是总体报告，请综合各科情况。
        5. 使用中文撰写。
        
        """
        
        messages = [
            {"role": "system", "content": "你是一个专业的学习顾问。"},
            {"role": "user", "content": prompt}
        ]
        
        try:
            # Use a longer timeout (120s) for report generation as it can be lengthy
            response_data = await self._call_deepseek(messages, response_format="text", timeout=120.0)
            content = response_data["choices"][0]["message"]["content"]
            # Strip markdown code blocks if present
            content = content.replace("```latex", "").replace("```", "").strip()
            return content
        except Exception as e:
            print(f"Error generating report: {e}")
            return "无法生成报告。"

    async def generate_simple_chat(self, prompt_text: str) -> str:
        messages = [
            {"role": "system", "content": "你是一个学习助手，负责统计学生的错题情况。"},
            {"role": "user", "content": prompt_text}
        ]
        try:
            response = await self._call_deepseek(messages)
            return response["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"LLM Error: {e}")
            return "无法生成统计报告。"

    async def generate_parent_report(self, student_data: dict) -> str:
        prompt = f"""
        根据以下学生数据生成一份给家长的简明学习报告：
        {json.dumps(student_data, ensure_ascii=False)}
        """
        
        messages = [
            {"role": "system", "content": "你是一个贴心的班主任。"},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response_data = await self._call_deepseek(messages)
            return response_data["choices"][0]["message"]["content"]
        except Exception as e:
            return f"Error generating report: {e}"

    async def generate_weekly_analysis(self, data: dict, subject: str = None) -> str:
        if subject and subject != "General":
            prompt = f'''
            请根据以下学生在"{subject}"学科的错题和笔记数据，生成一份详细的学习报告。
            报告必须使用 LaTeX 格式编写。
            
            数据: {json.dumps(data, ensure_ascii=False)}
            
            要求:
            1. 分析错题和笔记情况。
            2. 给出具体的学习建议。
            3. 仅输出 LaTeX 代码（正文部分），不要包含 markdown 代码块标记。
            '''
        else:
            prompt = f'''
            请根据以下学生本周的学习数据（涵盖所有学科的错题和笔记），生成一份总体学习状况报告。
            报告必须使用 LaTeX 格式编写。
            
            数据: {json.dumps(data, ensure_ascii=False)}
            
            要求:
            1. 总结整体学习状况。
            2. 识别薄弱学科。
            3. 给出总体学习建议。
            4. 仅输出 LaTeX 代码（正文部分），不要包含 markdown 代码块标记。
            '''

        messages = [
            {"role": "system", "content": "你是一位专业的教育AI助手。"},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = await self._call_deepseek(messages)
            content = response["choices"][0]["message"]["content"]
            # Clean up markdown code blocks if present
            content = content.replace("```latex", "").replace("```", "").strip()
            return content
        except Exception as e:
            print(f"Error generating weekly analysis: {e}")
            return "无法生成报告。"

    async def generate_mermaid(self, text: str) -> str:
        prompt = (
            "将以下内容转成 Mermaid 思维导图代码，只返回代码，不要解释：\n"
            "格式：graph TD; A[主题] --> B[子主题1]; A --> C[子主题2]; ...\n\n"
            f"内容：\n{text}"
        )
        messages = [{"role": "user", "content": prompt}]
        try:
            response_data = await self._call_deepseek(messages)
            return response_data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"generate_mermaid error: {e}")
            return "graph TD; A[Error] --> B[Failed to generate];"

    async def summarize_knowledge_points(self, raw_text: str) -> dict:
        prompt = f"""
        请把下面的课件/教材内容整理成一份**课堂笔记**，要求：
        1. 用中文、条目化、层次清晰，适合学生直接复习；
        2. 保留关键定义、公式、结论，加少量解释或易错提示；
        3. 如有例子，把解题/推理步骤也写出来；
        4. 总字数 300～800 字左右，不要过度精简；
        5. **额外返回** 本次内容最贴切的
           subject（学科，如"操作系统"）、
           chapter（章节，如"进程与线程"）、
           knowledge_point（知识点，如"进程定义"）；
        6. 输出合法 JSON，格式：
        {{
          "title": "一句话标题",
          "notes": "……完整笔记正文……",
          "subject": "示例学科",
          "chapter": "示例章节",
          "knowledge_point": "示例知识点"
        }}

        待整理内容：
        {raw_text}
        """
        messages = [
            {"role": "system", "content": "你是擅长把教材改写成学生手写笔记的 AI 助教，只返回合法 JSON，不解释。"},
            {"role": "user", "content": prompt}
        ]
        try:
            res = await self._call_deepseek(messages, response_format="json_object")
            content = res["choices"][0]["message"]["content"]
            return json.loads(content)
        except Exception as e:
            return {"title": "笔记生成失败", "notes": str(e)}

    async def generate_plain(self, prompt: str) -> str:
        messages = [{"role": "user", "content": prompt}]
        res = await self._call_deepseek(messages, response_format="text")
        return res["choices"][0]["message"]["content"]

    async def generate_plain(self, prompt: str) -> str:
        messages = [{"role": "user", "content": prompt}]
        res = await self._call_deepseek(messages, response_format="text")
        return res["choices"][0]["message"]["content"]


llm_service = LLMService()
