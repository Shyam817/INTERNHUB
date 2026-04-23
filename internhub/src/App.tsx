import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Send, 
  Star, 
  Trophy, 
  MessageSquare, 
  FileText, 
  Briefcase, 
  LogOut, 
  User as UserIcon,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Search,
  Upload,
  ChevronRight,
  Clock,
  TrendingUp,
  Users,
  Target,
  Calendar
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { User, Task, Submission, Review, ChatMessage, Role, Domain } from './types';
import { analyzeResume, matchJob } from './services/gemini';
import { extractTextFromPDF } from './lib/pdf';
import { io, Socket } from 'socket.io-client';

// --- Socket Initialization ---
let socket: Socket;

// --- Local Storage Helpers ---
const STORAGE_KEY = 'internhub_db';

const getDB = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : { users: [], tasks: [], submissions: [], reviews: [] };
};

const saveDB = (db: any) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    const savedUser = localStorage.getItem('internhub_session');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      // Sync DB on load
      fetch('/api/db')
        .then(res => res.json())
        .then(data => saveDB(data))
        .catch(err => console.error('Failed to sync DB:', err));
    }
    setIsAuthReady(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('internhub_session');
    setUser(null);
    setActivePage('dashboard');
  };

  if (!isAuthReady) return null;

  if (!user) {
    return <AuthScreen onLogin={(u) => {
      setUser(u);
      localStorage.setItem('internhub_session', JSON.stringify(u));
    }} />;
  }

  return (
    <div className="flex h-screen bg-[#050505] text-[#e2e8f0] overflow-hidden font-sans flex-col md:flex-row selection:bg-[#ff00ff]/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#0f0f0f] border-r border-[#1f1f1f] flex-col shrink-0">
        <div className="p-6 border-b border-[#1f1f1f]">
          <div className="text-xl font-black tracking-tight bg-gradient-to-br from-white to-[#ff00ff] bg-clip-text text-transparent">🎓 InternHub</div>
          <div className="text-[11px] text-[#ff00ff] font-bold mt-1 uppercase tracking-wider">{user.domain}</div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem 
            active={activePage === 'dashboard'} 
            onClick={() => setActivePage('dashboard')} 
            icon={<LayoutDashboard size={18} />} 
            label="Dashboard" 
          />
          <NavItem 
            active={activePage === 'tasks'} 
            onClick={() => setActivePage('tasks')} 
            icon={<ClipboardList size={18} />} 
            label={user.role === 'mentor' ? 'Manage Tasks' : 'Browse Tasks'} 
          />
          <NavItem 
            active={activePage === 'submissions'} 
            onClick={() => setActivePage('submissions')} 
            icon={<Send size={18} />} 
            label="Submissions" 
          />
          <NavItem 
            active={activePage === 'reviews'} 
            onClick={() => setActivePage('reviews')} 
            icon={<Star size={18} />} 
            label="Peer Reviews" 
          />
          <NavItem 
            active={activePage === 'leaderboard'} 
            onClick={() => setActivePage('leaderboard')} 
            icon={<Trophy size={18} />} 
            label="Leaderboard" 
          />
          <div className="my-4 border-t border-[#2d3352] opacity-50" />
          <NavItem 
            active={activePage === 'chat'} 
            onClick={() => setActivePage('chat')} 
            icon={<MessageSquare size={18} />} 
            label="Domain Chat" 
          />
          <NavItem 
            active={activePage === 'resume'} 
            onClick={() => setActivePage('resume')} 
            icon={<FileText size={18} />} 
            label="AI Resume" 
          />
          <NavItem 
            active={activePage === 'jobs'} 
            onClick={() => setActivePage('jobs')} 
            icon={<Briefcase size={18} />} 
            label="Job Match" 
          />
        </nav>

        <div className="p-4 m-4 bg-[#1a1a1a] rounded-xl border border-[#1f1f1f]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff00ff] to-[#7000ff] flex items-center justify-center font-bold text-white shadow-lg shadow-[#ff00ff]/20">
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className={cn(
                "text-[10px] px-2 py-0.5 rounded-full inline-block font-bold",
                user.role === 'mentor' ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400"
              )}>
                {user.role === 'mentor' ? 'Mentor' : 'Student'}
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center text-[11px] text-[#64748b]">
            {user.role === 'student' && (
              <span>Score: <b className="text-[#ff00ff]">{user.score}</b></span>
            )}
            <button onClick={handleLogout} className={cn("text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1", user.role === 'mentor' && "w-full justify-center")}>
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden h-14 px-6 border-b border-[#1f1f1f] bg-[#0f0f0f] flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="text-lg font-black tracking-tight bg-gradient-to-br from-white to-[#ff00ff] bg-clip-text text-transparent">🎓 InternHub</div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#ff00ff] font-bold border border-[#1f1f1f]">
            {user.domain}
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff00ff] to-[#7000ff] flex items-center justify-center font-bold text-white text-[10px]">
            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
        <header className="hidden md:flex h-16 px-8 border-b border-[#1f1f1f] bg-[#0f0f0f] items-center justify-between shrink-0">
          <h1 className="text-lg font-black tracking-tight capitalize">{activePage.replace('-', ' ')}</h1>
          <div id="topbar-actions"></div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activePage === 'dashboard' && <Dashboard user={user} />}
              {activePage === 'tasks' && <Tasks user={user} />}
              {activePage === 'submissions' && <Submissions user={user} />}
              {activePage === 'reviews' && <Reviews user={user} />}
              {activePage === 'leaderboard' && <Leaderboard user={user} />}
              {activePage === 'chat' && <Chat user={user} />}
              {activePage === 'resume' && <ResumeAnalyzer user={user} />}
              {activePage === 'jobs' && <JobMatcher user={user} />}
              {activePage === 'more' && <MobileMore user={user} onLogout={handleLogout} onNavigate={setActivePage} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden h-16 bg-[#0f0f0f] border-t border-[#1f1f1f] flex items-center justify-around px-2 fixed bottom-0 left-0 right-0 z-40 pb-safe">
        <MobileNavItem 
          active={activePage === 'dashboard'} 
          onClick={() => setActivePage('dashboard')} 
          icon={<LayoutDashboard size={20} />} 
          label="Home" 
        />
        <MobileNavItem 
          active={activePage === 'tasks'} 
          onClick={() => setActivePage('tasks')} 
          icon={<ClipboardList size={20} />} 
          label="Tasks" 
        />
        <MobileNavItem 
          active={activePage === 'chat'} 
          onClick={() => setActivePage('chat')} 
          icon={<MessageSquare size={20} />} 
          label="Chat" 
        />
        <MobileNavItem 
          active={activePage === 'leaderboard'} 
          onClick={() => setActivePage('leaderboard')} 
          icon={<Trophy size={20} />} 
          label="Rank" 
        />
        <MobileNavItem 
          active={activePage === 'more' || activePage === 'resume' || activePage === 'jobs' || activePage === 'submissions' || activePage === 'reviews'} 
          onClick={() => setActivePage('more')} 
          icon={<Plus size={20} className={cn("transition-transform", (activePage === 'more' || activePage === 'resume' || activePage === 'jobs') ? "rotate-45" : "")} />} 
          label="More" 
        />
      </nav>
    </div>
  );
}

function MobileNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
        active ? "text-[#ff00ff]" : "text-[#64748b]"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function MobileMore({ user, onLogout, onNavigate }: { user: User, onLogout: () => void, onNavigate: (p: string) => void }) {
  const isMentor = user.role === 'mentor';
  const db = getDB();
  
  const mentorTasks = db.tasks.filter((t: any) => t.mentor === user.name).length;
  const domainSubmissions = db.submissions.filter((s: any) => s.domain === user.domain).length;

  return (
    <div className="space-y-6">
      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ff00ff] to-[#7000ff] flex items-center justify-center font-bold text-white text-2xl shadow-lg shadow-[#ff00ff]/20">
            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-sm text-[#64748b]">@{user.username}</p>
            <div className="flex gap-2 mt-2">
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-bold border",
                isMentor ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-sky-500/10 text-sky-400 border-sky-500/20"
              )}>
                {user.role}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ff00ff]/10 text-[#ff00ff] font-bold border border-[#ff00ff]/20">
                {user.domain}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#1f1f1f] text-center">
            <div className="text-xl font-black text-[#ff00ff]">{isMentor ? mentorTasks : user.score}</div>
            <div className="text-[10px] font-bold text-[#64748b] uppercase">{isMentor ? 'Tasks' : 'Score'}</div>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#1f1f1f] text-center">
            <div className="text-xl font-black text-[#ffaa00]">{isMentor ? domainSubmissions : user.tasks_completed}</div>
            <div className="text-[10px] font-bold text-[#64748b] uppercase">{isMentor ? 'Submissions' : 'Done'}</div>
          </div>
        </div>
      </div>

      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#1f1f1f] text-xs font-bold text-[#64748b] uppercase tracking-widest">
          Additional Tools
        </div>
        <div className="divide-y divide-[#1f1f1f]">
          <button onClick={() => onNavigate('submissions')} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <Send size={18} className="text-[#ff00ff]" />
              <span className="text-sm font-medium">My Submissions</span>
            </div>
            <ChevronRight size={16} className="text-[#64748b]" />
          </button>
          <button onClick={() => onNavigate('reviews')} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <Star size={18} className="text-amber-400" />
              <span className="text-sm font-medium">Peer Reviews</span>
            </div>
            <ChevronRight size={16} className="text-[#64748b]" />
          </button>
          <button onClick={() => onNavigate('resume')} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-[#ff00ff]" />
              <span className="text-sm font-medium">AI Resume Analyzer</span>
            </div>
            <ChevronRight size={16} className="text-[#64748b]" />
          </button>
          <button onClick={() => onNavigate('jobs')} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <Briefcase size={18} className="text-[#ffaa00]" />
              <span className="text-sm font-medium">Job Matcher</span>
            </div>
            <ChevronRight size={16} className="text-[#64748b]" />
          </button>
        </div>
      </div>

      <button 
        onClick={onLogout}
        className="w-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
      >
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  );
}

// --- Components ---

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
        active 
          ? "bg-gradient-to-r from-[#ff00ff]/20 to-[#7000ff]/10 text-[#ff00ff] border border-[#ff00ff]/30 shadow-lg shadow-[#ff00ff]/5" 
          : "text-[#94a3b8] hover:bg-[#1a1a1a] hover:text-[#e2e8f0]"
      )}
    >
      <span className={cn("transition-colors", active ? "text-[#ff00ff]" : "text-[#64748b]")}>{icon}</span>
      {label}
    </button>
  );
}

function AuthScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'student' as Role,
    domain: 'Web Dev' as Domain,
    mentorCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.role === 'mentor' && formData.mentorCode !== '123') {
      setError('Invalid mentor access code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        // Sync local storage with server DB
        const dbRes = await fetch('/api/db');
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          saveDB(dbData);
        }
        onLogin(data.user);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.username, password: formData.password })
      });
      const data = await res.json();
      if (data.success) {
        // Fetch the full database from the server to sync local storage
        const dbRes = await fetch('/api/db');
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          saveDB(dbData);
        }
        onLogin(data.user);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ff00ff] opacity-10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#7000ff] opacity-10 blur-[120px]" />
      </div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-3xl p-10 w-full max-w-md shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎓</div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-br from-white to-[#ff00ff] bg-clip-text text-transparent">InternHub</h1>
          <p className="text-sm text-[#64748b] mt-2">Internship simulation platform</p>
        </div>

        <div className="flex bg-[#1a1a1a] p-1 rounded-xl border border-[#1f1f1f] mb-8">
          <button 
            onClick={() => setMode('login')}
            className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all", mode === 'login' ? "bg-gradient-to-r from-[#ff00ff] to-[#7000ff] text-white" : "text-[#64748b]")}
          >
            Sign In
          </button>
          <button 
            onClick={() => setMode('signup')}
            className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all", mode === 'signup' ? "bg-gradient-to-r from-[#ff00ff] to-[#7000ff] text-white" : "text-[#64748b]")}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#94a3b8] ml-1">Full Name</label>
                <input 
                  required
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff] transition-colors"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#94a3b8] ml-1">Email</label>
                <input 
                  required
                  type="email"
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff] transition-colors"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#94a3b8] ml-1">Username</label>
            <input 
              required
              className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff] transition-colors"
              placeholder="johndoe"
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#94a3b8] ml-1">Password</label>
            <div className="relative">
              <input 
                required
                type={showPass ? 'text' : 'password'}
                className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff] transition-colors pr-12"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#e2e8f0]"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#94a3b8] ml-1">Confirm Password</label>
                <input 
                  required
                  type="password"
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff] transition-colors"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#94a3b8] ml-1">Role</label>
                <div className="flex bg-[#1a1a1a] p-1 rounded-xl border border-[#1f1f1f]">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, role: 'student'})}
                    className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", formData.role === 'student' ? "bg-[#1f1f1f] text-white" : "text-[#64748b]")}
                  >
                    🎓 Student
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, role: 'mentor'})}
                    className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", formData.role === 'mentor' ? "bg-[#1f1f1f] text-white" : "text-[#64748b]")}
                  >
                    👩‍🏫 Mentor
                  </button>
                </div>
              </div>

              {formData.role === 'mentor' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-1"
                >
                  <label className="text-xs font-bold text-[#ffaa00] ml-1 flex items-center gap-1">
                    <ShieldCheck size={12} /> Mentor Access Code
                  </label>
                  <input 
                    required
                    className="w-full bg-[#1a1a1a] border border-[#ffaa00]/30 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ffaa00] transition-colors"
                    placeholder="Enter secret code"
                    value={formData.mentorCode}
                    onChange={e => setFormData({...formData, mentorCode: e.target.value})}
                  />
                </motion.div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#94a3b8] ml-1">Domain</label>
                <select 
                  className="w-full bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#ff00ff] transition-colors appearance-none"
                  value={formData.domain}
                  onChange={e => setFormData({...formData, domain: e.target.value as Domain})}
                >
                  <option>Web Dev</option>
                  <option>Cybersecurity</option>
                  <option>Cloud Computing</option>
                </select>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold bg-rose-400/10 p-3 rounded-xl border border-rose-400/20">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#ff00ff] to-[#7000ff] hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#ff00ff]/20 mt-4"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (mode === 'login' ? 'Sign In →' : 'Create Account →')}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-2 bg-[#1a1a1a] border border-[#1f1f1f] rounded-xl p-3 text-[10px] text-[#64748b]">
          <ShieldCheck size={14} className="text-[#ff00ff]" />
          <span>Secure authentication with role-based access control.</span>
        </div>
      </motion.div>
    </div>
  );
}

