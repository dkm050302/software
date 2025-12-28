# AI Tutor Project

This project is a full-stack application for an AI-powered tutor assistant.

## Structure

- **backend/**: Python FastAPI application handling AI logic (Whisper, LLM, OCR).
- **frontend/**: React application for the user interface.

## Getting Started

### Backend

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # Mac/Linux
   source venv/bin/activate
   ```
3. Install dependencies: 
   ```bash
   pip install -r requirements.txt
   ```
4. Run the server:
   ```bash
   uvicorn app.main:app --reload
   ```
   The API will be available at `http://localhost:8000`.
   API Documentation: `http://localhost:8000/docs`

### Frontend

See [frontend/README.md](frontend/README.md) for setup instructions.
