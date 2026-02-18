'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, Skill } from '../../lib/api';
import { MainLayout } from '@/components/layout/Sidebar';
import {
    User,
    Mail,
    GraduationCap,
    Github,
    Linkedin,
    Upload,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Target,
    MapPin,
    Building,
    Sparkles,
    FileText,
    Star,
    Layers,
    ChevronRight,
    SearchCode,
    ArrowUpRight
} from 'lucide-react';

export default function ProfilePage() {
    const { user, profile, refreshUser, loading: authLoading, userId } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        education: '',
        university: '',
        location: '',
        target_role: '',
        github_url: '',
        linkedin_url: '',
    });

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        } else if (user) {
            setFormData({
                name: user.name || '',
                education: user.education || '',
                university: user.university || '',
                location: user.location || '',
                target_role: user.target_role || '',
                github_url: user.github_url || '',
                linkedin_url: user.linkedin_url || '',
            });
            loadSkills();
        }
    }, [user, authLoading]);

    const loadSkills = async () => {
        if (!userId) return;
        try {
            const data = await api.getUserSkills(userId);
            setSkills(data);
        } catch (error) {
            console.error('Failed to load skills:', error);
        }
    };

    const handleSave = async () => {
        if (!userId) return;
        setLoading(true);
        setMessage(null);
        try {
            await api.updateUser(userId, formData);
            await refreshUser();
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
        } finally {
            setLoading(false);
        }
    };

    const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        setLoading(true);
        setMessage(null);
        try {
            await api.uploadResume(userId, file);
            await refreshUser();
            setMessage({
                type: 'success',
                text: 'Resume uploaded! Extracting skills...',
            });

            // Automatically extract skills after successful upload
            setExtracting(true);
            try {
                const result = await api.extractAllSkills(userId);
                await loadSkills();
                await refreshUser();
                setMessage({
                    type: 'success',
                    text: `Resume analyzed! Found ${result.total_skills} skills in your profile.`,
                });
            } catch (extractError: any) {
                setMessage({
                    type: 'error',
                    text: extractError.message || 'Resume uploaded but failed to extract skills. Try clicking "Sync Intelligence".',
                });
            } finally {
                setExtracting(false);
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to upload resume' });
        } finally {
            setLoading(false);
        }
    };

    const handleExtractAllSkills = async () => {
        if (!userId) return;
        setExtracting(true);
        setMessage(null);
        try {
            const result = await api.extractAllSkills(userId);
            await loadSkills();
            await refreshUser();
            setMessage({
                type: 'success',
                text: `Intelligence Synced! Found ${result.total_skills} skills in your profile.`,
            });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to extract skills' });
        } finally {
            setExtracting(false);
        }
    };

    if (authLoading) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-indigo-100 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const skillsBySource: Record<string, Skill[]> = {};
    skills.forEach(skill => {
        let sources: string[] = ['other'];
        if (typeof skill.sources === 'string') {
            try {
                const parsed = JSON.parse(skill.sources);
                sources = Array.isArray(parsed) ? parsed : [skill.sources];
            } catch {
                sources = skill.sources.split(',').map(s => s.trim());
            }
        } else if (Array.isArray(skill.sources)) {
            sources = skill.sources;
        }

        sources.forEach(src => {
            const sourceType = src.split(':')[0] || 'other';
            const source = sourceType.toLowerCase();
            if (!skillsBySource[source]) skillsBySource[source] = [];
            if (!skillsBySource[source].find(s => s.skill_name === skill.skill_name)) {
                skillsBySource[source].push(skill);
            }
        });
    });

    return (
        <MainLayout>
            <div className="max-w-5xl mx-auto space-y-10 pb-12 animate-fade-in px-4 md:px-6">

                {/* Profile Hero Section */}
                <div className="relative bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-gray-100 overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-40 -mr-20 -mt-20"></div>

                    <div className="relative flex flex-col lg:flex-row items-center justify-between gap-12">
                        <div className="flex-1 space-y-6 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-sm font-semibold shadow-sm">
                                <User size={14} />
                                Personal Identity
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight tracking-tight">
                                Refine Your <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Professional Profile</span>
                            </h1>
                            <p className="text-lg text-gray-500 max-w-xl leading-relaxed">
                                Keep your information sharp and your resume updated. Our AI uses this data to map your entire career trajectory.
                            </p>
                        </div>

                        {/* Profile Completion Card */}
                        <div className="bg-gray-900 rounded-[2rem] p-8 text-white w-64 md:w-72 shadow-2xl relative group overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600 rounded-full blur-3xl opacity-20"></div>
                            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">Onboarding</h3>
                            <div className="flex items-end gap-2 mb-4">
                                <span className="text-5xl font-black tracking-tighter">{Math.round(profile?.profile_completion || 0)}%</span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] pb-3">Status</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${profile?.profile_completion || 0}%` }}
                                />
                            </div>
                            <p className="mt-4 text-[10px] font-bold text-gray-400 leading-relaxed uppercase tracking-tighter">
                                Complete your profile to unlock full market analysis.
                            </p>
                        </div>
                    </div>
                </div>

                {message && (
                    <div className={`p-5 rounded-2xl flex items-center justify-between shadow-lg border-2 animate-slide-down 
                        ${message.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-xl ${message.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                                {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                            </div>
                            <span className="font-bold text-sm tracking-tight">{message.text}</span>
                        </div>
                        <button onClick={() => setMessage(null)} className="text-xs font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Dismiss</button>
                    </div>
                )}

                <div className="grid lg:grid-cols-12 gap-8">

                    {/* Main Forms Section */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* Information Grid */}
                        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 space-y-10">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Core Repository</h2>
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-800 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                                >
                                    {loading ? 'Processing...' : 'Sync Changes'}
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                {[
                                    { id: 'name', label: 'Identity', icon: User, placeholder: 'John Doe' },
                                    { id: 'education', label: 'Degree', icon: GraduationCap, placeholder: 'Master of Science' },
                                    { id: 'university', label: 'Academy', icon: Building, placeholder: 'Stanford University' },
                                    { id: 'location', label: 'Territory', icon: MapPin, placeholder: 'San Francisco, CA' },
                                    { id: 'target_role', label: 'Ambition', icon: Target, placeholder: 'Lead Backend Engineer' },
                                ].map((field) => (
                                    <div key={field.id} className="space-y-2 group">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-indigo-600 transition-colors">
                                            <field.icon size={12} />
                                            {field.label}
                                        </label>
                                        <input
                                            type="text"
                                            value={(formData as any)[field.id]}
                                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                            className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all text-gray-900 font-bold placeholder:font-medium placeholder:text-gray-300 shadow-sm"
                                            placeholder={field.placeholder}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Resume Management Area */}
                        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-10">
                            <div className="flex-1 space-y-6">
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Resume Intelligence</h2>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    Our NLP engine will parse your resume to identify technical competencies, industry exposure, and career growth potential.
                                </p>

                                {user?.has_resume ? (
                                    <div className="bg-emerald-50 rounded-[1.5rem] p-6 border border-emerald-100 relative group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-500">
                                                <FileText size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded-full inline-block mb-1">Active Artifact</p>
                                                <p className="text-sm font-black text-gray-900 truncate" title={user.resume_filename}>{user.resume_filename || 'DefaultResume.pdf'}</p>
                                            </div>
                                        </div>
                                        <div className="mt-6 flex flex-wrap gap-2">
                                            <button
                                                onClick={handleExtractAllSkills}
                                                disabled={extracting}
                                                className="px-6 py-2.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-800 transition-all flex items-center gap-2"
                                            >
                                                <Sparkles size={14} className={extracting ? 'animate-spin' : ''} />
                                                {extracting ? 'Analyzing...' : 'Sync Intelligence'}
                                            </button>
                                            <label className="px-6 py-2.5 bg-white text-gray-900 border border-gray-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-all cursor-pointer">
                                                Swap Files
                                                <input type="file" className="hidden" onChange={handleResumeUpload} accept=".pdf,.doc,.docx,.txt" />
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="block p-12 border-4 border-dashed border-gray-100 rounded-[2rem] text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group">
                                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                            <Upload className="text-gray-400 group-hover:text-indigo-500 transition-colors" size={32} />
                                        </div>
                                        <span className="text-sm font-black text-gray-900 uppercase tracking-widest">Connect Resume</span>
                                        <p className="mt-2 text-xs text-gray-400 font-bold">PDF, DOCX, TXT accepted (Max 10MB)</p>
                                        <input type="file" className="hidden" onChange={handleResumeUpload} accept=".pdf,.doc,.docx,.txt" />
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar: Social & Skill Snapshot */}
                    <div className="lg:col-span-4 space-y-8">

                        {/* Social Repository */}
                        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 space-y-6">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">Integrations</h3>
                            <div className="space-y-4">
                                {[
                                    { id: 'github_url', label: 'GitHub', icon: Github, color: 'bg-gray-900', placeholder: 'github.com/profile' },
                                    { id: 'linkedin_url', label: 'LinkedIn', icon: Linkedin, color: 'bg-blue-600', placeholder: 'linkedin.com/in/profile' },
                                ].map((social) => (
                                    <div key={social.id} className="relative group">
                                        <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 ${social.color} text-white rounded-xl flex items-center justify-center shadow-lg transition-transform group-focus-within:scale-110`}>
                                            <social.icon size={20} />
                                        </div>
                                        <input
                                            type="url"
                                            value={(formData as any)[social.id]}
                                            onChange={(e) => setFormData({ ...formData, [social.id]: e.target.value })}
                                            className="w-full pl-16 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all text-xs font-bold text-gray-900"
                                            placeholder={social.placeholder}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Extracted Intelligence (Skills) */}
                        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 flex flex-col items-center">
                            <h3 className="w-full text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center justify-between">
                                Intelligence
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg">{skills.length} Nodes</span>
                            </h3>

                            {skills.length > 0 ? (
                                <div className="w-full space-y-6">
                                    {Object.entries(skillsBySource).map(([source, sourceSkills], i) => (
                                        <div key={source} className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{source}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {sourceSkills.slice(0, 10).map((skill) => (
                                                    <div key={skill.id} className="group relative">
                                                        <span className="px-3 py-1.5 bg-gray-50 hover:bg-white hover:shadow-md border border-gray-100 rounded-xl text-[10px] font-black text-gray-700 transition-all cursor-default">
                                                            {skill.skill_name}
                                                        </span>
                                                    </div>
                                                ))}
                                                {sourceSkills.length > 10 && (
                                                    <span className="text-[10px] font-black text-gray-400 py-1.5">+ {sourceSkills.length - 10} more</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => router.push('/skills')}
                                        className="w-full py-4 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        View Full Analysis
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-10 opacity-30">
                                    <SearchCode size={48} className="mx-auto mb-4" />
                                    <p className="text-xs font-bold uppercase tracking-widest">No signals found</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

            </div>
        </MainLayout>
    );
}
