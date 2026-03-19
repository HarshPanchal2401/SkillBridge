
export interface Skill {
    id?: string;
    skill_name: string;
    proficiency: number;
    confidence?: number;
    sources?: string | string[];
    source_count?: number;
}

export interface MarketSkill {
    skill: string;
    demand: number;
    demand_percentage: string;
    requirement_level: string;
    priority_label?: string;
    priority_id?: string;
    trending?: boolean;
    llm_validated?: boolean;
    reasoning?: string;
    transferability?: number;
    gap?: number;
}

export interface GapAnalysis {
    overall_readiness: number;
    interpretation?: string;
    readiness?: {
        score: number;
        interpretation: string;
        level: string;
    };
    skills_analysis?: {
        total_role_skills: number;
        user_skills_matched: number;
        skills_missing: number;
        match_percentage: number;
    };
    critical_gaps: MarketSkill[];
    important_gaps: MarketSkill[];
    skill_gaps: {
        critical: MarketSkill[];
        important: MarketSkill[];
        emerging: MarketSkill[];
    };
    immediate_learning?: MarketSkill[];
    skill_learning?: MarketSkill[];
    fetched_market_skills?: MarketSkill[];
    skills_source?: string;
    matched_skills?: MarketSkill[];
    missing_skills?: MarketSkill[];
    strengths?: MarketSkill[];
    target_role?: { id: string, title: string };
    match_percentage?: number;
    summary?: {
        interpretation: string;
        overall_readiness_pct: number;
        critical_gap_count: number;
        strength_count: number;
    };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchApi(endpoint: string, options?: RequestInit) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || error.detail || `HTTP ${res.status}`);
    }

    return res.json();
}

