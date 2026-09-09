import { ArrowRight, AlertTriangle, Lightbulb, Activity, Layers, Bot, ChevronDown, Clock, TrendingDown, Code, Cpu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend, PieChart, Pie, LineChart, Line } from 'recharts';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Float, TorusKnot, Box, Sphere } from '@react-three/drei';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../contexts/ThemeContext';
import { Hero3DScene } from './Hero3DScene';
import { TiltCard } from './TiltCard';

const timeData = [
  { name: 'Traditional EDA', time: 100, actual: 'Baseline (100%)', fill: '#ff3b3b' },
  { name: 'AI-Driven Flow', time: 60, actual: '40% Reduction', fill: '#00ff87' }
];

const defectReductionData = [
  { stage: 'Logic Bugs', Baseline: 100, 'AI Flow': 40 },
  { stage: 'Timing', Baseline: 100, 'AI Flow': 30 },
  { stage: 'Power', Baseline: 100, 'AI Flow': 50 },
];

const costData = [
  { month: 'Q1', Traditional: 100, 'AI Flow': 30 },
  { month: 'Q2', Traditional: 250, 'AI Flow': 75 },
  { month: 'Q3', Traditional: 450, 'AI Flow': 140 },
  { month: 'Q4', Traditional: 700, 'AI Flow': 200 },
];

const docParsingData = [
  { name: 'Manual Spec Parsing', value: 80, fill: '#ff3b3b' },
  { name: 'Actual Engineering', value: 20, fill: '#00ff87' }
];

const manualDefectData = [
  { step: 'Init', errors: 2 },
  { step: 'Clocks', errors: 15 },
  { step: 'Memory', errors: 60 },
  { step: 'Interrupts', errors: 180 },
];

const reworkCostData = [
  { phase: 'Design', cost: 10 },
  { phase: 'Alpha', cost: 50 },
  { phase: 'Beta', cost: 150 },
  { phase: 'HIL Sync', cost: 600 },
];

const Custom3DBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  const depth = 8;
  return (
    <g>
      {/* Front Face */}
      <path d={`M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z`} fill={fill} />
      {/* Top Face */}
      <path d={`M${x},${y} L${x + depth},${y - depth} L${x + width + depth},${y - depth} L${x + width},${y} Z`} fill={fill} opacity={0.7} />
      {/* Right Face */}
      <path d={`M${x + width},${y} L${x + width + depth},${y - depth} L${x + width + depth},${y + height - depth} L${x + width},${y + height} Z`} fill={fill} opacity={0.4} />
    </g>
  );
};

