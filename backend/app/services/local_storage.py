import os
import shutil
import json
from pathlib import Path
from typing import Optional, List, Dict

class LocalStorageService:
    BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

    @classmethod
    def _get_student_dir(cls, student_id: str) -> Path:
        return Path(cls.BASE_DIR) / str(student_id)

    @classmethod
    def _get_mistake_dir(cls, student_id: str, chapter: str, title: str) -> Path:
        # Sanitize chapter and title to be safe for filesystem
        safe_chapter = cls._sanitize_filename(chapter)
        safe_title = cls._sanitize_filename(title)
        return cls._get_student_dir(student_id) / "mistakes" / safe_chapter / safe_title

    @classmethod
    def _sanitize_filename(cls, filename: str) -> str:
        import re
        # Remove path separators and other dangerous characters
        # Keep it simple but safe
        filename = re.sub(r'[<>:"/\\|?*]', '_', str(filename))
        return filename.strip()

    @classmethod
    def ensure_directories(cls, student_id: str):
        """Ensure the basic directory structure exists for the student."""
        student_dir = cls._get_student_dir(student_id)
        (student_dir / "mistakes").mkdir(parents=True, exist_ok=True)
        (student_dir / "weekly_reports").mkdir(parents=True, exist_ok=True)

    @classmethod
    def create_mistake_entry(
        cls,
        student_id: str,
        chapter: str,
        title: str,
        content: str,
        note: str,
        graph_1_src_path: str,
        graph_2_src_path: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """
        Creates the local file structure for a mistake.
        graph_1_src_path: Absolute or relative path to the source image file.
        """
        cls.ensure_directories(student_id)
        target_dir = cls._get_mistake_dir(student_id, chapter, title)
        target_dir.mkdir(parents=True, exist_ok=True)

        # Save content
        with open(target_dir / "content.txt", "w", encoding="utf-8") as f:
            f.write(content or "")

        # Save note
        with open(target_dir / "note.txt", "w", encoding="utf-8") as f:
            f.write(note or "")
            
        # Save metadata
        if metadata:
            with open(target_dir / "metadata.json", "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

        # Copy graphs
        # We assume graph_1_src_path is relative to backend root or absolute
        # The router saves them to "uploads/mistakes/..."
        
        # Helper to resolve source path
        def resolve_path(path_str):
            if os.path.isabs(path_str):
                return Path(path_str)
            # Assuming path is relative to backend root (where main.py usually runs, or root of repo)
            # The router uses "uploads/mistakes", which is relative to CWD.
            # We need to be careful about CWD. 
            # In the router: os.makedirs("uploads/mistakes") -> relative to CWD.
            return Path(path_str)

        if graph_1_src_path and os.path.exists(resolve_path(graph_1_src_path)):
            src = resolve_path(graph_1_src_path)
            # Preserve extension
            ext = src.suffix
            dst = target_dir / f"graph_1{ext}"
            shutil.copy2(src, dst)

        if graph_2_src_path and os.path.exists(resolve_path(graph_2_src_path)):
            src = resolve_path(graph_2_src_path)
            ext = src.suffix
            dst = target_dir / f"graph_2{ext}"
            shutil.copy2(src, dst)

    @classmethod
    def update_mistake_entry(
        cls,
        student_id: str,
        old_chapter: str,
        old_title: str,
        new_chapter: str,
        new_title: str,
        new_content: Optional[str] = None,
        new_note: Optional[str] = None,
        new_metadata: Optional[Dict] = None
    ):
        old_dir = cls._get_mistake_dir(student_id, old_chapter, old_title)
        new_dir = cls._get_mistake_dir(student_id, new_chapter, new_title)

        # 1. Handle Move/Rename
        if old_dir != new_dir:
            if old_dir.exists():
                # Ensure parent of new_dir exists
                new_dir.parent.mkdir(parents=True, exist_ok=True)
                # Rename/Move
                # If new_dir already exists (e.g. merging into existing title), we might have issues.
                # For now, let's assume we move.
                if new_dir.exists():
                    # If target exists, we can't just rename. We might need to merge files?
                    # Or maybe we just move the contents?
                    # Let's try to move the folder. If it fails, we might need to copy files.
                    # Simple approach: Rename. If fail, log it.
                    # But wait, shutil.move can handle it.
                    pass
                
                try:
                    shutil.move(str(old_dir), str(new_dir))
                except Exception as e:
                    print(f"Error moving mistake directory: {e}")
                    # If move fails (e.g. target exists), we might want to just ensure new_dir exists
                    # and write the text files there.
                    new_dir.mkdir(parents=True, exist_ok=True)
            else:
                # Old dir doesn't exist, just create new one
                new_dir.mkdir(parents=True, exist_ok=True)

        # 2. Update Content/Note
        # Even if we didn't move, we might need to update text files.
        # If we moved, new_dir is now the valid one.
        
        if not new_dir.exists():
             new_dir.mkdir(parents=True, exist_ok=True)

        if new_content is not None:
            with open(new_dir / "content.txt", "w", encoding="utf-8") as f:
                f.write(new_content)

        if new_note is not None:
            with open(new_dir / "note.txt", "w", encoding="utf-8") as f:
                f.write(new_note)
                
        if new_metadata is not None:
            # Read existing metadata if any
            existing_metadata = {}
            meta_path = new_dir / "metadata.json"
            if meta_path.exists():
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        existing_metadata = json.load(f)
                except:
                    pass
            
            existing_metadata.update(new_metadata)
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(existing_metadata, f, ensure_ascii=False, indent=2)

    @classmethod
    def list_mistakes(cls, student_id: str) -> List[Dict]:
        """
        Lists all mistakes for a student by traversing the directory structure.
        Returns a list of dictionaries compatible with the frontend.
        """
        mistakes_dir = cls._get_student_dir(student_id) / "mistakes"
        if not mistakes_dir.exists():
            return []

        results = []
        
        # Structure: mistakes/{chapter}/{title}
        for chapter_dir in mistakes_dir.iterdir():
            if not chapter_dir.is_dir():
                continue
            
            chapter_name = chapter_dir.name
            
            for title_dir in chapter_dir.iterdir():
                if not title_dir.is_dir():
                    continue
                
                title_name = title_dir.name
                
                # Read metadata
                metadata = {}
                meta_path = title_dir / "metadata.json"
                if meta_path.exists():
                    try:
                        with open(meta_path, "r", encoding="utf-8") as f:
                            metadata = json.load(f)
                    except:
                        pass
                
                # Read content and note
                content = ""
                content_path = title_dir / "content.txt"
                if content_path.exists():
                    try:
                        with open(content_path, "r", encoding="utf-8") as f:
                            content = f.read()
                    except:
                        pass
                        
                note = ""
                note_path = title_dir / "note.txt"
                if note_path.exists():
                    try:
                        with open(note_path, "r", encoding="utf-8") as f:
                            note = f.read()
                    except:
                        pass
                
                # Find graphs
                graph_1 = None
                graph_2 = None
                for file in title_dir.iterdir():
                    if file.name.startswith("graph_1"):
                        # We need to return a path that the frontend can access.
                        # Since these are local files, we might need to serve them statically.
                        # Or we can return the relative path from the 'data' directory if we serve 'data' statically.
                        # Assuming we serve 'data' directory or similar.
                        # Actually, the backend usually serves 'uploads'. 
                        # If we want to serve from 'data', we need to mount it in main.py.
                        # For now, let's return the relative path from backend root.
                        # But wait, the frontend expects a URL.
                        # If we don't have a static mount for 'data', we can't serve them easily.
                        # However, the user asked to "store to local".
                        # If the user wants to VIEW them, we must serve them.
                        # I will assume I need to mount 'data' in main.py later.
                        # Let's return a path like "/data/{student_id}/mistakes/{chapter}/{title}/{filename}"
                        graph_1 = f"/data/{student_id}/mistakes/{chapter_name}/{title_name}/{file.name}"
                    elif file.name.startswith("graph_2"):
                        graph_2 = f"/data/{student_id}/mistakes/{chapter_name}/{title_name}/{file.name}"

                # Construct the mistake object
                # We use a composite ID: "local::{chapter}::{title}"
                # We need to be careful about special chars in ID.
                import base64
                composite_id = base64.urlsafe_b64encode(f"{chapter_name}::{title_name}".encode()).decode()
                
                mistake = {
                    "id": composite_id, # String ID
                    "student_id": student_id,
                    "chapter": chapter_name,
                    "title": title_name,
                    "content": content,
                    "note": note,
                    "graph_1": graph_1,
                    "graph_2": graph_2,
                    "subject": metadata.get("subject", "Unknown"),
                    "knowledge_point": metadata.get("knowledge_point", ""),
                    "date": metadata.get("date", ""),
                    "tip": metadata.get("tip", ""),
                    "is_local": True
                }
                results.append(mistake)
                
        return results

    @classmethod
    def delete_mistake_entry(cls, student_id: str, chapter: str, title: str):
        target_dir = cls._get_mistake_dir(student_id, chapter, title)
        if target_dir.exists():
            shutil.rmtree(target_dir)
        
        # Optional: Clean up chapter folder if empty?
        # chapter_dir = target_dir.parent
        # if chapter_dir.exists() and not any(chapter_dir.iterdir()):
        #     chapter_dir.rmdir()

    @classmethod
    def save_weekly_report(cls, student_id: str, report_data: dict, filename: str):
        """
        Saves the weekly report to the student's local directory.
        """
        cls.ensure_directories(student_id)
        target_dir = cls._get_student_dir(student_id) / "weekly_reports"
        target_file = target_dir / filename
        
        import json
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

local_storage = LocalStorageService()
