'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import {
    GraduationCap,
    Target,
    ChevronRight,
    ChevronLeft,
    CheckCircle,
    Sparkles,
    Upload,
    FileText,
    RefreshCw,
    MapPin,
    User
} from 'lucide-react';

export default function OnboardingPage() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const { user, refreshUser, userId } = useAuth();
    const router = useRouter();

    const [formData, setFormData] = useState({
        education: '',
        university: '',
        target_role: '',
        location: '',
    });

    const [resumeFile, setResumeFile] = useState<File | null>(null);

    useEffect(() => {
        if (user) {
            setFormData({
                education: user.education || '',
                university: user.university || '',
                target_role: user.target_role || '',
                location: user.location || '',
            });
        }
    }, [user]);

    const handleNext = async () => {
        if (step < 3) {
            if (step === 1 && userId) {
                setLoading(true);
                try {
                    await api.updateUser(userId, formData);
                    await refreshUser();
                } catch (error) {
                    console.error('Failed to update profile:', error);
                } finally {
                    setLoading(false);
                }
            }
            setStep(step + 1);
        } else {
            setLoading(true);
            try {
                if (resumeFile && userId) {
                    await api.uploadResume(userId, resumeFile);
                    await api.extractSkills(userId);
                }
                await refreshUser();
                router.push('/dashboard');
            } catch (error) {
                console.error('Failed to complete onboarding:', error);
                router.push('/dashboard');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setResumeFile(file);
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 animate-fade-in text-gray-900">
            <div className="w-full max-w-xl space-y-12">
                {/* Logo & Progress */}
                <div className="text-center space-y-8">
                    <div className="inline-flex items-center gap-2">
                        <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-sm">
                            <Sparkles className="text-white" size={20} />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">SkillBridge</span>
                    </div>

                    <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex-1 flex items-center">
                                <div className={`h-1.5 rounded-full transition-all duration-500 ${s <= step ? 'flex-1 bg-green-500' : 'w-4 bg-gray-200 opacity-50'}`} />
                                {s < 3 && <div className="w-2" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 md:p-12 shadow-sm">
                    <div className="mb-10">
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                            {step === 1 && 'Professional Context'}
                            {step === 2 && 'Career Ambition'}
                            {step === 3 && 'Skill Repository'}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {step === 1 && 'Define your educational foundation'}
                            {step === 2 && 'Identify your target role for analysis'}
                            {step === 3 && 'Connect your resume/CV artifact'}
                        </p>
                    </div>

                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                    <GraduationCap size={12} />
                                    Education
                                </label>
                                <input
                                    type="text"
                                    value={formData.education}
                                    onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                    placeholder="B.S. Computer Science"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">University</label>
                                <input
                                    type="text"
                                    value={formData.university}
                                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                    placeholder="Stanford, MIT, etc."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                    <MapPin size={12} />
                                    Location
                                </label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                    placeholder="San Francisco, CA"
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                    <Target size={12} />
                                    Target Role
                                </label>
                                <input
                                    type="text"
                                    value={formData.target_role}
                                    onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                    placeholder="e.g. Backend Engineer"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {['Software Engineer', 'Data Scientist', 'Product Manager', 'UX Designer'].map((role) => (
                                    <button
                                        key={role}
                                        onClick={() => setFormData({ ...formData, target_role: role })}
                                        className={`p-3 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all ${formData.target_role === role
                                            ? 'bg-green-600 text-white border-green-600'
                                            : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'
                                            }`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 text-center">
                            <label className="block cursor-pointer">
                                <div className={`p-10 border-2 border-dashed rounded-[2rem] transition-all hover:bg-green-50/10 ${resumeFile ? 'border-green-500 bg-green-50/20' : 'border-gray-100 bg-gray-50'}`}>
                                    {resumeFile ? (
                                        <div className="space-y-2">
                                            <FileText className="text-green-600 mx-auto" size={40} />
                                            <p className="text-[11px] font-bold text-gray-900 uppercase tracking-widest truncate max-w-xs mx-auto">{resumeFile.name}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Upload className="text-gray-300 mx-auto" size={40} />
                                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Connect Artifact</p>
                                        </div>
                                    )}
                                </div>
                                <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.doc,.txt" />
                            </label>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                AI Skills extraction will occur automatically.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-4 mt-12">
                        {step > 1 && (
                            <button onClick={handleBack} className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center justify-center gap-2">
                                <ChevronLeft size={16} /> Back
                            </button>
                        )}
                        <button onClick={handleNext} disabled={loading} className="flex-1 py-4 bg-gray-900 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all">
                            {loading ? <RefreshCw className="animate-spin" size={16} /> : step === 3 ? 'Sync IQ' : <>Continue <ChevronRight size={16} /></>}
                        </button>
                    </div>
                </div>

                <div className="text-center">
                    <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-200 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors">
                        Inert Onboarding / Skip
                    </button>
                </div>
            </div>
        </div>
    );
}
