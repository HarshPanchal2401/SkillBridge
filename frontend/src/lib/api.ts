
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

export const api = {
    getUserSkills: async (userId: string): Promise<Skill[]> => {
        const data = await fetchApi(`/api/skills/users/${userId}`);
        return data || [];
    },

    getGapAnalysis: async (userId: string): Promise<GapAnalysis> => {
        const data = await fetchApi(`/api/users/${userId}/gap-analysis`);
        return data.data || data;
    },

    updateUser: async (userId: string, userData: any): Promise<void> => {
        await fetchApi(`/api/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData),
        });
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

        return res.json();
    },

    extractSkills: async (userId: string): Promise<any> => {
        return fetchApi(`/api/skills/extract/${userId}`, {
            method: 'POST',
        });
    },

    extractAllSkills: async (userId: string): Promise<any> => {
        return fetchApi(`/api/skills/extract-all/${userId}`, {
            method: 'POST',
        });
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

    getGapBasedCourses: async (userId: string): Promise<any> => {
        const data = await fetchApi(`/api/users/${userId}/gap-courses`);
        return data.data || data;
    },

    searchCoursesForSkill: async (skill: string): Promise<any> => {
        const data = await fetchApi(`/api/courses/search/${encodeURIComponent(skill)}`);
        return data.data || data;
    },

    analyzeUserForRole: async (userId: string, role: string): Promise<any> => {
        const data = await fetchApi(`/api/users/${userId}/analyze-role/${encodeURIComponent(role)}`);
        return data.data || data;
    },

    getJobRecommendations: async (userId: string): Promise<any> => {
        const data = await fetchApi(`/api/jobs/recommendations/${userId}`);
        return data.data || data;
    },

    searchJobs: async (title: string, location: string): Promise<any> => {
        const params = new URLSearchParams({
            title,
            location,
            limit: '20'
        });
        const data = await fetchApi(`/api/jobs/search?${params.toString()}`);
        return data.data || data;
    }
};
