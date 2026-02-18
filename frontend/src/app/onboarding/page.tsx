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
            // Save profile data on step 1
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
            // Final step - upload resume and extract skills
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
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-lg">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                            <Sparkles className="text-white" size={28} />
                        </div>
                        <span className="text-3xl font-bold text-white">SkillPath</span>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={`flex items-center ${s < 3 ? 'flex-1' : ''}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${s < step ? 'bg-green-500 text-white' : s === step ? 'bg-green-500/20 border-2 border-green-500 text-green-400' : 'bg-gray-700 text-gray-500'
                                }`}>
                                {s < step ? <CheckCircle size={20} /> : s}
                            </div>
                            {s < 3 && <div className={`flex-1 h-1 mx-2 rounded ${s < step ? 'bg-green-500' : 'bg-gray-700'}`} />}
                        </div>
                    ))}
                </div>

                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-8">
                    <h1 className="text-2xl font-bold text-white text-center mb-2">
                        {step === 1 && 'Complete Your Profile'}
                        {step === 2 && 'Set Your Goals'}
                        {step === 3 && 'Upload Your Resume'}
                    </h1>
                    <p className="text-gray-400 text-center mb-8">
                        {step === 1 && 'Tell us about your background'}
                        {step === 2 && 'What role are you targeting?'}
                        {step === 3 && 'We\'ll analyze it to extract your skills'}
                    </p>

                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Education</label>
                                <div className="relative">
                                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="text"
                                        value={formData.education}
                                        onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                                        placeholder="B.Tech in Computer Science"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">University</label>
                                <input
                                    type="text"
                                    value={formData.university}
                                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                                    placeholder="MIT, Stanford, etc."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                                    placeholder="New York, USA"
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Target Role</label>
                                <div className="relative">
                                    <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="text"
                                        value={formData.target_role}
                                        onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                                        placeholder="Healthcare Data Analyst"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">This helps us provide targeted skill gap analysis and recommendations</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {['Data Analyst', 'ML Engineer', 'Software Developer', 'Healthcare IT'].map((role) => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, target_role: role })}
                                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${formData.target_role === role
                                            ? 'border-green-500 bg-green-500/10 text-green-400'
                                            : 'border-gray-600 bg-gray-700/30 text-gray-300 hover:border-gray-500'
                                            }`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <label className="block cursor-pointer">
                                <div className={`p-8 border-2 border-dashed rounded-xl text-center transition-all ${resumeFile ? 'border-green-500 bg-green-500/10' : 'border-gray-600 hover:border-gray-500'
                                    }`}>
                                    {resumeFile ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="text-green-400" size={40} />
                                            <p className="text-white font-medium">{resumeFile.name}</p>
                                            <p className="text-sm text-gray-400">Click to change file</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <Upload className="text-gray-400" size={40} />
                                            <p className="text-white font-medium">Upload your resume</p>
                                            <p className="text-sm text-gray-400">PDF, DOCX, or TXT (max 5MB)</p>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    accept=".pdf,.docx,.doc,.txt"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                            <p className="text-center text-gray-400 text-sm">
                                We&apos;ll use AI to extract your skills from your resume
                            </p>
                        </div>
                    )}

                    <div className="flex gap-4 mt-8">
                        {step > 1 && (
                            <button type="button" onClick={handleBack} className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 flex items-center justify-center gap-2">
                                <ChevronLeft size={20} /> Back
                            </button>
                        )}
                        <button type="button" onClick={handleNext} disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : step === 3 ? 'Complete Setup' : <><span>Continue</span><ChevronRight size={20} /></>}
                        </button>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-400 text-sm">
                        Skip for now
                    </button>
                </div>
            </div>
        </div>
    );
}
