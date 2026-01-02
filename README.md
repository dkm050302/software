# AI Tutor Project

This project is a full-stack application for an AI-powered tutor assistant that integrates multiple AI components including Whisper (STT), LLM, and OCR.

## Project Structure

- **backend/**: Python FastAPI application handling AI logic (Whisper, LLM, OCR).
- **frontend/**: React application for the user interface.

## Dependencies

### Backend Dependencies

The backend requires Python 3.8+ and the following packages (see `backend/requirements.txt`):

- `fastapi>=0.100.0` - Web framework
- `uvicorn>=0.23.0` - ASGI server
- `openai>=1.0.0` - OpenAI API client
- `openai-whisper>=20231117` - Speech-to-text
- `pytesseract>=0.3.10` - OCR
- `python-pptx>=1.0.0` - PowerPoint processing
- `pdfplumber>=0.10.0` - PDF processing
- `opencv-python>=4.8.0` - Image processing
- `pillow>=10.0.0` - Image manipulation
- `sqlalchemy>=2.0.0` - Database ORM
- `passlib` & `bcrypt==4.0.1` - Password hashing
- `python-jose[cryptography]` - JWT authentication
- And other supporting libraries

### Frontend Dependencies

The frontend requires Node.js 16+ and npm. Key dependencies (see `frontend/package.json`):

- `react` & `react-dom` - React framework
- `@mui/material` & `@mui/icons-material` - Material-UI components
- `axios` - HTTP client
- `react-router-dom` - Routing
- `react-markdown` & `remark-gfm` - Markdown rendering
- `mermaid` - Mind map generation
- `recharts` - Data visualization
- `html2canvas` - Screenshot generation
- `vite` - Build tool

## Installation Steps

### Prerequisites

- Python 3.8 or higher
- Node.js 16 or higher and npm
- FFmpeg (for audio processing with Whisper)

### Backend Installation

1. Navigate to the backend folder:

   ```bash
   cd backend
   ```

2. Create a virtual environment (optional but recommended):

   ```bash
   python -m venv venv
   ```

   Activate the virtual environment:

   - **Windows**:
     ```bash
     venv\Scripts\activate
     ```
   - **Mac/Linux**:
     ```bash
     source venv/bin/activate
     ```

3. Install Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Configure Whisper Model:

   If you have a Whisper model compressed package:

   - Extract the compressed package to a local directory (e.g., `C:\whisper-models` on Windows or `~/whisper-models` on Mac/Linux)
   - Add the extracted directory path to your system's PATH environment variable:

     **Windows**:

     1. Open System Properties → Environment Variables
     2. Under "System variables", find and select "Path", then click "Edit"
     3. Click "New" and add the path to your Whisper models directory (e.g., `C:\whisper-models`)
     4. Click "OK" to save

     **Mac/Linux**:
     Add the following line to your `~/.bashrc` or `~/.zshrc`:

     ```bash
     export PATH="$PATH:/path/to/whisper-models"
     ```

     Then reload your shell:

     ```bash
     source ~/.bashrc  # or source ~/.zshrc
     ```

   Alternatively, Whisper will automatically download models on first use if no local model is found. The default model cache location is:

   - **Windows**: `C:\Users\<username>\.cache\whisper\`
   - **Mac/Linux**: `~/.cache/whisper/`

### Frontend Installation

1. Navigate to the frontend folder:

   ```bash
   cd frontend
   ```

2. Install Node.js dependencies:

   ```bash
   npm install
   ```

3. Install additional required packages:
   ```bash
   npm i react-markdown remark-gfm
   npm i github-markdown-css
   npm i html2canvas
   ```

## Run Instructions

### Option 1: Run Backend and Frontend Separately

#### Start Backend Server

1. Navigate to the backend folder:

   ```bash
   cd backend
   ```

2. Activate virtual environment (if using one):

   - **Windows**: `venv\Scripts\activate`
   - **Mac/Linux**: `source venv/bin/activate`

3. Run the FastAPI server:

   ```bash
   uvicorn app.main:app --reload
   ```

   The API will be available at `http://localhost:8000`.
   API Documentation: `http://localhost:8000/docs`

#### Start Frontend Development Server

1. Navigate to the frontend folder:

   ```bash
   cd frontend
   ```

2. Run the development server:

   ```bash
   npm run dev:frontend
   ```

   The application will be available at `http://localhost:5173`.

### Option 2: Run Both Together (Recommended)

From the frontend directory, you can run both backend and frontend concurrently:

```bash
cd frontend
npm run dev
```

This will start both the frontend (port 5173) and backend (port 8000) servers simultaneously.

## Features

- **Authentication**: Login and Register pages with JWT authentication
- **Dashboard**: Visualizes learning progress using `recharts`
- **Note Assistant**: Upload audio files to get AI-generated notes using Whisper STT
- **Map Generation**: Generate mind maps from text using `mermaid`
- **Error Book**: Upload problem images for AI analysis using OCR
- **Parent View**: View AI-generated learning reports

## Configuration

- The frontend is configured to proxy API requests to `http://localhost:8000` (see `frontend/vite.config.js`).
- Ensure your backend server is running on port 8000 before starting the frontend.
- Configure your OpenAI API key and other environment variables in the backend configuration.

## API Documentation

Once the backend server is running, you can access the interactive API documentation at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
