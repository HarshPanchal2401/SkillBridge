'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth';
import { 
    User, 
    ShieldCheck, 
    Briefcase, 
    Palette, 
    Save, 
    ChevronRight,
    Github,
    Globe,
    ExternalLink,
    Trash2,
    Eye
} from 'lucide-react';

export default function SettingsPage() {
    const { user, refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState('account');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [projects, setProjects] = useState<any[]>([]);

    // Form states
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        password: '',
        confirmPassword: ''
    });

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || '',
                email: user.email || ''
            }));
            
            // Fetch projects for the Projects tab
            fetchProjects();
        }
    }, [user]);

    const fetchProjects = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`http://localhost:8000/api/users/${user.id}/projects`);
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        }
    };

    const handleUpdateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;

        if (formData.password && formData.password !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const updatePayload: any = {
                name: formData.name,
                email: formData.email
            };
            if (formData.password) {
                updatePayload.password = formData.password;
            }

            const res = await fetch(`http://localhost:8000/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Profile updated successfully!' });
                await refreshUser();
                setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
            } else {
                const error = await res.json();
                setMessage({ type: 'error', text: error.message || 'Update failed' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Connection error' });
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'account', label: 'Account', icon: User },
        { id: 'projects', label: 'Projects', icon: Briefcase },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
    ];

    return (
        <div className="p-6 lg:p-10 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="mb-10">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Settings</h1>
                <p className="text-gray-500 font-medium">Manage your account, projects, and platform preferences.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Tabs */}
                <div className="lg:w-64 shrink-0">
                    <div className="bg-white/50 backdrop-blur-xl border border-gray-100 rounded-2xl p-2 shadow-sm space-y-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all
                                        ${isActive 
                                            ? 'bg-green-600 text-white shadow-md shadow-green-100 translate-x-1' 
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                                    `}
                                >
                                    <Icon size={18} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-white/70 backdrop-blur-xl border border-gray-100 rounded-3xl p-8 shadow-sm">
                    {/* Account Tab */}
                    {activeTab === 'account' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <User className="text-green-500" size={20} />
                                    Account Information
                                </h2>
                                
                                <form onSubmit={handleUpdateAccount} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Full Name</label>
                                            <input 
                                                type="text" 
                                                value={formData.name}
                                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium"
                                                placeholder="Enter full name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
                                            <input 
                                                type="email" 
                                                value={formData.email}
                                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                                className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium"
                                                placeholder="email@example.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-50">
                                        <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-widest">Security</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">New Password</label>
                                                <input 
                                                    type="password" 
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Confirm Password</label>
                                                <input 
                                                    type="password" 
                                                    value={formData.confirmPassword}
                                                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                                                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {message.text && (
                                        <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                            {message.text}
                                        </div>
                                    )}

                                    <button 
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-2 bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-gray-200"
                                    >
                                        <Save size={18} />
                                        {loading ? 'Saving Changes...' : 'Save Changes'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Projects Tab */}
                    {activeTab === 'projects' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Briefcase className="text-green-500" size={20} />
                                    Project Relations
                                </h2>
                                <button className="text-xs font-bold text-green-600 hover:text-green-700 underline uppercase tracking-wider">Sync GitHub</button>
                            </div>
                            
                            <p className="text-gray-500 text-sm font-medium mb-6">Manage projects that contribute to your Skill IQ and gap analysis.</p>
                            
                            <div className="space-y-4">
                                {projects.length > 0 ? (
                                    projects.map((project) => (
                                        <div key={project.id} className="group p-5 bg-gray-50/50 border border-gray-100 rounded-2xl flex items-center justify-between hover:bg-white hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm group-hover:bg-green-600 group-hover:text-white transition-all">
                                                    <Briefcase size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 mb-0.5">{project.project_name}</h4>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{project.role || 'Project'}</span>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                        <span className="text-[10px] font-medium text-gray-500 truncate max-w-[200px]">{project.tech_stack?.join(', ') || 'No tech stack'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" title="View Details">
                                                    <Eye size={16} />
                                                </button>
                                                <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete Project">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-20 text-center bg-gray-50/30 border-2 border-dashed border-gray-100 rounded-3xl">
                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-gray-300 mx-auto mb-4 shadow-sm">
                                            <Briefcase size={28} />
                                        </div>
                                        <p className="text-gray-500 font-bold mb-1">No Projects Found</p>
                                        <p className="text-gray-400 text-xs px-10">Upload your resume or sync with GitHub to populate your projects.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Appearance Tab */}
                    {activeTab === 'appearance' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Palette className="text-green-500" size={20} />
                                    Interface Customization
                                </h2>
                                
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Theme Mode</h3>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            {['Light', 'Dark', 'System'].map((theme) => (
                                                <button 
                                                    key={theme}
                                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all ${theme === 'Dark' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 bg-gray-50/50 text-gray-400 hover:border-gray-200'}`}
                                                >
                                                    <div className={`w-full h-16 rounded-xl ${theme === 'Dark' ? 'bg-gray-900' : theme === 'Light' ? 'bg-white shadow-sm' : 'bg-gradient-to-br from-white to-gray-900'}`}></div>
                                                    <span className="text-xs font-bold uppercase tracking-wider">{theme}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-gray-50">
                                        <div className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-2xl">
                                            <div>
                                                <h4 className="font-bold text-gray-900">Reduced Motion</h4>
                                                <p className="text-[10px] text-gray-500 mt-1">Minimize animations throughout the dashboard.</p>
                                            </div>
                                            <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer shadow-inner">
                                                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Privacy Tab */}
                    {activeTab === 'privacy' && (
                        <div className="space-y-8 animate-in fade-in duration-500 py-10 text-center">
                            <div className="w-20 h-20 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <ShieldCheck size={40} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Security & Privacy</h2>
                                <p className="text-gray-500 text-sm font-medium mb-8">Secure your data and manage your visibility.</p>
                                
                                <div className="max-w-md mx-auto space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-2xl">
                                        <div className="text-left">
                                            <h4 className="font-bold text-gray-900 text-sm">Two-Factor Auth</h4>
                                            <p className="text-[10px] text-gray-500">Add an extra layer of security.</p>
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-gray-300 tracking-widest bg-white px-3 py-1.5 rounded-full border border-gray-100">Coming Soon</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-red-50/50 border border-red-100 rounded-2xl">
                                        <div className="text-left">
                                            <h4 className="font-bold text-red-700 text-sm">Delete Account</h4>
                                            <p className="text-[10px] text-red-600/70">Permanently remove all your data.</p>
                                        </div>
                                        <button className="p-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
