# 🏥 Skill intelligence System (SkillBridge)

An AI-powered skill gap analysis and course recommendation platform. SkillBridge extracts skills from resumes, analyzes job market requirements, identifies skill gaps, and recommends personalized learning paths.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [Environment Variables](#-environment-variables)
- [How to Run](#-how-to-run)
- [API Endpoints](#-api-endpoints)
- [License](#-license)

---

## ✨ Features

### Core Features
- **👤 User Profile Management** - Register users with education, target roles, and career goals.
- **📄 Resume Parsing** - Upload and parse PDF/DOCX resumes to extract skills automatically.
- **🎯 Dynamic Skill Extraction** - NLP-based extraction from resumes, projects, and work experience using an expanded taxonomy of 250+ technical and soft skills.
- **💼 LinkedIn Job Integration** - Real-time job listings and requirement analysis via RapidAPI.
- **📊 Gap Analysis** - Intelligent comparison between user skills and job market requirements with "Readiness Scores."
- **📚 AI Course Recommendations** - Personalized learning paths using Tavily AI to find the best courses on Coursera, Udemy, and edX.
- **🐙 GitHub Analysis** - Deep analysis of GitHub repositories to extract demonstrated technical skills from codebases and READMEs.

---

## 🛠 Tech Stack

### Backend
- **Framework**: FastAPI
- **Database**: SQLite
- **NLP**: spaCy, scikit-learn
- **Parsing**: PyPDF2, python-docx
- **Search**: Tavily AI, RapidAPI (LinkedIn)

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Animations**: Framer Motion

---

## 📁 Project Structure

```
SkillBridge/
├── app/                  # FastAPI Backend
│   ├── routers/          # API Route Modules
│   ├── services/         # Business Logic (NLP, Analyzers)
│   ├── models.py         # DB Models
│   └── schemas.py        # Pydantic Schemas
│
├── frontend/             # Next.js Frontend
│   ├── src/
│   │   ├── app/          # Pages & Routes
│   │   ├── components/   # UI Components
│   │   └── lib/          # API Client & Utils
│   └── public/           # Static Assets
│
├── main.py               # Backend Entry Point
├── requirements.txt      # Python Dependencies
└── .env                  # API Keys Configuration
```

---

## 🚀 Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### Step 1: Clone and Backend Setup
```bash
# Clone repository
git clone https://github.com/your-username/Error_404.git
cd Error_404

# Setup Python environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Frontend Setup
```bash
cd frontend
npm install
```

### Step 3: Environment Configuration
Create a `.env` file in the root directory:
```env
RAPIDAPI_KEY=your_rapidapi_key
TAVILY_API_KEY=your_tavily_api_key
```

---

## ▶️ How to Run

### 1. Start Backend (Terminal 1)
```bash
python main.py
```
The API will be available at `http://localhost:8000`. Swagger docs at `/docs`.

### 2. Start Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
The application will be available at `http://localhost:3000`.

---

## 📡 Key API Endpoints

### Users & Skills
- `POST /api/users/register` - Create new user profile.
- `GET /api/users/{id}/profile` - Get full profile stats and completion.
- `POST /api/skills/extract/{user_id}` - Extract all skills from user data sources.
- `GET /api/skills/users/{user_id}` - Fetch extracted skill list.

### Analysis & AI
- `POST /api/users/{user_id}/gap-analysis` - Calculate career readiness vs target role.
- `GET /api/users/{user_id}/recommended-courses` - Fetch AI-curated learning paths.
- `POST /api/users/{user_id}/analyze-github` - Start repository-based skill extraction.

---

## 📄 License
This project is developed for educational purposes by **Team Error_404**.

**Made with ❤️ for the future of career intelligence.**
