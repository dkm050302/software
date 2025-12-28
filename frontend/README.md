# AI Tutor Frontend

This is the React frontend for the AI Tutor application.

## Setup

cd frontend

1.  **Install Dependencies**:
    Open a terminal in this `frontend` folder and run:
    `ash


    npm install 
    npm i react-markdown remark-gfm
    npm i github-markdown-css
    npm i html2canvas

    ``n
2.  **Run Development Server**:
    ` ash
npm run dev
npm run dev:frontend
``n    The application will be available at  `http://localhost:5173`.

## Features

- **Authentication**: Login and Register pages.
- **Dashboard**: Visualizes learning progress using `recharts`.
- **Note Assistant**: Upload audio files to get AI-generated notes.
- **Map Generation**: Generate mind maps from text using `mermaid`.
- **Error Book**: Upload problem images for AI analysis.
- **Parent View**: View AI-generated learning reports.

## Configuration

The frontend is configured to proxy API requests to `http://localhost:8000` (see `vite.config.js`).
Ensure your backend server is running on port 8000.