function Dashboard({ user }: { user: User }) {
  const [db, setDb] = useState(getDB());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDb(getDB());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const isMentor = user.role === 'mentor';

  // Student Stats
  const mySubmissions = db.submissions.filter((s: any) => s.studentId === user.id);
  const completedCount = mySubmissions.filter((s: any) => s.status === 'reviewed').length;
  const avgScore = mySubmissions.length > 0 
    ? (mySubmissions.reduce((acc: number, s: any) => acc + (s.score || 0), 0) / mySubmissions.length).toFixed(1)
    : '0';
  
  const domainStudents = db.users
    .filter((u: any) => u.role === 'student' && u.domain === user.domain)
    .sort((a: any, b: any) => b.score - a.score);
  const myRank = domainStudents.findIndex((s: any) => s.id === user.id) + 1;

  // Mentor Stats
  const tasksCreated = db.tasks.filter((t: any) => t.mentor === user.name).length;
  const totalDomainSubmissions = db.submissions.filter((s: any) => s.domain === user.domain);
  const pendingReviews = totalDomainSubmissions.filter((s: any) => s.status === 'submitted').length;
  const domainStudentsCount = domainStudents.length;

  // Chart Data
  const chartData = mySubmissions.map((s: any, i: number) => ({
    name: `Task ${i + 1}`,
    score: s.score || 0
  }));

  const domainPerformanceData = domainStudents.slice(0, 5).map((s: any) => ({
    name: s.name.split(' ')[0],
    score: s.score
  }));

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Welcome back, {user.name.split(' ')[0]}! 👋</h2>
          <p className="text-[#64748b] text-sm">Here's what's happening in your {user.domain} internship.</p>
        </div>
        <div className="flex items-center gap-2 bg-[#181c27] border border-[#2d3352] rounded-2xl px-4 py-2">
          <Calendar size={16} className="text-[#ff00ff]" />
          <span className="text-xs font-bold">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isMentor ? (
          <>
            <StatCard value={tasksCreated} label="Tasks Created" icon={<FileText size={20} />} color="from-blue-500 to-cyan-500" />
            <StatCard value={totalDomainSubmissions.length} label="Total Submissions" icon={<TrendingUp size={20} />} color="from-emerald-500 to-teal-500" />
            <StatCard value={pendingReviews} label="Pending Reviews" icon={<Clock size={20} />} color="from-amber-500 to-orange-500" />
            <StatCard value={domainStudentsCount} label="Domain Students" icon={<Users size={20} />} color="from-[#ff00ff] to-[#7000ff]" />
          </>
        ) : (
          <>
            <StatCard value={completedCount} label="Tasks Done" icon={<CheckCircle2 size={20} />} color="from-emerald-500 to-teal-500" />
            <StatCard value={user.score} label="Total Score" icon={<Target size={20} />} color="from-[#ff00ff] to-[#7000ff]" />
            <StatCard value={myRank > 0 ? `#${myRank}` : '#—'} label="Domain Rank" icon={<Trophy size={20} />} color="from-amber-500 to-orange-500" />
            <StatCard value={avgScore} label="Avg Score" icon={<TrendingUp size={20} />} color="from-blue-500 to-cyan-500" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-[#181c27] border border-[#2d3352] rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#64748b]">
              {isMentor ? 'Top Performers' : 'Performance Trend'}
            </h3>
            <div className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#ff00ff]/10 text-[#ff00ff] border border-[#ff00ff]/20">
              {isMentor ? 'Score Leaderboard' : 'Score History'}
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {isMentor ? (
                <BarChart data={domainPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3352" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#181c27', border: '1px solid #2d3352', borderRadius: '12px' }}
                    itemStyle={{ color: '#ff00ff', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                    {domainPerformanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#ff00ff' : '#7000ff'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff00ff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ff00ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3352" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#181c27', border: '1px solid #2d3352', borderRadius: '12px' }}
                    itemStyle={{ color: '#ff00ff', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#ff00ff" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Section */}
        <div className="bg-[#181c27] border border-[#2d3352] rounded-3xl p-6 shadow-xl flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#64748b] mb-6">Recent Activity</h3>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {(isMentor ? totalDomainSubmissions : mySubmissions).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                <Clock size={32} className="mb-2" />
                <p className="text-xs">No activity yet</p>
              </div>
            ) : (
              (isMentor ? totalDomainSubmissions : mySubmissions).slice(-8).reverse().map((s: any) => {
                const student = isMentor ? db.users.find((u: any) => u.id === s.studentId) : null;
                return (
                  <div key={s.id} className="flex gap-3 p-3 rounded-2xl bg-[#1e2235]/50 border border-[#2d3352]/50 hover:bg-[#1e2235] transition-colors">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      s.status === 'reviewed' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    )}>
                      {s.status === 'reviewed' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{s.taskTitle}</div>
                      <div className="text-[10px] text-[#64748b] mt-0.5">
                        {isMentor ? `by ${student?.name || 'Unknown'}` : `Status: ${s.status}`}
                      </div>
                    </div>
                    {s.score && (
                      <div className="text-xs font-black text-[#ff00ff] self-center">
                        {s.score}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, icon, color }: { value: string | number, label: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-[#181c27] border border-[#2d3352] rounded-3xl p-6 relative overflow-hidden group shadow-xl transition-all hover:-translate-y-1">
      <div className={cn("absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br opacity-5 blur-2xl group-hover:opacity-10 transition-opacity", color)} />
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-xl bg-gradient-to-br opacity-80", color)}>
          {React.cloneElement(icon as any, { className: 'text-white' })}
        </div>
        <div className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">{label}</div>
      </div>
      <div className="text-3xl font-black tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function Tasks({ user }: { user: User }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', deadline: '', domain: user.domain });
  const [submissionData, setSubmissionData] = useState({ fileUrl: '', notes: '' });
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    setTasks(data.filter((t: any) => t.domain === user.domain));
  };

  useEffect(() => {
    fetchTasks();
  }, [user.domain]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTask, mentorName: user.name })
      });
      setShowModal(false);
      setNewTask({ title: '', description: '', deadline: '', domain: user.domain });
      fetchTasks();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSubmitModal) return;
    setLoading(true);
    try {
      await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          taskId: showSubmitModal.id,
          taskTitle: showSubmitModal.title,
          fileUrl: submissionData.fileUrl,
          notes: submissionData.notes,
          domain: user.domain
        })
      });
      setShowSubmitModal(null);
      setSubmissionData({ fileUrl: '', notes: '' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    // In a real app, this would be a DELETE /api/tasks/:id
    const db = getDB();
    db.tasks = db.tasks.filter((t: any) => t.id !== taskId);
    saveDB(db);
    fetchTasks();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex bg-[#1e2235] p-1 rounded-xl border border-[#2d3352]">
          {['Web Dev', 'Cybersecurity', 'Cloud Computing'].map(d => (
            <button 
              key={d}
              onClick={() => {}} // In a real app, this would filter
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", user.domain === d ? "bg-[#ff00ff] text-white shadow-lg shadow-[#ff00ff]/20" : "text-[#64748b]")}
            >
              {d}
            </button>
          ))}
        </div>
        {user.role === 'mentor' && (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-[#ff00ff] to-[#7000ff] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#ff00ff]/20"
          >
            <Plus size={16} /> New Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tasks.length === 0 ? (
          <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-12 text-center text-[#64748b]">
            <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
            <p>No tasks found for your domain.</p>
          </div>
        ) : (
          tasks.map((t: any) => (
            <div key={t.id} className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6 flex items-start gap-4 hover:border-[#ff00ff]/30 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-[#ff00ff]/20 to-[#7000ff]/10 rounded-xl flex items-center justify-center text-2xl shrink-0">
                📋
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold">{t.title}</h3>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                    t.domain === 'Web Dev' ? "bg-sky-500/10 text-sky-400" : t.domain === 'Cybersecurity' ? "bg-red-500/10 text-red-400" : "bg-indigo-500/10 text-indigo-400"
                  )}>
                    {t.domain}
                  </span>
                </div>
                <p className="text-sm text-[#94a3b8] mb-4 line-clamp-2">{t.description}</p>
                <div className="flex items-center gap-6 text-[11px] text-[#64748b]">
                  <span className="flex items-center gap-1"><UserIcon size={12} /> {t.mentor}</span>
                  <span className="flex items-center gap-1 text-amber-400 font-bold">⏰ Due {t.deadline}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {user.role === 'student' ? (
                  <button 
                    onClick={() => setShowSubmitModal(t)}
                    className="bg-gradient-to-r from-[#ff00ff] to-[#7000ff] hover:opacity-90 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-[#ff00ff]/20"
                  >
                    Submit
                  </button>
                ) : (
                  <button 
                    onClick={() => handleDeleteTask(t.id)}
                    className="text-rose-400 hover:bg-rose-400/10 p-2 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#181c27] border border-[#2d3352] rounded-3xl p-8 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Submit Work: {showSubmitModal.title}</h2>
              <button onClick={() => setShowSubmitModal(null)} className="text-[#64748b] hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmitWork} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#94a3b8]">File URL (Image/Video/GitHub)</label>
                <input 
                  required
                  className="w-full bg-[#1e2235] border border-[#2d3352] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff]"
                  placeholder="https://github.com/..."
                  value={submissionData.fileUrl}
                  onChange={e => setSubmissionData({...submissionData, fileUrl: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#94a3b8]">Notes</label>
                <textarea 
                  className="w-full bg-[#1e2235] border border-[#2d3352] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff] min-h-[100px]"
                  placeholder="Any additional notes..."
                  value={submissionData.notes}
                  onChange={e => setSubmissionData({...submissionData, notes: e.target.value})}
                />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#ff00ff] to-[#7000ff] hover:opacity-90 text-white font-bold py-3 rounded-xl mt-4 transition-all shadow-lg shadow-[#ff00ff]/20">
                {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Submit Task →'}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#181c27] border border-[#2d3352] rounded-3xl p-8 w-full max-w-lg"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Create New Task</h2>
              <button onClick={() => setShowModal(false)} className="text-[#64748b] hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#94a3b8]">Title</label>
                <input 
                  required
                  className="w-full bg-[#1e2235] border border-[#2d3352] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff]"
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#94a3b8]">Description</label>
                <textarea 
                  required
                  className="w-full bg-[#1e2235] border border-[#2d3352] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff] min-h-[120px]"
                  value={newTask.description}
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#94a3b8]">Domain</label>
                  <select 
                    className="w-full bg-[#1e2235] border border-[#2d3352] rounded-xl px-4 py-3 text-sm text-white outline-none"
                    value={newTask.domain}
                    onChange={e => setNewTask({...newTask, domain: e.target.value as Domain})}
                  >
                    <option>Web Dev</option>
                    <option>Cybersecurity</option>
                    <option>Cloud Computing</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#94a3b8]">Deadline</label>
                  <input 
                    required
                    type="date"
                    className="w-full bg-[#1e2235] border border-[#2d3352] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#ff00ff]"
                    value={newTask.deadline}
                    onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-[#ff00ff] to-[#7000ff] hover:opacity-90 text-white font-bold py-3 rounded-xl mt-4 transition-all shadow-lg shadow-[#ff00ff]/20">
                Create Task →
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Submissions({ user }: { user: User }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [db, setDb] = useState(getDB());
  const [showGradeModal, setShowGradeModal] = useState<Submission | null>(null);
  const [showAssignPeerModal, setShowAssignPeerModal] = useState<Submission | null>(null);
  const [grade, setGrade] = useState(80);
  const [loading, setLoading] = useState(false);

  const isMentor = user.role === 'mentor';

  useEffect(() => {
    const fetchSubmissions = () => {
      const currentDb = getDB();
      setDb(currentDb);
      const filtered = isMentor 
        ? currentDb.submissions.filter((s: any) => s.domain === user.domain)
        : currentDb.submissions.filter((s: any) => s.studentId === user.id);
      setSubmissions(filtered);
    };
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 5000);
    return () => clearInterval(interval);
  }, [user.id, user.domain, isMentor]);

  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showGradeModal) return;
    setLoading(true);
    
    const currentDb = getDB();
    const subIdx = currentDb.submissions.findIndex((s: any) => s.id === showGradeModal.id);
    if (subIdx !== -1) {
      currentDb.submissions[subIdx].status = 'reviewed';
      currentDb.submissions[subIdx].score = grade;
      currentDb.submissions[subIdx].mentorScore = grade;
      
      const studentId = currentDb.submissions[subIdx].studentId;
      const userIdx = currentDb.users.findIndex((u: any) => u.id === studentId);
      if (userIdx !== -1) {
        currentDb.users[userIdx].score += grade;
        currentDb.users[userIdx].tasks_completed += 1;
      }
      
      saveDB(currentDb);
      setShowGradeModal(null);
    }
    setLoading(false);
  };

  const handleAssignPeer = async (reviewerId: string) => {
    if (!showAssignPeerModal) return;
    setLoading(true);
    try {
      await fetch('/api/reviews/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: showAssignPeerModal.id,
          reviewerId,
          taskTitle: showAssignPeerModal.taskTitle
        })
      });
      setShowAssignPeerModal(null);
      // Refresh DB
      const dbRes = await fetch('/api/db');
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        saveDB(dbData);
        setDb(dbData);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
        <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-6">
          {isMentor ? `Submissions in ${user.domain}` : 'My Submissions'}
        </h3>
        {submissions.length === 0 ? (
          <div className="text-center py-20 text-[#64748b]">
            <Send size={48} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-bold text-[#e2e8f0] mb-2">No submissions yet</h3>
            <p className="text-sm">{isMentor ? 'Students haven\'t submitted any work yet.' : 'Complete a task and submit your work to see it here.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-[#64748b] border-b border-[#2d3352]">
                  <th className="pb-4 font-bold uppercase text-[10px] tracking-wider">Task</th>
                  {isMentor && <th className="pb-4 font-bold uppercase text-[10px] tracking-wider">Student</th>}
                  <th className="pb-4 font-bold uppercase text-[10px] tracking-wider">Date</th>
                  <th className="pb-4 font-bold uppercase text-[10px] tracking-wider">Status</th>
                  <th className="pb-4 font-bold uppercase text-[10px] tracking-wider text-center">Score</th>
                  <th className="pb-4 font-bold uppercase text-[10px] tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d3352]/50">
                {submissions.map((s: any) => {
                  const student = isMentor ? db.users.find((u: any) => u.id === s.studentId) : null;
                  return (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-5 font-semibold">{s.taskTitle}</td>
                      {isMentor && <td className="py-5 text-[#94a3b8]">{student?.name || 'Unknown'}</td>}
                      <td className="py-5 text-[#64748b]">{s.date || 'Recent'}</td>
                      <td className="py-5">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                          s.status === 'reviewed' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                        )}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-5 text-center text-[#ff00ff] font-black">{s.score ?? 'Pending'}</td>
                      <td className="py-5 text-right">
                        {isMentor ? (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setShowAssignPeerModal(s)}
                              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-amber-500/20"
                            >
                              {db.reviews.find((r: any) => r.submissionId === s.id) ? 'Re-assign Peer' : 'Assign Peer'}
                            </button>
                            <button 
                              onClick={() => {
                                setShowGradeModal(s);
                                setGrade(s.score || 80);
                              }}
                              className="bg-[#ff00ff]/10 hover:bg-[#ff00ff]/20 text-[#ff00ff] px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-[#ff00ff]/20"
                            >
                              {s.status === 'reviewed' ? 'Update Grade' : 'Grade'}
                            </button>
                          </div>
                        ) : (
                          <a 
                            href={s.fileUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center gap-1 text-[#64748b] hover:text-[#ff00ff] transition-colors text-xs font-bold"
                          >
                            <Eye size={14} /> View
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showGradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#181c27] border border-[#2d3352] rounded-3xl p-8 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Grade Submission: {showGradeModal.taskTitle}</h2>
              <button onClick={() => setShowGradeModal(null)} className="text-[#64748b] hover:text-white">✕</button>
            </div>
            <div className="mb-6 p-4 bg-[#1e2235] rounded-xl border border-[#2d3352]">
              <div className="text-xs font-bold text-[#64748b] uppercase mb-2">Student Notes</div>
              <p className="text-sm text-[#e2e8f0] italic">"{showGradeModal.notes || 'No notes provided.'}"</p>
              <div className="mt-4">
                <a href={showGradeModal.fileUrl} target="_blank" rel="noreferrer" className="text-[#ff00ff] text-xs font-bold hover:underline flex items-center gap-1">
                  <Eye size={14} /> View Submitted Work
                </a>
              </div>
            </div>
            <form onSubmit={handleGrade} className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <label className="text-[#94a3b8]">Final Score</label>
                  <span className="text-[#ff00ff]">{grade}/100</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  className="w-full accent-[#ff00ff]"
                  value={grade}
                  onChange={e => setGrade(parseInt(e.target.value))}
                />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#ff00ff] to-[#7000ff] hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#ff00ff]/20">
                {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Submit Grade →'}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {showAssignPeerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#181c27] border border-[#2d3352] rounded-3xl p-8 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Assign Peer Reviewer</h2>
              <button onClick={() => setShowAssignPeerModal(null)} className="text-[#64748b] hover:text-white">✕</button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-[#94a3b8]">Select a student to review <strong>{showAssignPeerModal.taskTitle}</strong></p>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {db.users
                  .filter((u: any) => u.role === 'student' && u.domain === user.domain && u.id !== showAssignPeerModal.studentId)
                  .map((student: any) => (
                    <button
                      key={student.id}
                      onClick={() => handleAssignPeer(student.id)}
                      className="w-full text-left p-3 rounded-xl bg-[#1e2235] hover:bg-[#2d3352] border border-[#2d3352] transition-colors flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff00ff] to-[#7000ff] flex items-center justify-center text-xs font-bold">
                          {student.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-sm">{student.name}</div>
                          <div className="text-[10px] text-[#64748b]">@{student.username}</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-[#64748b]" />
                    </button>
                  ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Reviews({ user }: { user: User }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewModal, setShowReviewModal] = useState<Review | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<Review | null>(null);
  const [reviewData, setReviewData] = useState({
    quality: 5,
    creativity: 5,
    completion: 5,
    presentation: 5,
    feedback: ''
  });
  const [loading, setLoading] = useState(false);

  const isMentor = user.role === 'mentor';

  const fetchReviews = () => {
    const db = getDB();
    const filtered = isMentor 
      ? db.reviews.filter((r: any) => {
          const sub = db.submissions.find((s: any) => s.id === r.submissionId);
          return sub && sub.domain === user.domain;
        })
      : db.reviews.filter((r: any) => r.assignedTo === user.id || r.reviewerId === user.id);
    setReviews(filtered);
  };

  useEffect(() => {
    fetchReviews();
  }, [user.id, user.domain, isMentor]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReviewModal) return;
    setLoading(true);
    
    const db = getDB();
    const reviewIdx = db.reviews.findIndex((r: any) => r.id === showReviewModal.id);
    if (reviewIdx !== -1) {
      db.reviews[reviewIdx] = {
        ...db.reviews[reviewIdx],
        status: 'completed',
        ratings: { ...reviewData },
        feedback: reviewData.feedback
      };
      
      const subId = showReviewModal.submissionId;
      const subReviews = db.reviews.filter((r: any) => r.submissionId === subId);
      const completedReviews = subReviews.filter((r: any) => r.status === 'completed');
      
      if (completedReviews.length === subReviews.length) {
        const subIdx = db.submissions.findIndex((s: any) => s.id === subId);
        if (subIdx !== -1) {
          const avgPeer = completedReviews.reduce((acc: number, r: any) => {
            const rAvg = (r.ratings.quality + r.ratings.creativity + r.ratings.completion + r.ratings.presentation) / 4;
            return acc + rAvg;
          }, 0) / completedReviews.length;
          
          db.submissions[subIdx].status = 'reviewed';
          db.submissions[subIdx].score = Math.round(avgPeer * 10);
          db.submissions[subIdx].peerScore = Math.round(avgPeer * 10);
          
          const studentId = db.submissions[subIdx].studentId;
          const userIdx = db.users.findIndex((u: any) => u.id === studentId);
          if (userIdx !== -1) {
            db.users[userIdx].score += db.submissions[subIdx].score;
            db.users[userIdx].tasks_completed += 1;
          }
        }
      }
      
      saveDB(db);
      fetchReviews();
      setShowReviewModal(null);
      setReviewData({ quality: 5, creativity: 5, completion: 5, presentation: 5, feedback: '' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6 mb-4">
        <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest">
          {isMentor ? `Peer Review Oversight (${user.domain})` : 'My Peer Reviews'}
        </h3>
      </div>
      {reviews.length === 0 ? (
        <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-20 text-center text-[#64748b]">
          <Star size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-bold text-[#e2e8f0] mb-2">No reviews found</h3>
          <p className="text-sm">{isMentor ? 'No peer reviews have been assigned in your domain yet.' : 'You\'ll be assigned peer reviews when others submit their work.'}</p>
        </div>
      ) : (
        reviews.map((r: any) => {
          const db = getDB();
          const reviewer = db.users.find((u: any) => u.id === (r.assignedTo || r.reviewerId));
          const submission = db.submissions.find((s: any) => s.id === r.submissionId);
          const student = db.users.find((u: any) => u.id === submission?.studentId);

          return (
            <div key={r.id} className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6 flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-[#ff00ff]/10 flex items-center justify-center text-xl shrink-0">
                {isMentor ? '👁️' : '👤'}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-sm font-bold">{r.taskTitle}</h3>
                  <span className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase",
                    r.status === 'completed' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                  )}>
                    {r.status}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748b]">
                  {isMentor 
                    ? `Reviewer: ${reviewer?.name || 'Anonymous'} • For: ${student?.name || 'Unknown'}`
                    : `Peer: Anonymous • Assigned: ${r.date}`
                  }
                </div>
              </div>
              {!isMentor && (
                <button 
                  onClick={() => setShowReviewModal(r)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                    r.status === 'pending' ? "bg-[#ff00ff] text-white" : "bg-[#2d3352] text-[#64748b]"
                  )}
                >
                  {r.status === 'pending' ? 'Write Review' : 'Submitted'}
                </button>
              )}
              {isMentor && r.status === 'completed' && (
                <div className="text-right">
                  <div className="text-[10px] font-bold text-emerald-400">Score: {((r.ratings.quality + r.ratings.creativity + r.ratings.completion + r.ratings.presentation) / 4).toFixed(1)}/10</div>
                </div>
              )}
              {isMentor && r.status === 'pending' && (
                <button 
                  onClick={() => setShowAssignModal(r)}
                  className="bg-[#ff00ff]/10 hover:bg-[#ff00ff]/20 text-[#ff00ff] px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-[#ff00ff]/20"
                >
                  Re-assign
                </button>
              )}
            </div>
          );
        })
      )}

      {showAssignModal && isMentor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#181c27] border border-[#2d3352] rounded-3xl p-8 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Assign Reviewer</h2>
              <button onClick={() => setShowAssignModal(null)} className="text-[#64748b] hover:text-white">✕</button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-[#94a3b8]">Select a student to review this task: <strong>{showAssignModal.taskTitle}</strong></p>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {getDB().users
                  .filter((u: any) => u.role === 'student' && u.domain === user.domain && u.id !== (getDB().submissions.find((s: any) => s.id === showAssignModal.submissionId)?.studentId))
                  .map((student: any) => (
                    <button
                      key={student.id}
                      onClick={() => {
                        const db = getDB();
                        const idx = db.reviews.findIndex((rev: any) => rev.id === showAssignModal.id);
                        if (idx !== -1) {
                          db.reviews[idx].assignedTo = student.id;
                          saveDB(db);
                          fetchReviews();
                          setShowAssignModal(null);
                        }
                      }}
                      className="w-full text-left p-3 rounded-xl bg-[#1e2235] hover:bg-[#2d3352] border border-[#2d3352] transition-colors flex justify-between items-center"
                    >
                      <span className="font-bold">{student.name}</span>
                      <span className="text-[10px] text-[#64748b]">@{student.username}</span>
                    </button>
                  ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showReviewModal && !isMentor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#181c27] border border-[#2d3352] rounded-3xl p-8 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Peer Review: {showReviewModal.taskTitle}</h2>
              <button onClick={() => setShowReviewModal(null)} className="text-[#64748b] hover:text-white">✕</button>
            </div>

            {/* Work Preview Section */}
            {(() => {
              const sub = getDB().submissions.find((s: any) => s.id === showReviewModal.submissionId);
              if (!sub) return null;
              return (
                <div className="mb-6 p-4 bg-[#1e2235] rounded-xl border border-[#2d3352]">
                  <div className="text-xs font-bold text-[#64748b] uppercase mb-2">Submitted Work</div>
                  <div className="space-y-3">
                    {sub.notes && (
                      <p className="text-sm text-[#e2e8f0] italic">"{sub.notes}"</p>
                    )}
                    <a 
                      href={sub.fileUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff00ff]/10 hover:bg-[#ff00ff]/20 text-[#ff00ff] rounded-lg text-xs font-bold transition-all border border-[#ff00ff]/20"
                    >
                      <Eye size={14} /> View Submission Link
                    </a>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleSubmitReview} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {[
                  { key: 'quality', label: 'Quality' },
                  { key: 'creativity', label: 'Creativity' },
                  { key: 'completion', label: 'Completion' },
                  { key: 'presentation', label: 'Presentation' }
                ].map(rating => (
                  <div key={rating.key} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <label className="text-[#94a3b8]">{rating.label}</label>
                      <span className="text-[#ff00ff]">{(reviewData as any)[rating.key]}/10</span>
                    </div>
                    <input 
                      type="range" min="1" max="10" 
                      className="w-full accent-[#ff00ff]"
                      value={(reviewData as any)[rating.key]}
                      onChange={e => setReviewData({...reviewData, [rating.key]: parseInt(e.target.value)})}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#94a3b8]">Feedback</label>
                <textarea 
                  required
                  className="w-full bg-[#1e2235] border border-[#2d3352] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff] min-h-[100px]"
                  placeholder="Provide constructive feedback..."
                  value={reviewData.feedback}
                  onChange={e => setReviewData({...reviewData, feedback: e.target.value})}
                />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#ff00ff] to-[#7000ff] hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#ff00ff]/20">
                {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Submit Review →'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Leaderboard({ user }: { user: User }) {
  const [students, setStudents] = useState<User[]>([]);

  useEffect(() => {
    const fetchLeaderboard = () => {
      const db = getDB();
      const sorted = db.users
        .filter((u: any) => u.role === 'student' && u.domain === user.domain)
        .sort((a: any, b: any) => b.score - a.score);
      setStudents(sorted);
    };
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, [user.domain]);

  return (
    <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-[#64748b] border-b border-[#2d3352] bg-[#1e2235]/50">
            <th className="p-4 font-bold uppercase text-[10px] tracking-wider w-16 text-center">#</th>
            <th className="p-4 font-bold uppercase text-[10px] tracking-wider">Student</th>
            <th className="p-4 font-bold uppercase text-[10px] tracking-wider">Domain</th>
            <th className="p-4 font-bold uppercase text-[10px] tracking-wider text-center">Tasks</th>
            <th className="p-4 font-bold uppercase text-[10px] tracking-wider text-right">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2d3352]/50">
          {students.length === 0 ? (
            <tr><td colSpan={5} className="p-12 text-center text-[#64748b]">No students in this domain yet.</td></tr>
          ) : (
            students.map((s: any, i: number) => (
              <tr key={s.id} className={cn("hover:bg-white/5 transition-colors", s.id === user.id && "bg-[#ff00ff]/5")}>
                <td className="p-4 text-center font-bold text-[#64748b]">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2d3352] flex items-center justify-center text-[10px] font-bold">
                      {s.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className={cn("font-semibold", s.id === user.id && "text-[#a78bfa]")}>
                      {s.name} {s.id === user.id && '(You)'}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2d3352] text-[#94a3b8] font-bold uppercase">
                    {s.domain}
                  </span>
                </td>
                <td className="p-4 text-center">{s.tasks_completed}</td>
                <td className="p-4 text-right font-black text-[#a78bfa]">{s.score}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Chat({ user }: { user: User }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    socket = io();
    socket.emit('join_room', user.domain);

    socket.on('receive_message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user.domain]);

  const handleSend = () => {
    if (!input.trim()) return;
    const msgData = {
      name: user.name,
      avatar: user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      color: '#ff00ff',
      text: input,
      isMe: false, // Will be set to true for the sender
      domain: user.domain
    };
    socket.emit('send_message', msgData);
    setMessages(prev => [...prev, { ...msgData, id: Date.now().toString(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isMe: true }]);
    setInput('');
  };

  return (
    <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl flex flex-col h-[calc(100vh-200px)]">
      <div className="p-4 border-b border-[#2d3352] flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-widest text-[#64748b]">#{user.domain.toLowerCase().replace(' ', '-')}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-[#64748b] opacity-50">
            <MessageSquare size={48} className="mb-4" />
            <p className="text-sm">Start the conversation in {user.domain}!</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={cn("flex gap-3 max-w-[80%]", m.isMe ? "ml-auto flex-row-reverse" : "")}>
            <div className="w-8 h-8 rounded-full bg-[#1e2235] border border-[#2d3352] flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
              {m.avatar}
            </div>
            <div>
              {!m.isMe && <div className="text-[10px] text-[#64748b] mb-1 ml-1">{m.name} • {m.time}</div>}
              <div className={cn(
                "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                m.isMe ? "bg-gradient-to-r from-[#ff00ff] to-[#7000ff] text-white rounded-tr-none" : "bg-[#1e2235] border border-[#2d3352] text-[#e2e8f0] rounded-tl-none"
              )}>
                {m.text}
              </div>
              {m.isMe && <div className="text-[9px] text-[#64748b] mt-1 text-right">{m.time}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-[#2d3352] flex gap-2">
        <input 
          className="flex-1 bg-[#1e2235] border border-[#2d3352] rounded-xl px-4 py-2 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff]"
          placeholder={`Message #${user.domain.toLowerCase().replace(' ', '-')}...`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} className="bg-gradient-to-r from-[#ff00ff] to-[#7000ff] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#ff00ff]/20">
          Send
        </button>
      </div>
    </div>
  );
}

function ResumeAnalyzer({ user }: { user: User }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const text = await extractTextFromPDF(file);
      const res = await analyzeResume(text, user.domain);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
          <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-4">Upload Resume (PDF)</h3>
            <div 
              className={cn(
                "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer",
                file ? "border-emerald-500/50 bg-emerald-500/5" : "border-[#2d3352] hover:border-[#ff00ff]/50"
              )}
              onClick={() => document.getElementById('resume-upload')?.click()}
            >
              <input 
                id="resume-upload"
                type="file" 
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload size={48} className={cn("mx-auto mb-4", file ? "text-emerald-400" : "text-[#64748b]")} />
              <p className="text-sm font-medium text-white">{file ? file.name : "Click to upload your resume PDF"}</p>
              <p className="text-xs text-[#64748b] mt-2">Max size: 10MB</p>
            </div>
            <button 
              onClick={handleAnalyze}
              disabled={loading || !file}
              className="w-full bg-gradient-to-r from-[#ff00ff] to-[#7000ff] hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#ff00ff]/20"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
              {loading ? 'Analyzing...' : 'Analyze Resume →'}
            </button>
        </div>
      </div>

      <div className="space-y-6">
        {!result ? (
          <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-12 text-center text-[#64748b]">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm">Paste your resume text to get a detailed AI analysis and learning roadmap.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-1">Resume Score</h3>
                  <p className="text-[10px] text-[#64748b]">vs. {user.domain} requirements</p>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "text-4xl font-black",
                    result.resumeScore >= 70 ? "text-emerald-400" : result.resumeScore >= 50 ? "text-amber-400" : "text-rose-400"
                  )}>
                    {result.resumeScore}<span className="text-lg opacity-50">/100</span>
                  </div>
                </div>
              </div>
              <div className="h-2 bg-[#1e2235] rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-1000",
                    result.resumeScore >= 70 ? "bg-emerald-400" : result.resumeScore >= 50 ? "bg-amber-400" : "bg-rose-400"
                  )}
                  style={{ width: `${result.resumeScore}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CheckCircle2 size={14} /> Advantages
                </h3>
                <ul className="space-y-2">
                  {result.advantages.map((adv: string, i: number) => (
                    <li key={i} className="text-[11px] text-[#94a3b8] flex gap-2">
                      <span className="text-emerald-400">•</span> {adv}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertCircle size={14} /> Disadvantages
                </h3>
                <ul className="space-y-2">
                  {result.disadvantages.map((dis: string, i: number) => (
                    <li key={i} className="text-[11px] text-[#94a3b8] flex gap-2">
                      <span className="text-rose-400">•</span> {dis}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
              <h3 className="text-xs font-bold text-[#ff00ff] uppercase tracking-widest mb-4">AI Suggestions</h3>
              <ul className="space-y-3">
                {result.suggestions.map((s: string, i: number) => (
                  <li key={i} className="flex gap-3 text-[11px] text-[#94a3b8] leading-relaxed">
                    <span className="text-[#ff00ff] font-bold">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
              <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-4 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" /> Found Skills
              </h3>
              <div className="space-y-3">
                {result.found.map((s: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="capitalize">{s.name}</span>
                      <span className="text-[#a78bfa]">{s.pct}%</span>
                    </div>
                    <div className="h-1 bg-[#1e2235] rounded-full overflow-hidden">
                      <div className="h-full bg-[#ff00ff]" style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
              <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-400" /> Missing Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.missing.map((s: string, i: number) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-rose-400/10 border border-rose-400/20 text-rose-400 text-[10px] font-bold capitalize">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
              <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-4">Learning Roadmap</h3>
              <div className="space-y-4">
                {result.roadmap.map((step: any, i: number) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#ff00ff]/10 border border-[#ff00ff]/20 flex items-center justify-center text-[10px] font-bold text-[#ff00ff] shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold mb-1">{step.week}: {step.topic}</div>
                      <p className="text-[11px] text-[#64748b] leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function JobMatcher({ user }: { user: User }) {
  const [jd, setJd] = useState('');
  const [resume, setResume] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleMatch = async () => {
    if (!jd.trim() || !resume.trim()) return;
    setLoading(true);
    try {
      const res = await matchJob(jd, resume);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
          <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-4">Job Description</h3>
          <textarea 
            className="w-full bg-[#1e2235] border border-[#2d3352] rounded-xl px-4 py-4 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff] min-h-[200px] resize-none"
            placeholder="Paste the job description here..."
            value={jd}
            onChange={e => setJd(e.target.value)}
          />
        </div>
        <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
          <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-4">Your Skills / Resume</h3>
          <textarea 
            className="w-full bg-[#1e2235] border border-[#2d3352] rounded-xl px-4 py-4 text-sm text-white placeholder:text-[#64748b] outline-none focus:border-[#ff00ff] min-h-[150px] resize-none"
            placeholder="Paste your skills or resume summary..."
            value={resume}
            onChange={e => setResume(e.target.value)}
          />
          <button 
            onClick={handleMatch}
            disabled={loading || !jd.trim() || !resume.trim()}
            className="w-full bg-gradient-to-r from-[#ff00ff] to-[#7000ff] hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#ff00ff]/20"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            {loading ? 'Analyzing...' : 'Match Job →'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {!result ? (
          <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-12 text-center text-[#64748b]">
            <Briefcase size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm">Analyze how well your skills match a specific job description.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-8 text-center">
              <div className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-2">Match Score</div>
              <div className={cn(
                "text-6xl font-black mb-4",
                result.pct >= 70 ? "text-emerald-400" : result.pct >= 50 ? "text-amber-400" : "text-rose-400"
              )}>
                {result.pct}%
              </div>
              <div className="h-3 bg-[#1e2235] rounded-full overflow-hidden mb-6">
                <div 
                  className={cn(
                    "h-full transition-all duration-1000",
                    result.pct >= 70 ? "bg-emerald-400" : result.pct >= 50 ? "bg-amber-400" : "bg-rose-400"
                  )}
                  style={{ width: `${result.pct}%` }}
                />
              </div>
              <div className={cn(
                "inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider",
                result.pct >= 70 ? "bg-emerald-500/10 text-emerald-400" : result.pct >= 50 ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
              )}>
                {result.pct >= 70 ? 'Strong Match' : result.pct >= 50 ? 'Potential Match' : 'Low Match'}
              </div>
            </div>

            <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
              <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-4">Matching Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {result.matched.map((s: string, i: number) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-[#ff00ff]/10 border border-[#ff00ff]/20 text-[#ff00ff] text-[10px] font-bold capitalize">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
              <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-4">Missing Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {result.missing.map((s: string, i: number) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-rose-400/10 border border-rose-400/20 text-rose-400 text-[10px] font-bold capitalize">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[#181c27] border border-[#2d3352] rounded-2xl p-6">
              <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-4">AI Suggestions</h3>
              <ul className="space-y-3">
                {result.suggestions.map((s: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm text-[#94a3b8] leading-relaxed">
                    <span className="text-[#a78bfa] font-bold">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}


