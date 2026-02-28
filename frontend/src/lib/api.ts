
export interface Skill {
    id?: string;
    skill_name: string;
    proficiency: number;
    confidence?: number;
    sources?: string | string[];
    source_count?: number;
}

export interface GapAnalysis {
    overall_readiness: number;
    critical_gaps: any[];
    important_gaps: any[];
    gaps: {
        skill: string;
        priority: 'high' | 'medium' | 'low';
    }[];
    fetched_market_skills?: any[];
    skills_source?: string;
    matched_skills?: any[];
    missing_skills?: any[];
    target_role?: { id: string, title: string };
    match_percentage?: number;
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

    getRoadmaps: async (): Promise<any> => {
        const data = await fetchApi('/api/roadmaps');
        return data.data || data;
    },

    getUserRoadmap: async (userId: string): Promise<any> => {
        try {
            const data = await fetchApi(`/api/users/${userId}/roadmap`);
            return data.data || data;
        } catch (error: any) {
            // Return empty roadmap if not found
            if (error.message?.includes('404') || error.message?.includes('not found')) {
                return { has_roadmap: false };
            }
            throw error;
        }
    },

    selectRoadmap: async (userId: string, domain: string): Promise<void> => {
        await fetchApi(`/api/users/${userId}/roadmap`, {
            method: 'POST',
            body: JSON.stringify({ domain }),
        });
    },

    removeUserRoadmap: async (userId: string): Promise<void> => {
        await fetchApi(`/api/users/${userId}/roadmap`, {
            method: 'DELETE',
        });
    },

    updateMilestoneProgress: async (userId: string, milestoneId: string, status: string): Promise<void> => {
        await fetchApi(`/api/users/${userId}/roadmap/milestones/${milestoneId}`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        });
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
    }
};
