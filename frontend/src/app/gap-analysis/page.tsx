'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { MainLayout } from '@/components/layout/Sidebar';
import {
    Target,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    ChevronRight,
    Loader2,
    Zap,
    Clock,
    Wifi,
} from 'lucide-react';

interface SkillGap {
    skill: string;
    has_skill: boolean;
    market_demand: number;
    demand_percentage: number;
    requirement_level: string;
    priority: string;
    impact?: string;
}

interface GapAnalysisResult {
    target_role: { id: string; title: string };
    readiness: { score: number; interpretation: string; level: string };
    skills_analysis: {
        total_role_skills: number;
        user_skills_matched: number;
        skills_missing: number;
        match_percentage: number;
    };
    skill_gaps: {
        critical: SkillGap[];
        important: SkillGap[];
        emerging: SkillGap[];
    };
    missing_skills: any[];
    matched_skills: any[];
    strengths: any[];
    course_recommendations: any[];
    skills_source?: string;
    learning_path: {
        immediate_focus: string[];
        next_steps: string[];
        future_skills: string[];
        estimated_months: number;
    };
}

export default function GapAnalysisPage() {
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [analysis, setAnalysis] = useState<GapAnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoAnalyzed, setAutoAnalyzed] = useState(false);

    // Redirect if not logged in
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Auto-fill target role from user profile
    useEffect(() => {
        const targetRole = user?.target_role;
        if (targetRole && !selectedRole) {
            setSelectedRole(targetRole);
        }
    }, [user, profile, selectedRole]);

    // Auto-analyze when role is set from profile
    useEffect(() => {
        if (selectedRole && user && !autoAnalyzed && !analysis) {
            setAutoAnalyzed(true);
            analyzeGaps();
        }
    }, [selectedRole, user, autoAnalyzed, analysis]);

    const analyzeGaps = async () => {

        if (!user || !selectedRole) return;

        setLoading(true);
        setError(null);
        setAnalysis(null);

        try {
            const result = await api.analyzeUserForRole(user.id || '', selectedRole, false, 3);
            setAnalysis(result);
        } catch (err: any) {
            setError(err.message || 'Failed to analyze gaps');
        } finally {
            setLoading(false);
        }
    };

    const getReadinessColor = (level: string) => {
        switch (level) {
            case 'ready': return 'text-green-600 bg-green-100';
            case 'developing': return 'text-yellow-600 bg-yellow-100';
            default: return 'text-red-600 bg-red-100';
        }
    };



    if (authLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-96">
                    <Loader2 className="animate-spin text-green-500" size={48} />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-8 text-white">
                    <h1 className="text-3xl font-bold mb-2">Skill Gap Analysis</h1>
                    <p className="text-green-100">Enter your target role to see skill gaps and learning recommendations</p>
                </div>

                {/* Role Input */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Target Role</h2>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            placeholder="e.g., Frontend Developer, Data Scientist, ML Engineer..."
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white placeholder-gray-400"
                        />
                        <button
                            onClick={analyzeGaps}
                            disabled={!selectedRole.trim() || loading}
                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <><Loader2 className="animate-spin" size={20} /> Searching...</>
                            ) : (
                                <><Target size={20} /> Analyze Gaps</>
                            )}
                        </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">We'll search the internet for the latest required skills</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                        {error}
                    </div>
                )}

                {/* Analysis Results */}
                {analysis && (
                    <>
                        {/* Readiness Score */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900">{analysis.target_role.title}</h2>
                                    <p className="text-gray-500">Your readiness for this role</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {analysis.skills_source && (
                                        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${analysis.skills_source === 'web_search'
                                            ? 'bg-blue-100 text-blue-700'
                                            : analysis.skills_source === 'fallback'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {analysis.skills_source === 'web_search' && <Wifi size={12} />}
                                            {analysis.skills_source === 'web_search' ? 'Live Data' : analysis.skills_source === 'fallback' ? 'Fallback' : 'Static'}
                                        </div>
                                    )}
                                    <div className={`px-4 py-2 rounded-full font-semibold ${getReadinessColor(analysis.readiness.level)}`}>
                                        {analysis.readiness.level.toUpperCase()}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="relative w-32 h-32">
                                    <svg className="w-32 h-32 transform -rotate-90">
                                        <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="none" />
                                        <circle
                                            cx="64" cy="64" r="56"
                                            stroke={analysis.readiness.score >= 75 ? '#22c55e' : analysis.readiness.score >= 50 ? '#eab308' : '#ef4444'}
                                            strokeWidth="12"
                                            fill="none"
                                            strokeDasharray={`${analysis.readiness.score * 3.52} 352`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-gray-900">{Math.round(analysis.readiness.score)}%</span>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-gray-700 mb-4">{analysis.readiness.interpretation}</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="text-center p-3 bg-green-50 rounded-xl">
                                            <div className="text-2xl font-bold text-green-600">{analysis.skills_analysis.user_skills_matched}</div>
                                            <div className="text-sm text-gray-600">Skills Matched</div>
                                        </div>
                                        <div className="text-center p-3 bg-red-50 rounded-xl">
                                            <div className="text-2xl font-bold text-red-600">{analysis.skills_analysis.skills_missing}</div>
                                            <div className="text-sm text-gray-600">Skills Missing</div>
                                        </div>
                                        <div className="text-center p-3 bg-blue-50 rounded-xl">
                                            <div className="text-2xl font-bold text-blue-600">{analysis.learning_path.estimated_months}mo</div>
                                            <div className="text-sm text-gray-600">Est. Time</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Skill Gaps */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Critical Gaps */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="text-red-500" size={20} />
                                    <h3 className="font-semibold text-gray-900">Critical Gaps ({analysis.skill_gaps.critical.length})</h3>
                                </div>
                                {analysis.skill_gaps.critical.length === 0 ? (
                                    <p className="text-gray-500 text-sm">No critical gaps! 🎉</p>
                                ) : (
                                    <div className="space-y-3">
                                        {analysis.skill_gaps.critical.map((gap, i) => (
                                            <div key={i} className="p-3 bg-red-50 rounded-xl">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-medium text-gray-900">{gap.skill}</span>
                                                    <span className="text-sm text-red-600">Demand: {gap.demand_percentage}%</span>
                                                </div>
                                                <div className="w-full bg-red-200 rounded-full h-2">
                                                    <div
                                                        className="bg-red-500 h-2 rounded-full"
                                                        style={{ width: `${gap.demand_percentage || 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Missing Skills */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <Zap className="text-yellow-500" size={20} />
                                    <h3 className="font-semibold text-gray-900">Missing Skills ({analysis.missing_skills.length})</h3>
                                </div>
                                {analysis.missing_skills.length === 0 ? (
                                    <p className="text-gray-500 text-sm">You have all required skills!</p>
                                ) : (
                                    <div className="space-y-2">
                                        {analysis.missing_skills.slice(0, 6).map((skill, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                                <span className="text-gray-900">{skill.skill}</span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${skill.requirement_level === 'critical' ? 'bg-red-100 text-red-600' :
                                                    skill.requirement_level === 'important' ? 'bg-yellow-100 text-yellow-600' :
                                                        'bg-blue-100 text-blue-600'
                                                    }`}>
                                                    {skill.requirement_level}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Learning Path */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="text-green-500" size={20} />
                                <h3 className="font-semibold text-gray-900">Your Learning Path</h3>
                            </div>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="p-4 bg-red-50 rounded-xl border-l-4 border-red-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock size={16} className="text-red-500" />
                                        <span className="font-medium text-gray-900">Immediate Focus</span>
                                    </div>
                                    <div className="space-y-1">
                                        {analysis.learning_path.immediate_focus.length > 0 ? (
                                            analysis.learning_path.immediate_focus.map((skill, i) => (
                                                <div key={i} className="text-sm text-gray-700">• {skill}</div>
                                            ))
                                        ) : (
                                            <div className="text-sm text-gray-500">None needed</div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 bg-yellow-50 rounded-xl border-l-4 border-yellow-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ChevronRight size={16} className="text-yellow-500" />
                                        <span className="font-medium text-gray-900">Next Steps</span>
                                    </div>
                                    <div className="space-y-1">
                                        {analysis.learning_path.next_steps.length > 0 ? (
                                            analysis.learning_path.next_steps.map((skill, i) => (
                                                <div key={i} className="text-sm text-gray-700">• {skill}</div>
                                            ))
                                        ) : (
                                            <div className="text-sm text-gray-500">None needed</div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Target size={16} className="text-blue-500" />
                                        <span className="font-medium text-gray-900">Future Skills</span>
                                    </div>
                                    <div className="space-y-1">
                                        {analysis.learning_path.future_skills.length > 0 ? (
                                            analysis.learning_path.future_skills.map((skill, i) => (
                                                <div key={i} className="text-sm text-gray-700">• {skill}</div>
                                            ))
                                        ) : (
                                            <div className="text-sm text-gray-500">None needed</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>



                        {/* Strengths */}
                        {analysis.strengths.length > 0 && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <CheckCircle className="text-green-500" size={20} />
                                    <h3 className="font-semibold text-gray-900">Your Strengths ({analysis.strengths.length})</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.strengths.map((s, i) => (
                                        <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                            {s.skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </MainLayout >
    );
}
