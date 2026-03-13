"""
SmartGapAnalyzer — Deterministic, ontology-first skill gap analysis.
Optimized for minimal latency:

  • Ontology member strings are pre-normalised into frozensets at import time
    → ontology lookup is O(|members|) set intersection, not a per-call loop.
  • _norm() is memoised with lru_cache — each unique string is normalised once.
  • Reverse-ontology is built at import and keyed by normalised skill name.
  • _match() is called ONCE per market skill; that result is reused for both
    gap classification AND the readiness score (previously called twice).
  • Fuzzy matching uses rapidfuzz (C extension, ~20× faster), falls back to
    SequenceMatcher when rapidfuzz is not installed.

Matching priority for every market skill:
  1. Exact match          — user has the SAME skill name (set lookup O(1))
  2. Ontology match       — market skill is an abstract category, user has ≥1
                            of its concrete members (frozenset intersection O(k))
  3. Reverse-ontology     — user skill maps to a parent category that equals
                            the market skill (dict + set lookup O(1))
  4. Fuzzy name match     — close enough string (≥ 0.82 similarity)
  Only if ALL four fail → real gap.

Gap severity uses:
  effective_gap = market_demand - (user_proficiency × similarity_factor)
  Critical  : effective_gap >  0.55
  Important : effective_gap >= 0.25
  Emerging  : effective_gap <  0.25
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import Dict, FrozenSet, List, Optional, Set, Tuple

# ── fast fuzzy backend ────────────────────────────────────────────────────────
try:
    from rapidfuzz.distance import JaroWinkler as _rfjw
    def _fuzzy(a: str, b: str) -> float:
        return _rfjw.similarity(a, b)
except ImportError:
    from difflib import SequenceMatcher
    def _fuzzy(a: str, b: str) -> float:  # type: ignore[misc]
        return SequenceMatcher(None, a, b).ratio()


# ─────────────────────────────────────────────────────────────────────────────
# SKILL ONTOLOGY
# Keys   → abstract / broad market skill names (normalised: lower, hyphen-sep)
# Values → concrete specific skills that PROVE mastery of the key
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
    "artificial-intelligence": [
        "machine-learning", "deep-learning", "natural-language-processing",
        "computer-vision", "generative-ai", "large-language-models",
        "neural-networks", "ai", "artificial intelligence", "genai",
        "reinforcement-learning", "tensorflow", "pytorch",
    ],
    "ai": [
        "machine-learning", "deep-learning", "natural-language-processing",
        "computer-vision", "generative-ai", "large-language-models",
        "artificial-intelligence", "artificial intelligence"
    ],
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
        "mariadb", "sql-server", "plsql", "t-sql",
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

# ── Pre-built lookup structures (computed ONCE at import time) ────────────────

@lru_cache(maxsize=4096)
def _norm(s: str) -> str:
    """Lowercase, collapse spaces/underscores to hyphens. Cached."""
    return re.sub(r"[\s_]+", "-", s.lower().strip())


# Normalised ontology: norm_cat → frozenset of norm_member strings
_ONTO_NORM: Dict[str, FrozenSet[str]] = {
    _norm(cat): frozenset(_norm(m) for m in members)
    for cat, members in SKILL_ONTOLOGY.items()
}

# Also keep a space-variant key for lookup convenience
_ONTO_NORM_SPACE: Dict[str, FrozenSet[str]] = {
    k.replace("-", " "): v for k, v in _ONTO_NORM.items()
}

# Reverse index: norm_specific_skill → set of norm_categories it satisfies
_REV_ONTO: Dict[str, Set[str]] = {}
for _cat_n, _members_n in _ONTO_NORM.items():
    for _m in _members_n:
        _REV_ONTO.setdefault(_m, set()).add(_cat_n)


# ─────────────────────────────────────────────────────────────────────────────
class SmartGapAnalyzer:
    """
    Single-pass, deterministic gap analysis engine.

    Key optimisations vs the previous version
    ------------------------------------------
    1. _norm()  : lru_cache — each string normalised only once.
    2. Ontology : frozenset intersection replaces nested loops.
    3. Reverse  : dict + set membership O(1) per user skill.
    4. Fuzzy    : rapidfuzz (optional C extension) >> SequenceMatcher.
    5. Single pass: readiness is accumulated IN THE SAME loop as gap
       classification, eliminating a full second pass over market skills.
    """

    SIMILARITY_FACTORS = {
        "exact":    1.00,
        "ontology": 0.90,
        "reverse":  0.90,
        "fuzzy":    0.80,
        "none":     0.00,
    }

    GAP_CRITICAL  = 0.55
    GAP_IMPORTANT = 0.25
    FUZZY_THRESH  = 0.82

    SOFT_SKILLS: FrozenSet[str] = frozenset({
        "communication", "leadership", "teamwork", "collaboration",
        "presentation", "public-speaking", "negotiation", "time-management",
        "adaptability", "creativity", "analytical-thinking", "attention-to-detail",
        "emotional-intelligence", "decision-making", "problem-solving",
        "critical-thinking", "customer-service", "self-motivation",
    })

    _LEVEL_MULT = {"critical": 3, "important": 2, "emerging": 1}
    _LEVEL_ORDER = {"critical": 2, "important": 1, "emerging": 0}

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
            user_skills         : {skill_name: {proficiency: float, ...}}
            market_requirements : {skill_name: {frequency: float,
                                                requirement_level: str,
                                                trending: bool}}

        Returns standard dict with critical_gaps, important_gaps, emerging_gaps,
        strengths, overall_readiness, summary.
        """
        # ── 1. Build normalised user lookup once ──────────────────────────────
        user_norm: Dict[str, float] = {}
        for raw, data in user_skills.items():
            n = _norm(raw)
            user_norm[n] = float(data.get("proficiency", 0.5))

        user_set: Set[str] = set(user_norm.keys())

        # Pre-compute which reverse-ontology categories the user already covers
        # user_cats: set of all category names satisfied by the user's skills
        user_cats: Set[str] = set()
        for us in user_set:
            cats = _REV_ONTO.get(us)
            if cats:
                user_cats.update(cats)

        # ── 2. Single pass over market requirements ───────────────────────────
        critical_gaps:  List[Dict] = []
        important_gaps: List[Dict] = []
        emerging_gaps:  List[Dict] = []
        strengths:      List[Dict] = []

        total_w    = 0.0
        attained_w = 0.0

        for raw_market, req in market_requirements.items():
            norm_market = _norm(raw_market)
            demand      = float(req.get("frequency", 0.0))
            req_level   = req.get("requirement_level", "important")

            if norm_market in self.SOFT_SKILLS:
                continue

            mult    = self._LEVEL_MULT.get(req_level, 1)
            weight  = demand * mult
            total_w += weight

            match_type, sim_factor, matched_via, user_prof = self._match(
                norm_market, user_set, user_norm, user_cats
            )

            # accumulate readiness in the same pass
            if match_type != "none":
                attained_w += weight * sim_factor * user_prof

            base = {
                "skill":             raw_market,
                "demand":            round(demand, 2),
                "demand_percentage": f"{int(demand * 100)}%",
                "requirement_level": req_level,
                "trending":          req.get("trending", False),
                "llm_validated":     req.get("llm_validated", False),
            }

            effective_gap = demand - (user_prof * sim_factor)

            entry = {**base, "effective_gap": round(effective_gap, 2)}

            if match_type != "none":
                entry["user_proficiency"] = round(user_prof, 2)
                entry["match_type"] = match_type
                entry["matched_via"] = matched_via

            # A strength is when the user has the skill and their proficiency is close to or exceeds demand.
            is_strength = (match_type != "none") and (effective_gap <= 0.20)

            if is_strength:
                strengths.append(entry)
            else:
                if effective_gap > self.GAP_CRITICAL:
                    effective_level = "critical"
                elif effective_gap >= self.GAP_IMPORTANT:
                    effective_level = "important"
                else:
                    effective_level = "emerging"

                final_level = self._min_level(effective_level, req_level)
                entry["requirement_level"] = final_level

                # Add learning priority based on the size of the gap (percentage)
                # High gap percentage (80%+) means high learnable / immediate focus.
                if effective_gap >= 0.80:
                    priority_label = "Learn Immediate"
                    priority_id = "immediate"
                elif effective_gap >= 0.50:
                    priority_label = "High Priority"
                    priority_id = "high"
                elif effective_gap >= 0.25:
                    priority_label = "Important"
                    priority_id = "medium"
                else:
                    priority_label = "Low Importance"
                    priority_id = "low"
                
                entry["priority_label"] = priority_label
                entry["priority_id"] = priority_id

                if final_level == "critical":
                    critical_gaps.append(entry)
                elif final_level == "important":
                    important_gaps.append(entry)
                else:
                    emerging_gaps.append(entry)

        # ── 3. Sort by demand descending ──────────────────────────────────────
        for lst in (critical_gaps, important_gaps, emerging_gaps, strengths):
            lst.sort(key=lambda x: x["demand"], reverse=True)

        # ── 4. Readiness (already accumulated above) ──────────────────────────
        readiness = round(min(attained_w / total_w * 100, 100.0), 1) if total_w else 0.0

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
        user_cats: Set[str],
    ) -> Tuple[str, float, List[str], float]:
        """
        Returns (match_type, similarity_factor, matched_via_list, user_proficiency).
        match_type ∈ {"exact", "ontology", "reverse", "fuzzy", "none"}

        Complexity per call: O(k + U_fuzzy) where
          k        = # ontology members for the market skill (≤ ~15)
          U_fuzzy  = # user skills (only reached if exact + ontology + reverse all fail)
        """
        SF = self.SIMILARITY_FACTORS

        # 1. Exact — O(1)
        if norm_market in user_set:
            return "exact", SF["exact"], [norm_market], user_norm[norm_market]

        space_v = norm_market.replace("-", " ")
        if space_v in user_set:
            return "exact", SF["exact"], [space_v], user_norm[space_v]

        # 2. Ontology — frozenset intersection O(k)
        members_n: Optional[FrozenSet[str]] = (
            _ONTO_NORM.get(norm_market) or
            _ONTO_NORM_SPACE.get(norm_market) or
            _ONTO_NORM.get(space_v)
        )
        if members_n:
            matched = list(members_n & user_set)
            if matched:
                avg_prof = sum(user_norm[m] for m in matched) / len(matched)
                return "ontology", SF["ontology"], matched, avg_prof

        # 3. Reverse-ontology — O(1) set membership
        # user_cats was pre-computed: all categories covered by all user skills
        if norm_market in user_cats or space_v in user_cats:
            # Find which user skill(s) satisfy this category
            covering = [
                us for us in user_set
                if norm_market in _REV_ONTO.get(us, set())
                or space_v in _REV_ONTO.get(us, set())
            ]
            if covering:
                avg_prof = sum(user_norm[s] for s in covering) / len(covering)
                return "reverse", SF["reverse"], covering, avg_prof

        # 4. Fuzzy — O(U) but only reached when no structural match exists
        best_score = 0.0
        best_user  = ""
        for u_skill in user_set:
            s = _fuzzy(norm_market, u_skill)
            if s > best_score:
                best_score = s
                best_user  = u_skill
                if best_score >= 1.0:   # perfect hit, stop early
                    break
        if best_score >= self.FUZZY_THRESH:
            return "fuzzy", SF["fuzzy"], [best_user], user_norm[best_user]

        return "none", 0.0, [], 0.0

    # ── helpers ───────────────────────────────────────────────────────────────
    def _min_level(self, a: str, b: str) -> str:
        """Return the less severe of two requirement levels."""
        return a if self._LEVEL_ORDER.get(a, 1) <= self._LEVEL_ORDER.get(b, 1) else b

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