// Simple in-memory cache
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const api = {
    getUserSkills: async (userId: string, refresh = false): Promise<Skill[]> => {
        const cacheKey = `skills_${userId}`;
        if (!refresh && cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
            return cache[cacheKey].data;
        }
        const data = await fetchApi(`/api/skills/users/${userId}`);
        cache[cacheKey] = { data: data || [], timestamp: Date.now() };
        return data || [];
    },

    getGapAnalysis: async (userId: string, refresh = false): Promise<GapAnalysis> => {
        const cacheKey = `gap_${userId}`;
        if (!refresh && cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
            return cache[cacheKey].data;
        }
        const data = await fetchApi(`/api/users/${userId}/gap-analysis`);
        const result = data.data || data;
        cache[cacheKey] = { data: result, timestamp: Date.now() };
        return result;
    },

    updateUser: async (userId: string, userData: any): Promise<void> => {
        await fetchApi(`/api/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData),
        });
        // Invalidate cache on user update
        delete cache[`skills_${userId}`];
        delete cache[`gap_${userId}`];
    },

    uploadResume: async (userId: string, file: File): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE_URL}/api/users/${userId}/resume/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Upload failed' }));
            throw new Error(error.message || error.detail || `HTTP ${res.status}`);
        }

        // Invalidate cache on resume upload
        delete cache[`skills_${userId}`];
        delete cache[`gap_${userId}`];

        return res.json();
    },

    extractSkills: async (userId: string): Promise<any> => {
        const data = await fetchApi(`/api/skills/extract/${userId}`, {
            method: 'POST',
        });
        // Invalidate cache on extraction
        delete cache[`skills_${userId}`];
        delete cache[`gap_${userId}`];
        return data;
    },

    extractAllSkills: async (userId: string): Promise<any> => {
        const data = await fetchApi(`/api/skills/extract-all/${userId}`, {
            method: 'POST',
        });
        // Invalidate cache on extraction
        delete cache[`skills_${userId}`];
        delete cache[`gap_${userId}`];
        return data;
    },

    getGapBasedCourses: async (userId: string, refresh: boolean = false): Promise<any> => {
        const cacheKey = `gap_courses_${userId}`;
        if (!refresh && cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
            return cache[cacheKey].data;
        }
        const url = `/api/users/${userId}/gap-courses${refresh ? '?refresh=true' : ''}`;
        const data = await fetchApi(url);
        const result = data.data || data;
        cache[cacheKey] = { data: result, timestamp: Date.now() };
        return result;
    },

    searchCoursesForSkill: async (skill: string, refresh: boolean = false): Promise<any> => {
        const cacheKey = `skill_courses_${skill}`;
        if (!refresh && cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
            return cache[cacheKey].data;
        }
        const url = `/api/courses/search/${encodeURIComponent(skill)}${refresh ? '?refresh=true' : ''}`;
        const data = await fetchApi(url);
        const result = data.data || data;
        cache[cacheKey] = { data: result, timestamp: Date.now() };
        return result;
    },

    analyzeUserForRole: async (userId: string, role: string): Promise<any> => {
        const data = await fetchApi(`/api/users/${userId}/analyze-role/${encodeURIComponent(role)}`);
        const result = data.data || data;
        // Invalidate and update gap cache on manual analysis
        delete cache[`gap_${userId}`];
        cache[`gap_${userId}`] = { data: result, timestamp: Date.now() };
        return result;
    },

    getJobRecommendations: async (userId: string, refresh: boolean = false): Promise<any> => {
        const url = `/api/jobs/recommendations/${userId}${refresh ? '?refresh=true' : ''}`;
        const data = await fetchApi(url);
        return data.data || data;
    },

    searchJobs: async (title: string, location: string, refresh: boolean = false, experienceLevel?: string, minMatch?: number, userId?: string): Promise<any> => {
        const params = new URLSearchParams({
            title,
            location,
            limit: '20'
        });
        if (refresh) params.append('refresh', 'true');
        if (experienceLevel) params.append('experience_level', experienceLevel);
        if (minMatch !== undefined) params.append('min_match', minMatch.toString());
        if (userId) params.append('user_id', userId);

        const data = await fetchApi(`/api/jobs/search?${params.toString()}`);
        return data.data || data;
    },

    generateRoadmap: async (userId: string, language: string = 'English'): Promise<any> => {
        return fetchApi(`/api/roadmaps/generate/${userId}?language=${encodeURIComponent(language)}`, {
            method: 'POST',
        });
    },

    getLatestRoadmap: async (userId: string): Promise<any> => {
        return fetchApi(`/api/roadmaps/user/${userId}`);
    },

    updateRoadmapProgress: async (userId: string, skillName: string, status: string, percentage: number = 0): Promise<any> => {
        return fetchApi(`/api/roadmaps/progress/${userId}?skill_name=${encodeURIComponent(skillName)}&status=${status}&percentage=${percentage}`, {
            method: 'POST',
        });
    },

    // ── Video Progress APIs ──

    saveVideoProgress: async (
        userId: string,
        videoId: string,
        data: {
            skill_name?: string;
            watch_time_seconds: number;
            total_duration_seconds: number;
            completion_percentage: number;
            last_position_seconds: number;
        }
    ): Promise<any> => {
        return fetchApi('/api/video-progress/save', {
            method: 'POST',
            body: JSON.stringify({
                user_id: parseInt(userId),
                video_id: videoId,
                ...data,
            }),
        });
    },

    getVideoProgress: async (userId: string): Promise<any> => {
        return fetchApi(`/api/video-progress/user/${userId}`);
    },

    getVideoAnalytics: async (userId: string): Promise<any> => {
        return fetchApi(`/api/video-progress/user/${userId}/analytics`);
    },

    getSingleVideoProgress: async (userId: string, videoId: string): Promise<any> => {
        return fetchApi(`/api/video-progress/user/${userId}/video/${videoId}`);
    },

    incrementPlayCount: async (userId: string, videoId: string): Promise<any> => {
        return fetchApi(`/api/video-progress/increment-play/${userId}/${videoId}`, {
            method: 'POST',
        });
    },

    tutorChat: async (videoId: string, videoTitle: string, message: string, sessionId?: string, language: string = 'English'): Promise<{ reply: string; session_id: string }> => {
        return fetchApi('/api/tutor/chat', {
            method: 'POST',
            body: JSON.stringify({
                video_id: videoId,
                video_title: videoTitle,
                message: message,
                session_id: sessionId || null,
                language: language,
            }),
        });
    },

    findVideo: async (title: string, channel?: string): Promise<{ video_id: string; search_query: string }> => {
        return fetchApi('/api/tutor/find-video', {
            method: 'POST',
            body: JSON.stringify({ title, channel: channel || null }),
        });
    }
};
