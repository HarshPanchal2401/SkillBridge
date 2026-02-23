# SkillBridge Project Flow Diagram

This diagram illustrates the core process of the SkillBridge application, from user onboarding to skill gap analysis and recommendations, highlighting the multi-layered fallback mechanisms.

```mermaid
graph TD
    %% Start
    Start((User Start)) --> Onboarding[User Registration / Login]
    
    %% User Validation Logic (Recently Added)
    Onboarding --> SessionCheck{Validate Session?}
    SessionCheck -- "ID Invalid (404)" --> Logout[Clear Session & Redirect] --> Onboarding
    SessionCheck -- "ID Valid" --> Dashboard[User Dashboard]

    %% Skill Extraction Process
    Dashboard --> ExtractTrigger[Trigger Skill Extraction]
    ExtractTrigger --> ResumeCheck{Resume File Available?}
    
    ResumeCheck -- Yes --> ParseResume[Parse PDF/Docx Text]
    ResumeCheck -- No --> PasteText[User Pastes Text] --> ProcessResume
    
    ParseResume --> ProcessResume[Skill Extraction Engine]
    
    subgraph "Skill Extraction Fallbacks"
        ProcessResume --> HF_Check{HuggingFace API?}
        HF_Check -- Available --> HF_Extract[Extract Skills via LLM]
        HF_Check -- "Fail/Offline" --> Gemini_Check{Gemini API?}
        Gemini_Check -- Available --> Gemini_Extract[Extract Skills via Gemini]
        Gemini_Check -- "Fail/Offline" --> NLP_Fallback[Local NLP Spacy/Rule-based]
    end
    
    HF_Extract --> Filter[Filter & Normalize Skills]
    Gemini_Extract --> Filter
    NLP_Fallback --> Filter
    
    Filter --> SaveDB[(Save to Database)]

    %% Market Analysis Process
    SaveDB --> GapAnalysis[Perform Gap Analysis]
    
    subgraph "Market Analysis Fallbacks"
        GapAnalysis --> Tavily_Check{Tavily Web Search?}
        Tavily_Check -- Available --> WebSearch[Search Live Market Skills]
        Tavily_Check -- "Fail/Offline" --> LinkedIn_Check{LinkedIn API?}
        LinkedIn_Check -- Available --> LinkedInFetch[Fetch Job Postings] --> JobAnalysis[Analyze Job Descriptions]
        LinkedIn_Check -- "Fail/Offline" --> Static_Fallback[Load Role-Requirements JSON]
    end
    
    WebSearch --> Compare[Compare User Skills vs Market]
    JobAnalysis --> Compare
    Static_Fallback --> Compare
    
    %% Final Outputs
    Compare --> Findings[Identify Gaps & Readiness Score]
    Findings --> Recs[Course Recommendations]
    Recs --> Roadmap[Career Roadmap Generation]
    
    %% Styling
    style HF_Extract fill:#f9f,stroke:#333,stroke-width:2px
    style Gemini_Extract fill:#bbf,stroke:#333,stroke-width:2px
    style NLP_Fallback fill:#ddd,stroke:#333,stroke-dasharray: 5 5
    style Static_Fallback fill:#ddd,stroke:#333,stroke-dasharray: 5 5
    style Logout fill:#faa,stroke:#f00
```

### Process Highlights & Fallbacks

| Feature | Primary Method | Secondary Fallback | Basic Fallback |
| :--- | :--- | :--- | :--- |
| **Authentication** | Valid Session | — | Automatic Logout & Redirect |
| **Skill Extraction** | HuggingFace LLM | Google Gemini AI | Spacy / Rule-based NLP |
| **Market Data** | Tavily Live Web Search | LinkedIn Job Scraper | Static `role_requirements.json` |
| **Course Discovery** | API Search | — | Static Recommendations |

> [!NOTE]
> The **Skill Extraction Engine** uses a unified service that automatically attempts the most sophisticated method available before falling back to simpler, local logic.
