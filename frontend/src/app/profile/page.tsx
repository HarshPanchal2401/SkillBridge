'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, Skill } from '../../lib/api';
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
    ArrowUpRight,
    Award
} from 'lucide-react';

import { Autocomplete } from '../../components/ui/Autocomplete';
import { DEGREES, SPECIALIZATIONS, LOCATIONS, UNIVERSITY_MAP, GLOBAL_UNIVERSITIES, TARGET_ROLES } from '../../lib/suggestions';

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
        specialization: '',
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
                specialization: user.specialization || '',
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
                text: 'Resume uploaded! Extracting intelligence...',
            });

            setExtracting(true);
            try {
                const result = await api.extractAllSkills(userId);
                await loadSkills();
                await refreshUser();
                setMessage({
                    type: 'success',
                    text: `Profile analyzed! Found ${result.total_skills} skills in your repository.`,
                });
            } catch (extractError: any) {
                setMessage({
                    type: 'error',
                    text: extractError.message || 'Resume uploaded but failed to extract skills. Try syncing manually.',
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
            <>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                    <p className="text-gray-400 text-sm animate-pulse">Loading identity...</p>
                </div>
            </>
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
        <>
            <div className="space-y-8 animate-fade-in">
                {/* Minimal Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-3">
                            <User size={12} />
                            Professional Identity
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                            Personal Profile
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Refine your repository of metadata and career artifacts.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {message && (
                    <div className={`p-4 rounded-xl flex items-center justify-between border-2 animate-slide-down 
                        ${message.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                        <div className="flex items-center gap-3">
                            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                            <span className="font-bold text-sm">{message.text}</span>
                        </div>
                        <button onClick={() => setMessage(null)} className="text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Dismiss</button>
                    </div>
                )}

                <div className="grid lg:grid-cols-12 gap-8">
                    {/* Left: Core Information */}
                    <div className="lg:col-span-8 space-y-8">
                        <div className="card-simple">
                            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-8 border-b border-gray-50 pb-4 flex items-center gap-2">
                                <Layers size={16} className="text-green-600" />
                                Core Repository
                            </h2>
                            <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="space-y-1.5 group">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-green-600 transition-colors">
                                        <User size={12} />
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-transparent focus:border-green-500 focus:bg-white rounded-xl outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-300"
                                        placeholder="John Doe"
                                    />
                                </div>

                                <Autocomplete
                                    label="Degree"
                                    value={formData.education}
                                    onChange={(val) => setFormData({ ...formData, education: val })}
                                    suggestions={DEGREES}
                                    icon={GraduationCap}
                                    placeholder="B.Tech, MS, etc."
                                />

                                <Autocomplete
                                    label="Specialization"
                                    value={formData.specialization}
                                    onChange={(val) => setFormData({ ...formData, specialization: val })}
                                    suggestions={SPECIALIZATIONS}
                                    icon={Star}
                                    placeholder="Information Technology"
                                />

                                <Autocomplete
                                    label="University / College"
                                    value={formData.university}
                                    onChange={(val) => setFormData({ ...formData, university: val })}
                                    suggestions={
                                        formData.location && UNIVERSITY_MAP[formData.location]
                                            ? UNIVERSITY_MAP[formData.location]
                                            : (formData.location?.includes('USA') ? UNIVERSITY_MAP['USA'] :
                                                formData.location?.includes('UK') ? UNIVERSITY_MAP['UK'] : GLOBAL_UNIVERSITIES)
                                    }
                                    icon={Building}
                                    placeholder="SOU"
                                />

                                <Autocomplete
                                    label="Location"
                                    value={formData.location}
                                    onChange={(val) => {
                                        setFormData({ ...formData, location: val });
                                        // Clear university if location changes significantly?
                                        // Or just let user pick from new list.
                                    }}
                                    suggestions={LOCATIONS}
                                    icon={MapPin}
                                    placeholder="Ahmedabad"
                                />

                                <Autocomplete
                                    label="Target Role"
                                    value={formData.target_role}
                                    onChange={(val) => setFormData({ ...formData, target_role: val })}
                                    suggestions={TARGET_ROLES}
                                    icon={Target}
                                    placeholder="AI/ML Engineer"
                                />
                            </div>
                        </div>

                        {/* Resume Area */}
                        <div className="card-simple flex flex-col md:flex-row gap-8 items-start">
                            <div className="flex-1 space-y-4">
                                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest border-b border-gray-50 pb-4 flex items-center gap-2">
                                    <FileText size={16} className="text-green-600" />
                                    Resume Analytics
                                </h2>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Our NLP engine parses your artifacts to map technical competencies and career growth potential.
                                </p>

                                {user?.has_resume ? (
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-green-600">
                                                <FileText size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-gray-900 truncate max-w-[150px]" title={user.resume_filename}>{user.resume_filename || 'DefaultResume.pdf'}</p>
                                                <p className="text-[9px] font-bold text-green-600 uppercase tracking-tighter">Active Artifact</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleExtractAllSkills}
                                                disabled={extracting}
                                                className="px-3 py-1.5 bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-gray-800 transition-all flex items-center gap-1.5"
                                            >
                                                {extracting ? <RefreshCw className="animate-spin" size={12} /> : <Sparkles size={12} />}
                                                Sync
                                            </button>
                                            <label className="p-2 text-gray-400 hover:text-green-600 cursor-pointer transition-colors">
                                                <Upload size={16} />
                                                <input type="file" className="hidden" onChange={handleResumeUpload} accept=".pdf,.doc,.docx,.txt" />
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="block p-8 border-2 border-dashed border-gray-100 rounded-2xl text-center cursor-pointer hover:border-green-500 hover:bg-green-50/10 transition-all group">
                                        <Upload className="text-gray-300 mx-auto mb-3 group-hover:text-green-600" size={24} />
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Upload Resume</p>
                                        <input type="file" className="hidden" onChange={handleResumeUpload} accept=".pdf,.doc,.docx,.txt" />
                                    </label>
                                )}
                            </div>

                            {/* Completion Indicator */}
                            <div className="w-full md:w-56 bg-gray-50 border border-gray-100 rounded-2xl p-6 text-gray-900 space-y-6 shadow-sm">
                                <div className="space-y-1">
                                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Profile Status</h3>
                                    <p className="text-4xl font-bold tracking-tight text-gray-900">{Math.round(profile?.profile_completion || 0)}%</p>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${profile?.profile_completion || 0}%` }}
                                    />
                                </div>
                                <p className="text-[9px] font-bold text-gray-500 uppercase leading-relaxed tracking-tight">
                                    Closing this gap unlocks advanced market analysis.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Social & Intelligence */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Integrations */}
                        <div className="card-simple">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-1">Social Signals</h3>
                            <div className="space-y-4">
                                {[
                                    { id: 'github_url', label: 'GitHub', icon: Github, color: 'text-gray-900', bg: 'bg-gray-50', placeholder: 'github.com/profile' },
                                    { id: 'linkedin_url', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-600', bg: 'bg-blue-50', placeholder: 'linkedin.com/in/profile' },
                                ].map((social) => (
                                    <div key={social.id} className="relative group">
                                        <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 ${social.bg} ${social.color} rounded-lg flex items-center justify-center shadow-sm transition-transform group-focus-within:scale-110`}>
                                            <social.icon size={16} />
                                        </div>
                                        <input
                                            type="url"
                                            value={(formData as any)[social.id]}
                                            onChange={(e) => setFormData({ ...formData, [social.id]: e.target.value })}
                                            className="w-full pl-14 pr-4 py-2.5 bg-gray-50 border border-transparent focus:border-green-500 focus:bg-white rounded-xl outline-none transition-all text-[11px] font-bold text-gray-900"
                                            placeholder={social.placeholder}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Skill Signals Snapshot */}
                        <div className="card-simple">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Intelligence</h3>
                                <div className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">{skills.length} Nodes</div>
                            </div>

                            {skills.length > 0 ? (
                                <div className="space-y-6">
                                    {Object.entries(skillsBySource).map(([source, sourceSkills], i) => (
                                        <div key={source} className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{source}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {sourceSkills.slice(0, 8).map((skill) => (
                                                    <span key={skill.id} className="px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-600 cursor-default hover:bg-white hover:border-green-100 transition-all">
                                                        {skill.skill_name}
                                                    </span>
                                                ))}
                                                {sourceSkills.length > 8 && (
                                                    <span className="text-[10px] font-bold text-gray-400 px-1">+ {sourceSkills.length - 8}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => router.push('/skills')}
                                        className="w-full py-3 bg-gray-50 text-gray-500 hover:text-green-600 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-transparent hover:border-green-100"
                                    >
                                        Full Skill Analysis
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Award size={32} className="mx-auto mb-3 text-gray-200" />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Inert Profile</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
