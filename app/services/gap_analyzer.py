"""
SmartGapAnalyzer — Deterministic, ontology-first skill gap analysis.

Matching priority for every market skill:
  1. Exact match          — user has the SAME skill name
  2. Ontology match       — market skill is an abstract category, user has ≥1 of its concrete members
  3. Reverse-ontology     — user skill maps to a parent category that equals the market skill
  4. Fuzzy name match     — close enough string (≥ 0.82 similarity)
  Only if ALL four fail → real gap.

Gap severity uses:
  effective_gap = market_demand - (user_proficiency × similarity_factor)
  Critical  : effective_gap > 0.55
  Important : effective_gap 0.25–0.55
  Emerging  : effective_gap < 0.25  (or if partial ontology coverage exists)
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Set, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# SKILL ONTOLOGY
# Keys   → abstract / broad market skill names (normalised: lower, hyphen-sep)
# Values → concrete specific skills that PROVE mastery of the key
# A market requirement is COVERED when user has ≥1 value skill.
# ─────────────────────────────────────────────────────────────────────────────
SKILL_ONTOLOGY: Dict[str, List[str]] = {

    # ── Cloud ────────────────────────────────────────────────────────────────
    "cloud-computing": [
        "aws", "azure", "gcp", "google-cloud", "google cloud", "amazon-web-services",
        "microsoft-azure", "ec2", "s3", "lambda", "cloudformation",
        "cloud-run", "cloud-functions", "heroku", "digitalocean", "linode",
        "cloud", "cloud computing",
    ],
    "cloud-infrastructure": [
        "aws", "azure", "gcp", "google-cloud", "terraform", "cloudformation",
        "ansible", "pulumi", "cdk", "google cloud",
    ],
    "cloud-services": [
        "aws", "azure", "gcp", "google-cloud", "s3", "ec2",
        "lambda", "cloud-functions", "cloud-run",
    ],

    # ── Containers & Orchestration ───────────────────────────────────────────
    "containerization": [
        "docker", "kubernetes", "k8s", "podman", "containerd",
        "helm", "openshift", "docker-compose", "docker-swarm",
    ],
    "container-orchestration": [
        "kubernetes", "k8s", "helm", "openshift", "docker-swarm",
        "aks", "eks", "gke",
    ],
    "infrastructure-as-code": [
        "terraform", "ansible", "cloudformation", "pulumi",
        "chef", "puppet", "cdk",
    ],

    # ── DevOps / CI-CD ───────────────────────────────────────────────────────
    "devops": [
        "docker", "kubernetes", "jenkins", "gitlab-ci", "github-actions",
        "ansible", "terraform", "ci/cd", "circleci", "travis-ci",
        "continuous-integration", "continuous-deployment",
    ],
    "ci/cd": [
        "jenkins", "gitlab-ci", "github-actions", "circleci",
        "travis-ci", "bitbucket-pipelines", "azure-devops",
        "continuous-integration", "continuous-deployment", "argocd",
        "github actions", "gitlab ci",
    ],
    "continuous-integration": [
        "jenkins", "gitlab-ci", "github-actions", "circleci",
        "travis-ci", "bamboo", "teamcity",
    ],
    "continuous-integration/continuous-deployment": [
        "jenkins", "gitlab-ci", "github-actions", "circleci",
        "travis-ci", "bitbucket-pipelines", "azure-devops",
        "continuous-integration", "continuous-deployment", "argocd",
    ],

    # ── Machine Learning / AI ─────────────────────────────────────────────────
    "machine-learning": [
        "scikit-learn", "tensorflow", "pytorch", "keras", "xgboost",
        "lightgbm", "catboost", "sklearn", "ml", "mlflow", "sagemaker",
        "scikit learn",
    ],
    "deep-learning": [
        "tensorflow", "pytorch", "keras", "cnn", "rnn", "lstm",
        "transformer", "bert", "vision-transformer", "neural-network",
        "neural network",
    ],
    "natural-language-processing": [
        "huggingface", "transformers", "bert", "gpt", "spacy", "nltk",
        "llm", "langchain", "openai", "llama", "hugging face",
        "large-language-models", "large language models",
    ],
    "large-language-models": [
        "llm", "gpt", "bert", "llama", "gemini", "openai", "huggingface",
        "transformers", "langchain", "groq", "mistral", "claude",
        "large language models",
    ],
    "computer-vision": [
        "opencv", "pytorch", "tensorflow", "yolo", "detectron2",
        "mediapipe", "pillow", "torchvision", "cv2",
    ],
    "generative-ai": [
        "langchain", "openai", "llm", "gpt", "huggingface",
        "diffusers", "stable-diffusion", "llama", "gemini", "groq",
        "rag", "large-language-models", "genai",
        "generative ai", "gen ai",
    ],
    "mlops": [
        "mlflow", "kubeflow", "airflow", "sagemaker", "tensorflow-serving",
        "torchserve", "bentoml", "evidently", "dvc",
    ],
    "ai-engineering": [
        "langchain", "openai", "llm", "vector-databases", "faiss",
        "pinecone", "weaviate", "rag", "huggingface",
    ],
    "vector-databases": [
        "faiss", "pinecone", "weaviate", "chroma", "qdrant", "milvus",
        "chromadb", "pgvector", "redis", "elasticsearch",
    ],

    # ── Data ─────────────────────────────────────────────────────────────────
    "data-engineering": [
        "apache-spark", "pyspark", "airflow", "kafka", "hadoop",
        "etl", "dbt", "flink", "databricks", "snowflake", "bigquery",
        "apache spark",
    ],
    "data-analysis": [
        "pandas", "numpy", "excel", "sql", "tableau", "power-bi",
        "matplotlib", "seaborn", "plotly", "jupyter", "r",
        "power bi",
    ],
    "data-visualization": [
        "tableau", "power-bi", "matplotlib", "seaborn", "plotly",
        "d3.js", "looker", "grafana", "superset", "power bi",
    ],
    "big-data": [
        "hadoop", "spark", "apache-spark", "pyspark", "kafka",
        "hive", "cassandra", "hbase", "flink", "databricks",
    ],
    "data-warehousing": [
        "snowflake", "bigquery", "redshift", "databricks",
        "dbt", "synapse", "teradata",
    ],
    "etl": [
        "airflow", "spark", "dbt", "talend", "informatica",
        "fivetran", "stitch", "kafka", "nifi",
    ],
    "statistics": [
        "r", "python", "scipy", "numpy", "pandas",
        "spss", "stata", "excel", "matlab",
    ],

    # ── Databases ─────────────────────────────────────────────────────────────
    "databases": [
        "sql", "mysql", "postgresql", "mongodb", "redis",
        "sqlite", "dynamodb", "cassandra", "oracle", "mssql",
        "mariadb", "couchdb", "firebase", "neo4j",
    ],
    "relational-databases": [
        "sql", "mysql", "postgresql", "sqlite", "oracle",
        "mssql", "mariadb", "db2",
    ],
    "nosql-databases": [
        "mongodb", "redis", "cassandra", "dynamodb", "couchdb",
        "firebase", "neo4j", "elasticsearch", "hbase",
    ],
    "sql": [
        "mysql", "postgresql", "sqlite", "mssql", "oracle",
        "mariadb", "sql-server", "plsql", "t-sql", "mysql",
    ],

    # ── Web / Frontend ────────────────────────────────────────────────────────
    "web-development": [
        "react", "angular", "vue", "next.js", "nuxt.js",
        "django", "flask", "fastapi", "node.js", "express.js",
        "spring-boot", "rails", "laravel", "html", "css",
    ],
    "frontend-development": [
        "react", "angular", "vue", "next.js", "svelte",
        "html", "css", "tailwindcss", "bootstrap", "javascript",
        "typescript", "webpack", "vite",
    ],
    "backend-development": [
        "node.js", "express.js", "fastapi", "django", "flask",
        "spring-boot", "rails", "laravel", "go", "rust",
        "java", "python", "nest.js", "asp.net",
    ],
    "full-stack-development": [
        "react", "node.js", "django", "flask", "next.js",
        "vue", "express.js", "mongodb", "postgresql", "mysql",
    ],
    "api-development": [
        "rest-api", "graphql", "fastapi", "flask", "django",
        "express.js", "swagger", "openapi", "postman", "grpc",
    ],
    "rest-api": [
        "fastapi", "flask", "django", "express.js", "node.js",
        "spring-boot", "rails", "laravel", "restful",
    ],

    # ── Mobile ────────────────────────────────────────────────────────────────
    "mobile-development": [
        "react-native", "flutter", "swift", "kotlin", "swiftui",
        "jetpack-compose", "android", "ios", "expo",
    ],
    "cross-platform": [
        "react-native", "flutter", "ionic", "xamarin", "expo",
    ],

    # ── Version Control ───────────────────────────────────────────────────────
    "version-control": [
        "git", "github", "gitlab", "bitbucket", "svn", "mercurial",
    ],
    "source-control": [
        "git", "github", "gitlab", "bitbucket", "svn",
    ],
    "git": [
        "github", "gitlab", "bitbucket",
    ],

    # ── Testing ───────────────────────────────────────────────────────────────
    "testing": [
        "pytest", "jest", "mocha", "cypress", "selenium",
        "junit", "testng", "playwright", "unit-testing",
        "integration-testing", "tdd", "bdd",
    ],
    "test-automation": [
        "selenium", "cypress", "playwright", "jest", "pytest",
        "testng", "robot-framework", "appium",
    ],

    # ── Security ──────────────────────────────────────────────────────────────
    "security": [
        "oauth", "jwt", "ssl", "tls", "owasp", "penetration-testing",
        "encryption", "firewalls", "iam", "zero-trust", "siem",
    ],
    "cybersecurity": [
        "penetration-testing", "owasp", "nmap", "metasploit",
        "wireshark", "splunk", "siem", "soc", "iam",
    ],

    # ── Observability ─────────────────────────────────────────────────────────
    "monitoring": [
        "prometheus", "grafana", "datadog", "new-relic",
        "cloudwatch", "splunk", "elk-stack", "jaeger",
    ],
    "logging": [
        "elk-stack", "elasticsearch", "logstash", "kibana",
        "splunk", "cloudwatch", "datadog", "loki",
    ],

    # ── Agile / Project ───────────────────────────────────────────────────────
    "agile-methodology": [
        "scrum", "kanban", "jira", "confluence", "sprint",
        "agile", "safe", "xp",
    ],
    "project-management": [
        "jira", "confluence", "trello", "asana", "monday.com",
        "ms-project", "basecamp", "notion",
    ],

    # ── Programming paradigms ─────────────────────────────────────────────────
    "scripting": [
        "python", "bash", "shell", "powershell", "ruby",
        "perl", "groovy", "lua",
    ],
    "object-oriented-programming": [
        "java", "python", "c++", "c#", "ruby",
        "scala", "kotlin", "swift", "typescript",
    ],
}

# Build reverse index: specific_skill → [categories it satisfies]
_REVERSE_ONTOLOGY: Dict[str, List[str]] = {}
for _cat, _members in SKILL_ONTOLOGY.items():
    for _m in _members:
        _REVERSE_ONTOLOGY.setdefault(_m, []).append(_cat)


def _norm(s: str) -> str:
    """Lowercase, collapse spaces/underscores to hyphens."""
    return re.sub(r"[\s_]+", "-", s.lower().strip())


def _fuzzy(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


# ─────────────────────────────────────────────────────────────────────────────
class SmartGapAnalyzer:
    """
    Single deterministic gap analysis engine.

    Matching (in priority order) for each market requirement:
      1. Exact name match
      2. Ontology  (market skill is abstract → check concrete members)
      3. Reverse-ontology (user's specific skill → parent category = market skill)
      4. Fuzzy name  (≥ 0.82 similarity)
      → Gap only when all four fail

    Severity uses effective_gap = demand - (proficiency × similarity).
    """

    SIMILARITY_FACTORS = {
        "exact":           1.00,
        "ontology":        0.90,   # user has specific tool that covers abstract need
        "reverse":         0.90,   # user's tool's parent matches market
        "fuzzy":           0.80,
        "none":            0.00,
    }

    GAP_CRITICAL  = 0.55   # effective_gap >  this → Critical
    GAP_IMPORTANT = 0.25   # effective_gap >= this → Important  else Emerging
    FUZZY_THRESH  = 0.82   # minimum SequenceMatcher ratio to count as "same"

    SOFT_SKILLS = {
        "communication", "leadership", "teamwork", "collaboration",
        "presentation", "public-speaking", "negotiation", "time-management",
        "adaptability", "creativity", "analytical-thinking", "attention-to-detail",
        "emotional-intelligence", "decision-making", "problem-solving",
        "critical-thinking", "customer-service", "self-motivation",
    }

    # ── public API ────────────────────────────────────────────────────────────
    def analyze_gaps(
        self,
        user_skills: Dict[str, Dict],
        market_requirements: Dict[str, Dict],
        synonym_map: Optional[Dict] = None,   # kept for backward-compat, unused
    ) -> Dict:
        """
        Compare user skills against market requirements.

        Args:
            user_skills          : {skill_name: {proficiency: float, confidence: float}}
            market_requirements  : {skill_name: {frequency: float, requirement_level: str, trending: bool}}

        Returns standard dict with critical_gaps, important_gaps, emerging_gaps,
        strengths, overall_readiness, summary.
        """
        # Build normalised user lookup: norm_name → proficiency (0–1)
        user_norm: Dict[str, float] = {}
        user_raw_names: Dict[str, str] = {}   # norm → original name
        for raw, data in user_skills.items():
            n = _norm(raw)
            prof = float(data.get("proficiency", 0.5))
            user_norm[n] = prof
            user_raw_names[n] = raw

        user_set: Set[str] = set(user_norm.keys())

        critical_gaps:  List[Dict] = []
        important_gaps: List[Dict] = []
        emerging_gaps:  List[Dict] = []
        strengths:      List[Dict] = []

        for raw_market, req in market_requirements.items():
            norm_market = _norm(raw_market)
            demand      = float(req.get("frequency", 0.0))
            req_level   = req.get("requirement_level", "important")

            # Skip soft skills from gaps
            if norm_market in self.SOFT_SKILLS:
                continue

            base = {
                "skill":              raw_market,
                "demand":             round(demand, 2),
                "demand_percentage":  f"{int(demand * 100)}%",
                "requirement_level":  req_level,
                "trending":           req.get("trending", False),
                "llm_validated":      req.get("llm_validated", False),
            }

            match_type, sim_factor, matched_via, user_prof = self._match(
                norm_market, user_set, user_norm
            )

            if match_type != "none":
                # ── Strength ──────────────────────────────────────────────
                entry = {**base,
                         "user_proficiency": round(user_prof, 2),
                         "match_type":       match_type,
                         "matched_via":      matched_via}
                strengths.append(entry)
            else:
                # ── Gap — classify by effective_gap ───────────────────────
                # user_prof = 0 here (no matching skill found)
                effective_gap = demand   # = demand - 0

                entry = {**base, "effective_gap": round(effective_gap, 2)}

                if effective_gap > self.GAP_CRITICAL:
                    effective_level = "critical"
                elif effective_gap >= self.GAP_IMPORTANT:
                    effective_level = "important"
                else:
                    effective_level = "emerging"

                # Never escalate beyond the market's own declared level
                final_level = self._min_level(effective_level, req_level)
                entry["requirement_level"] = final_level

                if final_level == "critical":
                    critical_gaps.append(entry)
                elif final_level == "important":
                    important_gaps.append(entry)
                else:
                    emerging_gaps.append(entry)

        # Sort by demand descending
        for lst in (critical_gaps, important_gaps, emerging_gaps, strengths):
            lst.sort(key=lambda x: x["demand"], reverse=True)

        readiness = self._readiness(user_set, user_norm, market_requirements)

        return {
            "critical_gaps":  critical_gaps,
            "important_gaps": important_gaps,
            "emerging_gaps":  emerging_gaps,
            "strengths":      strengths,
            "overall_readiness": readiness,
            "summary": {
                "total_gaps":            len(critical_gaps) + len(important_gaps) + len(emerging_gaps),
                "critical_gap_count":    len(critical_gaps),
                "important_gap_count":   len(important_gaps),
                "emerging_gap_count":    len(emerging_gaps),
                "strength_count":        len(strengths),
                "overall_readiness_pct": int(readiness),
                "interpretation":        self._interpret(readiness),
                "top_3_priorities":      [g["skill"] for g in critical_gaps[:3]],
            },
        }

    # ── matching core ─────────────────────────────────────────────────────────
    def _match(
        self,
        norm_market: str,
        user_set: Set[str],
        user_norm: Dict[str, float],
    ) -> Tuple[str, float, List[str], float]:
        """
        Returns (match_type, similarity_factor, matched_via_list, user_proficiency).
        match_type ∈ {"exact", "ontology", "reverse", "fuzzy", "none"}
        """
        # 1. Exact
        if norm_market in user_set:
            return "exact", 1.0, [norm_market], user_norm[norm_market]

        # Also try space variant (some skills stored with spaces)
        space_variant = norm_market.replace("-", " ")
        if space_variant in user_set:
            return "exact", 1.0, [space_variant], user_norm[space_variant]

        # 2. Ontology — market is abstract, look for concrete members in user skills
        members = (
            SKILL_ONTOLOGY.get(norm_market) or
            SKILL_ONTOLOGY.get(norm_market.replace("-", " ")) or
            []
        )
        if members:
            matched = [_norm(m) for m in members if _norm(m) in user_set]
            if not matched:
                # also try the raw member strings directly
                matched = [m for m in members if m in user_set]
            if matched:
                avg_prof = sum(user_norm.get(m, 0.5) for m in matched) / len(matched)
                return "ontology", self.SIMILARITY_FACTORS["ontology"], matched, avg_prof

        # 3. Reverse-ontology — user's skill covers a parent that IS the market skill
        # e.g. user has "gcp" → parent is "cloud-computing" → market wants "cloud-computing"
        for u_skill in user_set:
            parents = _REVERSE_ONTOLOGY.get(u_skill, [])
            # also check space variant of user skill
            parents += _REVERSE_ONTOLOGY.get(u_skill.replace("-", " "), [])
            normed_parents = [_norm(p) for p in parents]
            if norm_market in normed_parents or space_variant in normed_parents:
                return "reverse", self.SIMILARITY_FACTORS["reverse"], [u_skill], user_norm[u_skill]

        # 4. Fuzzy name match
        best_score = 0.0
        best_user  = ""
        for u_skill in user_set:
            s = _fuzzy(norm_market, u_skill)
            if s > best_score:
                best_score = s
                best_user  = u_skill
        if best_score >= self.FUZZY_THRESH:
            return "fuzzy", self.SIMILARITY_FACTORS["fuzzy"], [best_user], user_norm[best_user]

        return "none", 0.0, [], 0.0

    # ── readiness score ───────────────────────────────────────────────────────
    def _readiness(
        self,
        user_set: Set[str],
        user_norm: Dict[str, float],
        market_requirements: Dict[str, Dict],
    ) -> float:
        total_w = 0.0
        attained_w = 0.0
        level_mult = {"critical": 3, "important": 2, "emerging": 1}

        for raw_m, req in market_requirements.items():
            demand   = float(req.get("frequency", 0.0))
            level    = req.get("requirement_level", "important")
            mult     = level_mult.get(level, 1)
            weight   = demand * mult
            total_w += weight

            match_type, sim, _, user_prof = self._match(_norm(raw_m), user_set, user_norm)
            if match_type == "none":
                pass  # 0 contribution
            else:
                # credit = proficiency × similarity × demand_weight
                attained_w += weight * sim * user_prof

        if total_w == 0:
            return 0.0
        raw = attained_w / total_w * 100
        return round(min(raw, 100.0), 1)

    # ── helpers ───────────────────────────────────────────────────────────────
    @staticmethod
    def _min_level(a: str, b: str) -> str:
        """Return the less severe of two requirement levels."""
        order = {"critical": 2, "important": 1, "emerging": 0}
        return a if order.get(a, 1) <= order.get(b, 1) else b

    @staticmethod
    def _interpret(score: float) -> str:
        if score >= 80:
            return "Excellent match. You are highly ready for this role."
        if score >= 60:
            return "Good match. Focus on a few key missing skills to be competitive."
        if score >= 40:
            return "Moderate match. Significant learning required in core areas."
        return "Developing match. Consider foundational courses in this role's technology stack."

    # kept for backward-compat with course recommender
    def get_missing_skills(
        self,
        user_skills: Dict[str, Dict],
        market_requirements: Dict[str, Dict],
        min_frequency: float = 0.3,
        synonym_map: Optional[Dict] = None,
    ) -> List[str]:
        result = self.analyze_gaps(user_skills, market_requirements)
        return [
            g["skill"]
            for g in result["critical_gaps"] + result["important_gaps"]
            if g["demand"] >= min_frequency
        ]


# ── backward-compat alias ────────────────────────────────────────────────────
GapAnalyzer = SmartGapAnalyzer