function Mini3DIcon({ color, type }: { color: string, type: 'knot' | 'box' | 'sphere' }) {
  return (
    <div className="w-16 h-16 shrink-0 relative overflow-visible pointer-events-none">
      <div className="absolute inset-0 bg-obsidian-200 border border-border-grid rounded-xl -z-10" />
      <div className="absolute -inset-4 z-10">
        <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[2, 2, 2]} />
          <Float speed={4} rotationIntensity={3} floatIntensity={2}>
            {type === 'knot' && (
              <TorusKnot args={[0.7, 0.2, 64, 16]}>
                <meshStandardMaterial color={color} wireframe />
              </TorusKnot>
            )}
            {type === 'box' && (
              <Box args={[1.2, 1.2, 1.2]}>
                <meshStandardMaterial color={color} wireframe />
              </Box>
            )}
            {type === 'sphere' && (
              <Sphere args={[0.9, 16, 16]}>
                <meshStandardMaterial color={color} wireframe />
              </Sphere>
            )}
          </Float>
        </Canvas>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { theme } = useTheme();
  
  const [activeNodeInfo, setActiveNodeInfo] = useState<{title: string, desc: string} | null>(null);
  const [activeSection, setActiveSection] = useState('Overview');

  const nodeDetails = {
    ingestion: { title: "1. MULTIMODAL INGESTION", desc: "DeepReader vision models instantly extract hardware metadata from schematic PDFs, images, and text files." },
    ai: { title: "2 & 4. AI ENGINES", desc: "DeepReader parses unstructured data into a validated schema, while the specialized LLM synthesizes conflict-free code." },
    json: { title: "3. JSON SOURCE OF TRUTH", desc: "A validated, structured JSON schema acts as the single reliable input for downstream code generation." },
    flowA: { title: "FLOW A: BARE METAL", desc: "Generates low-level C firmware and peripheral initialization code tailored for bare metal target platforms." },
    flowB: { title: "FLOW B: LINUX", desc: "Synthesizes robust Linux Device Trees (.dts) and Board Support Packages for embedded Linux targets." },
    repair: { title: "6. AUTO-REPAIR LOOP", desc: "An intelligent feedback mechanism that catches compilation bugs and routes them back to the LLM for dynamic patching." }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.id === 'problem') setActiveSection('Overview');
            if (entry.target.id === 'solution') setActiveSection('TCS Approach');
            if (entry.target.id === 'demos') setActiveSection('Demos');
            if (entry.target.id === 'conclusion') setActiveSection('Conclusion');
          }
        });
      },
      { threshold: 0.3 }
    );

    const ids = ['problem', 'solution', 'demos', 'conclusion'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      // scroll logic can go here if needed
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-obsidian text-text-primary overflow-x-hidden selection:bg-neon-cyan/30 relative">
      {/* Global Background Graphics */}
      <div className="fixed inset-0 pointer-events-none z-0">
         {/* Adaptive Dot Pattern */}
         <div className="absolute inset-0 bg-[radial-gradient(#d4d4d8_1.5px,transparent_1.5px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:32px_32px] opacity-100" />
         
         {/* Ambient Lighting */}
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-neon-cyan/20 dark:bg-neon-cyan/5 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-neon-emerald/20 dark:bg-neon-emerald/5 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* Navigation / Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-obsidian/80 backdrop-blur-md border-b border-border-grid">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            {/* Official Uploaded Logo */}
            <img 
              src={theme === 'dark' ? "/tcs-logo-dark.png" : "/tcs-logo-light.png"} 
              alt="TCS Logo" 
              className="h-10 object-contain rounded-sm"
            />
          </div>
          
          {/* Centered Pill Navigation */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center p-[4px] bg-[#2a2a36]/50 dark:bg-[#1a1a24]/80 backdrop-blur-md rounded-full border border-border-grid shadow-inner">
            {[
              { id: 'problem', label: 'Overview' },
              { id: 'solution', label: 'TCS Approach' },
              { id: 'demos', label: 'Demos' },
              { id: 'conclusion', label: 'Conclusion' }
            ].map((item) => (
              <a 
                key={item.id}
                href={`#${item.id}`} 
                className={`relative px-6 py-2 rounded-full text-sm font-semibold transition-colors duration-300 z-10 ${
                  activeSection === item.label 
                    ? 'text-text-primary' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5 dark:hover:bg-white/5'
                }`}
              >
                {activeSection === item.label && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-[#404052] dark:bg-[#333344] rounded-full -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-6">
            <ThemeToggle />
            <a
              href="/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 px-6 py-2.5 rounded-full font-medium text-sm transition-all bg-gradient-to-r from-neon-cyan to-neon-emerald text-obsidian hover:shadow-neon-cyan hover:scale-105"
            >
              Launch Demo
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-20 relative z-10">
        {/* Section 1: Hero & Challenges */}
        <section id="problem" className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
          {/* 3D WebGL Background */}
          <Hero3DScene />
          
          {/* Hero Glows (Fallback ambient lighting) */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-status-error/10 dark:bg-status-error/20 rounded-full blur-[120px] pointer-events-none animate-blob" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-[120px] pointer-events-none animate-blob [animation-delay:2s]" />

          <motion.div 
            initial={{ opacity: 0, z: -100, scale: 0.9 }}
            animate={{ opacity: 1, z: 0, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative z-10 max-w-4xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-status-error/10 border border-status-error/20 text-status-error text-sm font-medium mb-8 animate-slide-up opacity-0">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
              The Industry Bottleneck
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight animate-slide-up opacity-0 [animation-delay:200ms]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-text-primary to-text-muted inline-block animate-float">
                GenAI Pipeline for Bare-Metal & Linux BSPs
              </span>
            </h1>

            <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-16 leading-relaxed animate-slide-up opacity-0 [animation-delay:400ms]">
              Manual transcription of pin mappings, register addresses, and peripheral blocks from static PDFs takes months, creating massive delays and introducing critical human errors.
            </p>

            {/* The Broken Workflow (Animated Bento Box) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 relative z-10 text-left">
              
              {/* Card 1: Time to Market (Slow Progress/Clock) */}
              <TiltCard className="bg-obsidian-100/60 backdrop-blur-md rounded-3xl border border-border-grid p-8 relative group hover:border-status-warning/40 transition-colors h-full">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-status-warning/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-status-warning/10 transition-all duration-700 pointer-events-none" />
                 
                 {/* Visual Area */}
                 <div className="h-48 w-full mb-4 drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={docParsingData}
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                          isAnimationActive={true}
                          animationBegin={800}
                          animationDuration={2000}
                        >
                          {docParsingData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181d', borderColor: '#2a2a36', borderRadius: '8px', color: '#e4e4e7' }}
                          itemStyle={{ color: '#ffffff' }}
                          formatter={(value: any) => [`${value}%`, 'Time Spent']}
                        />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                 </div>

                 <h3 className="text-xl font-bold text-text-primary mb-2">Unstructured Data Fragmentation</h3>
                 <p className="text-text-secondary text-xs leading-relaxed">80% of R&D cycles are squandered scraping I/O pin multiplexing logic from 5,000-page PDFs.</p>
              </TiltCard>

              {/* Card 2: Human Error (The glitching grid dot) */}
              <TiltCard className="bg-obsidian-100/60 backdrop-blur-md rounded-3xl border border-border-grid p-8 relative group hover:border-status-error/40 transition-colors h-full">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-status-error/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-status-error/10 transition-all duration-700 pointer-events-none" />
                 
                 {/* Visual Area */}
                 <div className="h-48 w-full mb-4 drop-shadow-[0_12px_12px_rgba(255,59,59,0.4)]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={manualDefectData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="step" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181d', borderColor: '#2a2a36', borderRadius: '8px', color: '#e4e4e7' }}
                          itemStyle={{ color: '#ff3b3b' }}
                          formatter={(value: any) => [`${value}`, 'Cumulative Errors']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="errors" 
                          stroke="#ff3b3b" 
                          strokeWidth={5} 
                          dot={{ fill: '#ff3b3b', r: 5, strokeWidth: 2, stroke: '#18181d' }} 
                          activeDot={{ r: 7 }} 
                          isAnimationActive={true}
                          animationBegin={1000}
                          animationDuration={2000}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                 </div>

                 <h3 className="text-xl font-bold text-text-primary mb-2">Vulnerable Manual Transcription</h3>
                 <p className="text-text-secondary text-xs leading-relaxed">Hand-coding headers inevitably introduces hex typos that compound across peripheral configuration.</p>
              </TiltCard>

              {/* Card 3: Late Stage Discovery (The crumbling architecture) */}
              <TiltCard className="bg-obsidian-100/60 backdrop-blur-md rounded-3xl border border-border-grid p-8 relative group hover:border-neon-amber/40 transition-colors h-full">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-neon-amber/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-neon-amber/10 transition-all duration-700 pointer-events-none" />
                 
                 {/* Visual Area */}
                 <div className="h-48 w-full mb-4 drop-shadow-[0_12px_12px_rgba(255,191,0,0.3)]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={reworkCostData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCostRework" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffbf00" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#ffbf00" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="phase" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181d', borderColor: '#2a2a36', borderRadius: '8px', color: '#e4e4e7' }}
                          itemStyle={{ color: '#ffbf00' }}
                          formatter={(value: any) => [`$${value}k`, 'Rework Cost']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="cost" 
                          stroke="#ffbf00" 
                          fillOpacity={1} 
                          fill="url(#colorCostRework)" 
                          strokeWidth={4} 
                          isAnimationActive={true}
                          animationBegin={1200}
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                 </div>

                 <h3 className="text-xl font-bold text-text-primary mb-2">Asynchronous Evolution</h3>
                 <p className="text-text-secondary text-xs leading-relaxed">Phantom conflicts trigger massive integration rework costs during final hardware-in-the-loop (HIL) testing.</p>
              </TiltCard>

            </div>
          </motion.div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="w-6 h-6 text-text-muted" />
          </div>
        </section>

        {/* Section 2: TCS AI Solution */}
        <section id="solution" className="relative min-h-screen flex items-center py-24 px-6 bg-obsidian-50 border-t border-border-grid overflow-hidden">
          {/* Engineering Blueprint Background for Section 2 */}
          <div className="absolute inset-0 pointer-events-none z-0">
            {/* Major Grid Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080801a_1px,transparent_1px),linear-gradient(to_bottom,#8080801a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:40px_40px]" />
            {/* Minor Grid Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:10px_10px]" />
            {/* Soft fade out mask so it blends with the section */}
            <div className="absolute inset-0 bg-obsidian-50 [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_100%)] opacity-80" />
          </div>

          <div className="max-w-7xl mx-auto w-full relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              <TiltCard className="order-2 lg:order-1 relative z-20 h-full flex flex-col bg-obsidian border border-border-grid rounded-3xl overflow-hidden shadow-2xl">
                <div className="relative w-full aspect-square md:aspect-[4/3] lg:aspect-square border-b border-border-grid shrink-0">
                  {/* Unique Professional Animation: AI Circuit Data Flow */}
                  <div className="relative aspect-square max-w-md mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/20 to-neon-emerald/20 rounded-full blur-3xl animate-pulse" />
                    
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InNtYWxsR3JpZCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDIwIDAgTCAwIDAgTCAwIDIwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjc21hbGxHcmlkKSIvPjwvc3ZnPg==')]" />

                    {/* AI Engine Center Node */}
                    <div 
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 cursor-pointer hover:scale-105 transition-transform duration-300 group"
                      onClick={() => setActiveNodeInfo(activeNodeInfo === nodeDetails.ai ? null : nodeDetails.ai)}
                    >
                      <div className="w-20 h-20 bg-obsidian-200 border-2 border-neon-cyan rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(0,255,255,0.2)] relative overflow-hidden group-hover:border-neon-cyan/80 group-hover:shadow-[0_0_40px_rgba(0,255,255,0.4)]">
                        <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/10 to-transparent"></div>
                        <Bot className="w-10 h-10 text-neon-cyan animate-pulse group-hover:scale-110 transition-transform" />
                      </div>
                      <span className="mt-4 font-mono text-xs text-neon-cyan font-bold tracking-widest bg-obsidian-200/80 px-3 py-1 rounded-full border border-neon-cyan/20">
                        2 & 4. DeepReader + LLM
                      </span>
                    </div>

                    {/* SVG Circuit Traces & Data Particles */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 400">
                      <defs>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Traces */}
                      <path d="M 130 200 L 200 200" fill="none" stroke="rgba(0,255,255,0.15)" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M 200 200 L 280 100 L 340 100" fill="none" stroke="rgba(255,191,0,0.15)" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M 200 200 L 280 300 L 340 300" fill="none" stroke="rgba(0,255,135,0.15)" strokeWidth="2" strokeLinejoin="round" />
                      {/* JSON Loop Trace (DeepReader -> JSON -> LLM) */}
                      <path d="M 190 200 L 190 65 L 210 65 L 210 200" fill="none" stroke="rgba(168,85,247,0.4)" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 4" />
                      
                      {/* Auto-Repair Trace A (Feedback Loop from Flow A) */}
                      <path d="M 340 100 L 360 100 L 360 345 L 200 345 L 200 200" fill="none" stroke="rgba(255,59,59,0.15)" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 4" />
                      
                      {/* Auto-Repair Trace B (Feedback Loop from Flow B) */}
                      <path d="M 340 300 L 360 300 L 360 345 L 200 345 L 200 200" fill="none" stroke="rgba(255,59,59,0.15)" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 4" />

                      {/* Animated Data Packets */}
                      {/* Ingestion Packet */}
                      <circle r="4" fill="#00ffff" filter="url(#glow)">
                        <animateMotion dur="1.5s" repeatCount="indefinite" path="M 130 200 L 200 200" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.8;1" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                      <circle r="4" fill="#00ffff" filter="url(#glow)">
                        <animateMotion dur="1.5s" repeatCount="indefinite" path="M 130 200 L 200 200" begin="0.75s" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.8;1" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
                      </circle>
                      
                      {/* JSON Loop Packet (Feeds LLM) */}
                      <circle r="4" fill="#a855f7" filter="url(#glow)">
                        <animateMotion dur="2.5s" repeatCount="indefinite" path="M 190 200 L 190 65 L 210 65 L 210 200" begin="1.2s" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.2s" />
                      </circle>

                      {/* Flow A (Bare Metal) Packet */}
                      <circle r="4" fill="#ffbf00" filter="url(#glow)">
                        <animateMotion dur="2s" repeatCount="indefinite" path="M 200 200 L 280 100 L 340 100" begin="1s" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.8;1" dur="2s" repeatCount="indefinite" begin="1s" />
                      </circle>

                      {/* Flow B (Linux) Packet */}
                      <circle r="4" fill="#00ff87" filter="url(#glow)">
                        <animateMotion dur="2s" repeatCount="indefinite" path="M 200 200 L 280 300 L 340 300" begin="1.5s" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.8;1" dur="2s" repeatCount="indefinite" begin="1.5s" />
                      </circle>

                      {/* Auto-Repair Feedback Packet from Flow A */}
                      <circle r="4" fill="#ff3b3b" filter="url(#glow)">
                        <animateMotion dur="3s" repeatCount="indefinite" path="M 340 100 L 360 100 L 360 345 L 200 345 L 200 200" begin="2s" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="3s" repeatCount="indefinite" begin="2s" />
                      </circle>
                      
                      {/* Auto-Repair Feedback Packet from Flow B */}
                      <circle r="4" fill="#ff3b3b" filter="url(#glow)">
                        <animateMotion dur="2.5s" repeatCount="indefinite" path="M 340 300 L 360 300 L 360 345 L 200 345 L 200 200" begin="2.5s" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="2.5s" />
                      </circle>
                    </svg>

                    {/* Floating Data Nodes */}
                    <div 
                      className="absolute top-[170px] left-[15px] bg-obsidian-200 border border-border-grid px-3 py-2 rounded-lg text-[10px] font-mono text-text-secondary shadow-lg flex flex-col z-10 w-[115px] cursor-pointer hover:border-neon-cyan hover:scale-105 transition-all duration-300"
                      onClick={() => setActiveNodeInfo(activeNodeInfo === nodeDetails.ingestion ? null : nodeDetails.ingestion)}
                    >
                      <span className="text-neon-cyan font-bold mb-1 border-b border-border-grid pb-1 text-center pointer-events-none">1. INGESTION</span>
                      <span className="text-center mt-0.5 whitespace-normal leading-tight pointer-events-none">Schematic (PDF & Image)</span>
                    </div>

                    <div 
                      className="absolute top-[30px] left-[145px] bg-obsidian-200 border border-border-grid px-3 py-2 rounded-lg text-[10px] font-mono text-text-secondary shadow-lg flex flex-col z-10 w-[110px] cursor-pointer hover:border-purple-500 hover:scale-105 transition-all duration-300"
                      onClick={() => setActiveNodeInfo(activeNodeInfo === nodeDetails.json ? null : nodeDetails.json)}
                    >
                      <span className="text-text-primary font-bold mb-1 border-b border-border-grid pb-1 text-center pointer-events-none">3. JSON SOURCE</span>
                      <span className="truncate text-center pointer-events-none">circuit.json</span>
                    </div>

                    <div 
                      className="absolute top-[80px] right-[15px] bg-obsidian-200 border border-neon-amber/40 px-3 py-2 rounded-lg text-[10px] font-mono text-text-secondary shadow-[0_0_15px_rgba(255,191,0,0.1)] flex flex-col z-10 w-[115px] cursor-pointer hover:border-neon-amber hover:scale-105 transition-all duration-300"
                      onClick={() => setActiveNodeInfo(activeNodeInfo === nodeDetails.flowA ? null : nodeDetails.flowA)}
                    >
                      <span className="text-neon-amber font-bold mb-1 border-b border-border-grid pb-1 text-center pointer-events-none">FLOW A: BARE METAL</span>
                      <span className="text-center pointer-events-none">FW Code Gen</span>
                    </div>

                    <div 
                      className="absolute bottom-[80px] right-[15px] bg-obsidian-200 border border-neon-emerald/40 px-3 py-2 rounded-lg text-[10px] font-mono text-text-secondary shadow-[0_0_15px_rgba(0,255,135,0.1)] flex flex-col z-10 w-[115px] cursor-pointer hover:border-neon-emerald hover:scale-105 transition-all duration-300"
                      onClick={() => setActiveNodeInfo(activeNodeInfo === nodeDetails.flowB ? null : nodeDetails.flowB)}
                    >
                      <span className="text-neon-emerald font-bold mb-1 border-b border-border-grid pb-1 text-center pointer-events-none">FLOW B: LINUX</span>
                      <span className="text-center pointer-events-none">Device Tree (.dts)</span>
                    </div>

                    <div 
                      className="absolute bottom-[30px] left-[145px] bg-obsidian-200 border border-status-error/40 px-3 py-2 rounded-lg text-[10px] font-mono text-text-secondary shadow-lg flex flex-col z-10 w-[110px] cursor-pointer hover:border-status-error hover:scale-105 transition-all duration-300"
                      onClick={() => setActiveNodeInfo(activeNodeInfo === nodeDetails.repair ? null : nodeDetails.repair)}
                    >
                      <span className="text-status-error font-bold mb-1 border-b border-border-grid pb-1 text-center pointer-events-none">6. AUTO-REPAIR</span>
                      <span className="truncate text-center pointer-events-none">Dynamic Patching</span>
                    </div>

                    {/* Interactive Info Popover */}
                    {activeNodeInfo && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-obsidian-100/95 backdrop-blur-md border border-neon-cyan/50 p-6 rounded-xl shadow-[0_0_40px_rgba(0,255,255,0.2)] z-50 w-[320px] pointer-events-auto transition-opacity duration-300">
                        <div className="flex justify-between items-start mb-3 border-b border-border-grid pb-2">
                          <h4 className="text-neon-cyan font-bold">{activeNodeInfo.title}</h4>
                          <button onClick={() => setActiveNodeInfo(null)} className="text-text-tertiary hover:text-white transition-colors">
                            &times;
                          </button>
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed">{activeNodeInfo.desc}</p>
                      </div>
                    )}

                  </div>
                </div>

                {/* New Info Block to fill the gap */}
                <div className="p-8 flex flex-col justify-center grow bg-obsidian-50">
                  <h4 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-emerald mb-4">
                    TCS AI-First Engineering
                  </h4>
                  <p className="text-sm text-text-secondary leading-relaxed mb-6">
                    By natively integrating state-of-the-art LLMs into the semiconductor lifecycle, TCS eliminates the archaic bottlenecks of manual specification parsing. We drastically slash integration times, reduce manual human effort, and prevent millions in compounding rework costs.
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-obsidian-200 border border-border-grid p-4 rounded-xl text-center shadow-[0_0_15px_rgba(0,255,255,0.05)] hover:border-neon-cyan transition-colors">
                      <div className="text-2xl font-bold text-neon-cyan mb-1">80%</div>
                      <div className="text-[10px] uppercase tracking-wider text-text-muted">Time Saved</div>
                    </div>
                    <div className="bg-obsidian-200 border border-border-grid p-4 rounded-xl text-center shadow-[0_0_15px_rgba(255,191,0,0.05)] hover:border-status-warning transition-colors">
                      <div className="text-2xl font-bold text-status-warning mb-1">-$2M</div>
                      <div className="text-[10px] uppercase tracking-wider text-text-muted">Rework Costs</div>
                    </div>
                    <div className="bg-obsidian-200 border border-border-grid p-4 rounded-xl text-center shadow-[0_0_15px_rgba(0,255,135,0.05)] hover:border-neon-emerald transition-colors">
                      <div className="text-2xl font-bold text-neon-emerald mb-1">-99%</div>
                      <div className="text-[10px] uppercase tracking-wider text-text-muted">Human Errors</div>
                    </div>
                  </div>
                  <div className="mt-4 text-[10px] text-text-muted/60 text-right italic">
                    * Sources: TCS Internal GenAI Case Studies & Client Benchmarks (2024-2025)
                  </div>
                </div>
              </TiltCard>

              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-emerald/10 border border-neon-emerald/20 text-neon-emerald text-sm font-medium mb-6">
                  <Lightbulb className="w-4 h-4" />
                  The TCS Approach
                </div>
                
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                  The Ultimate <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-emerald">Hardware-to-Software</span> Bridge.
                </h2>
                <p className="text-lg text-text-secondary mb-8 leading-relaxed">
                  Unlike traditional scripts or fragmented AI assistants, the GenAI Pipeline for Bare-Metal & Linux BSPs delivers an end-to-end autonomous workflow. Here is what makes our approach entirely unique in the industry:
                </p>
                
                <div className="space-y-8">
                  <div className="flex gap-4">
                    <Mini3DIcon type="knot" color="#00ff87" />
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-text-primary">Proprietary Multimodal Extraction</h3>
                      <p className="text-text-secondary leading-relaxed">While others rely on structured data, our DeepReader engine autonomously parses raw, unstructured 5,000-page schematic PDFs and images into a validated schema.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <Mini3DIcon type="box" color="#a855f7" />
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-text-primary">Agnostic JSON Source of Truth</h3>
                      <p className="text-text-secondary leading-relaxed">We decouple hardware specs from the code. By establishing a universal <code className="text-neon-cyan bg-neon-cyan/10 px-1 rounded">circuit.json</code> standard, our specialized LLMs can synthesize code for <em>any</em> architecture with near-zero hallucination.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Mini3DIcon type="sphere" color="#ffbf00" />
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-text-primary">Closed-Loop Auto-Repair</h3>
                      <p className="text-text-secondary leading-relaxed">Generating code is easy; making it compile is hard. Our unique Auto-Repair loop intercepts compiler errors and feeds them directly back to the LLM for autonomous patching—no human intervention required.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Section 2.5: Animated Impact Graphs */}
        <section id="impact" className="py-24 px-6 relative max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-slide-up opacity-0 [animation-delay:200ms] forwards relative">
            
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-obsidian-200 border border-border-grid rounded-full mb-4">
              <div className="w-2 h-2 rounded-full bg-status-error animate-pulse"></div>
              <span className="text-xs font-mono text-text-secondary tracking-widest uppercase">Live Industry Data</span>
            </div>
            
            <h2 className="text-3xl font-bold mb-4">Semiconductor & EDA AI Impact</h2>
            <p className="text-text-secondary">Latest 2024-2025 metrics from top silicon and EDA leaders.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Graph 1: Time Reduction (Bar Chart) */}
            <TiltCard className="bg-obsidian-100/50 backdrop-blur-sm border border-border-grid p-8 rounded-2xl h-full">
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-neon-cyan" /> Design Cycle Time
                </h3>
              </div>
              
              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa' }} width={140} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: '#18181d', borderColor: '#2a2a36', borderRadius: '8px', color: '#e4e4e7' }}
                      itemStyle={{ color: '#ffffff' }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(value: any, name: any, props: any) => [props.payload.actual, 'Relative Time']}
                    />
                    <Bar dataKey="time" shape={<Custom3DBar />} activeBar={<Custom3DBar />} animationDuration={1500}>
                      {timeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 pt-4 border-t border-border-grid text-right">
                <p className="text-[10px] text-text-tertiary">Source: Synopsys & Cadence AI Reports (2024-2025)</p>
              </div>
            </TiltCard>

            {/* Graph 2: Defect Reduction (Bar Chart) */}
            <TiltCard className="bg-obsidian-100/50 backdrop-blur-sm border border-border-grid p-8 rounded-2xl h-full">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-2 relative z-10">
                <AlertTriangle className="w-5 h-5 text-neon-emerald" /> Pre-Silicon Defect Reduction
              </h3>
              
              <div className="h-64 w-full mt-4 z-10 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={defectReductionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="stage" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: '#18181d', borderColor: '#2a2a36', borderRadius: '8px', color: '#e4e4e7' }}
                      itemStyle={{ color: '#ffffff' }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(value: any) => [`${value}%`, 'Defect Volume']}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="Baseline" fill="#ff3b3b" shape={<Custom3DBar />} activeBar={<Custom3DBar />} animationDuration={1500} />
                    <Bar dataKey="AI Flow" fill="#00ff87" shape={<Custom3DBar />} activeBar={<Custom3DBar />} animationDuration={1500} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 pt-4 border-t border-border-grid text-right relative z-10">
                <p className="text-[10px] text-text-tertiary">Source: McKinsey Semiconductor AI Analysis (2024)</p>
              </div>
            </TiltCard>

            {/* Graph 3: Cost Over Time (Area Chart) */}
            <TiltCard className="bg-obsidian-100/50 backdrop-blur-sm border border-border-grid p-8 rounded-2xl h-full">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-2 relative z-10">
                <TrendingDown className="w-5 h-5 text-neon-purple" /> Cumulative R&D Cost
              </h3>
              
              <div className="h-64 w-full mt-4 z-10 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={costData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCostAI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1}/>
                      </linearGradient>
                      <filter id="shadow3d" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="4" dy="12" stdDeviation="6" floodColor="#a855f7" floodOpacity="0.4"/>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181d', borderColor: '#2a2a36', borderRadius: '8px', color: '#e4e4e7' }}
                      itemStyle={{ color: '#ffffff' }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(value: any) => [`$${value}k`, 'Cost']}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Area 
                      type="monotone" 
                      dataKey="Traditional" 
                      stroke="#ff3b3b" 
                      fill="none" 
                      strokeWidth={3}
                      animationDuration={1500}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="AI Flow" 
                      stroke="#a855f7" 
                      fillOpacity={1} 
                      fill="url(#colorCostAI)" 
                      strokeWidth={4}
                      animationDuration={1500}
                      activeDot={{ r: 6, fill: '#a855f7', stroke: '#000', strokeWidth: 2 }}
                      style={{ filter: 'url(#shadow3d)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 pt-4 border-t border-border-grid text-right relative z-10">
                <p className="text-[10px] text-text-tertiary">Source: Deloitte Silicon AI ROI Study (2024)</p>
              </div>
            </TiltCard>
          </div>
        </section>

        {/* Section 4: Call to Action */}
        <section id="demos" className="py-32 px-6 border-t border-border-grid relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-neon-emerald/5" />
          <div className="absolute -left-40 bottom-0 w-96 h-96 bg-neon-emerald/10 rounded-full blur-[100px] pointer-events-none animate-blob" />
          <div className="absolute -right-40 top-0 w-96 h-96 bg-neon-cyan/10 rounded-full blur-[100px] pointer-events-none animate-blob [animation-delay:3s]" />
          
          <TiltCard className="max-w-4xl mx-auto text-center relative z-10 p-12 bg-obsidian-100/30 backdrop-blur-sm border border-border-grid rounded-3xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 animate-slide-up opacity-0 forwards">Ready to see it in action?</h2>
            <p className="text-xl text-text-secondary mb-10 max-w-2xl mx-auto animate-slide-up opacity-0 [animation-delay:200ms] forwards">
              Experience how the GenAI Pipeline for Bare-Metal & Linux BSPs can ingest a schematic, configure peripherals, and synthesize conflict-free code in minutes.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up opacity-0 [animation-delay:400ms] forwards">
              <a
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center justify-center"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-neon-cyan to-neon-emerald rounded-xl blur opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse-fast"></div>
                <div className="relative flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg bg-obsidian text-text-primary border border-border-grid group-hover:border-neon-emerald/50 transition-all">
                  Launch Live Demo
                  <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform text-neon-emerald" />
                </div>
              </a>
            </div>
            <p className="mt-8 text-sm text-text-muted animate-fade-in opacity-0 [animation-delay:1s] forwards">
              * The demo will open in a new secure sandbox tab.
            </p>
          </TiltCard>
        </section>

        {/* Section 5: Conclusion */}
        <section id="conclusion" className="py-24 px-6 border-t border-border-grid bg-transparent relative overflow-hidden">
          {/* Background Watermark Logo */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] dark:opacity-[0.05] pointer-events-none select-none z-0">
             <img 
               src={theme === 'dark' ? "/tcs-logo-dark.png" : "/tcs-logo-light.png"} 
               alt="" 
               className="w-full max-w-3xl object-contain mix-blend-multiply dark:mix-blend-screen"
             />
          </div>
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-emerald">The Future of BSP Engineering</h2>
            <p className="text-xl text-text-secondary leading-relaxed mb-8">
              We are moving from an era of manual transcription and endless debugging to an era of intelligent, AI-assisted silicon enablement. 
            </p>
            <p className="text-xl text-text-secondary leading-relaxed">
              The <strong className="text-text-primary">GenAI Pipeline for Bare-Metal & Linux BSPs</strong> doesn't just accelerate time-to-market—it eliminates the fundamental friction between hardware specification and software execution, ensuring that firmware is <strong className="text-neon-cyan">correct by construction</strong> from day one.
            </p>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-text-muted border-t border-border-grid bg-obsidian-50 text-sm">
        <p>TCS &copy; {new Date().getFullYear()} — Generative AI Innovation Lab</p>
      </footer>
      
      {/* Global Style for scan line and graph animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes grow-width {
          from { width: 0; }
          to { width: var(--target-width); }
        }
        @keyframes draw-line {
          to { stroke-dashoffset: 0; }
        }
      `}} />
    </div>
  );
}
