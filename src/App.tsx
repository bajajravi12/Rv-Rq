import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronRight, 
  Terminal, 
  Settings, 
  Play, 
  FileText, 
  History, 
  Save, 
  X,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

// --- Types ---
interface ScanResult {
  host: string;
  port: number;
  status: number;
  statusText: string;
  server: string;
  redirects: number;
  latency: number;
  timestamp: string;
}

interface ScanProgress {
  progress: number;
  total: number;
  status: string;
  results: ScanResult[];
  summary: {
    totalTargets: number;
    liveResults: number;
    duration: number;
  } | null;
}

enum MenuOption {
  MAIN = "MAIN",
  CIDR = "CIDR",
  TXT = "TXT",
  SCANNING = "SCANNING",
  SAVED = "SAVED",
}

export default function App() {
  const [currentMenu, setCurrentMenu] = useState<MenuOption>(MenuOption.MAIN);
  const [inputVal, setInputVal] = useState("");
  const [portsVal, setPortsVal] = useState("80,443,8080");
  const [scanId, setScanId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [savedScans, setSavedScans] = useState<any[]>([]);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, progress]);

  // SSE Connection for scanning
  useEffect(() => {
    if (!scanId || currentMenu !== MenuOption.SCANNING) return;

    const eventSource = new EventSource(`/api/scan/events/${scanId}`);
    
    eventSource.onmessage = (event) => {
      const data: ScanProgress = JSON.parse(event.data);
      setProgress(data);
      
      if (data.results.length > 0) {
        const lastResult = data.results[data.results.length - 1];
        setLogs(prev => [...prev.slice(-100), `✓ LIVE: ${lastResult.host}:${lastResult.port} - HTTP ${lastResult.status} (${lastResult.server})`]);
      }

      if (data.status === "completed") {
        eventSource.close();
        setLogs(prev => [...prev, "--- SCAN COMPLETED ---"]);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setLogs(prev => [...prev, "Error: SSE connection lost"]);
    };

    return () => eventSource.close();
  }, [scanId, currentMenu]);

  const handleStartScan = async (type: "cidr" | "txt") => {
    try {
      setLogs([`Initialing ${type.toUpperCase()} scan...`]);
      const res = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          input: inputVal,
          ports: portsVal.split(",").map(p => parseInt(p.trim())).filter(p => !isNaN(p))
        })
      });
      
      const data = await res.json();
      if (data.scanId) {
        setScanId(data.scanId);
        setCurrentMenu(MenuOption.SCANNING);
      } else {
        setLogs([`Error: ${data.error || "Failed to start scan"}`]);
      }
    } catch (e) {
      setLogs([`Error: Connection refused`]);
    }
  };

  const stopScan = async () => {
    if (!scanId) return;
    await fetch(`/api/scan/stop/${scanId}`, { method: "POST" });
    setLogs(prev => [...prev, "--- SCAN STOPPED BY USER ---"]);
  };

  const renderBanner = () => (
    <div className="flex flex-col items-center justify-center py-6 border-b border-zinc-800 mb-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-4xl font-bold tracking-tighter text-zinc-100"
      >
        RV-RQ
      </motion.div>
      <div className="text-zinc-500 text-xs font-mono tracking-widest mt-1">
        Made by Rv-Rq
      </div>
    </div>
  );

  const renderMainMenu = () => (
    <div className="space-y-4 max-w-lg mx-auto">
      {[
        { id: MenuOption.CIDR, label: "CIDR Scan", icon: <Terminal size={18} />, color: "text-blue-400" },
        { id: MenuOption.TXT, label: "TXT File Scan", icon: <FileText size={18} />, color: "text-green-400" },
        { id: MenuOption.MAIN, label: "Resume Scan", icon: <Play size={18} />, color: "text-yellow-400", disabled: true },
        { id: MenuOption.SAVED, label: "Saved Results", icon: <Save size={18} />, color: "text-purple-400" },
        { id: "EXIT", label: "Exit", icon: <X size={18} />, color: "text-red-400" }
      ].map((opt, i) => (
        <motion.button
          key={opt.id}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.1 }}
          onClick={() => opt.id !== "EXIT" && !opt.disabled && setCurrentMenu(opt.id as MenuOption)}
          className={`w-full flex items-center gap-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all group ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className={`${opt.color} group-hover:scale-110 transition-transform`}>{opt.icon}</span>
          <span className="flex-1 text-left font-mono text-zinc-300">[{i + 1}] {opt.label}</span>
          <ChevronRight size={14} className="text-zinc-600 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      ))}
    </div>
  );

  const renderInputForm = (type: "cidr" | "txt") => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-2xl mx-auto"
    >
      <div className="space-y-2">
        <label className="text-zinc-400 text-xs font-mono uppercase tracking-widest block">
          {type === "cidr" ? "Enter CIDR Range (e.g. 192.168.1.0/24)" : "Enter Targets (one per line)"}
        </label>
        {type === "cidr" ? (
          <input 
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-3 text-zinc-100 font-mono focus:outline-hidden focus:border-zinc-500 transition-colors"
            placeholder="10.0.0.0/24"
          />
        ) : (
          <textarea 
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-3 text-zinc-100 font-mono h-40 focus:outline-hidden focus:border-zinc-500 transition-colors"
            placeholder="example.com&#10;1.2.3.4&#10;https://target.local"
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="text-zinc-400 text-xs font-mono uppercase tracking-widest block">
          Select Ports (comma separated)
        </label>
        <input 
          type="text"
          value={portsVal}
          onChange={(e) => setPortsVal(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-3 text-zinc-100 font-mono focus:outline-hidden focus:border-zinc-500 transition-colors"
          placeholder="80,443,8080"
        />
        <p className="text-zinc-500 text-[10px] font-mono italic">Default: 80, 443, 8080</p>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={() => setCurrentMenu(MenuOption.MAIN)}
          className="flex-1 p-3 rounded-md bg-zinc-800 text-zinc-300 font-mono hover:bg-zinc-700 transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={() => handleStartScan(type)}
          className="flex-1 p-3 rounded-md bg-zinc-100 text-zinc-900 font-mono font-bold hover:bg-white transition-colors"
        >
          Start Scan
        </button>
      </div>
    </motion.div>
  );

  const renderScanning = () => (
    <div className="flex flex-col h-[70vh] gap-4">
      {/* HUD */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-md">
          <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Progress</div>
          <div className="text-zinc-100 font-mono text-xl">
            {progress?.total ? ((progress.progress / progress.total) * 100).toFixed(1) : 0}%
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-md">
          <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Tasks</div>
          <div className="text-zinc-100 font-mono text-xl">
            {progress?.progress || 0}/{progress?.total || 0}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-md">
          <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Live Services</div>
          <div className="text-green-400 font-mono text-xl">
            {progress?.results.length || 0}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-md">
          <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Status</div>
          <div className="text-zinc-100 font-mono text-xl flex items-center gap-2">
            {progress?.status === "running" ? (
              <Loader2 className="animate-spin text-blue-400" size={16} />
            ) : progress?.status === "completed" ? (
              <CheckCircle2 className="text-green-400" size={16} />
            ) : (
              <AlertCircle className="text-yellow-400" size={16} />
            )}
            <span className="capitalize">{progress?.status || "Starting..."}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress ? (progress.progress / progress.total) * 100 : 0}%` }}
          className="h-full bg-blue-500"
        />
      </div>

      {/* Terminal Output */}
      <div className="flex-1 bg-black border border-zinc-800 rounded-md overflow-hidden flex flex-col font-mono text-sm">
        <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex justify-between items-center">
          <span className="text-zinc-500 text-[10px] uppercase font-bold">Terminal Logs</span>
          <div className="flex gap-2">
             <button onClick={stopScan} className="text-red-400 hover:text-red-300 text-[10px] uppercase">Stop</button>
             <button onClick={() => setCurrentMenu(MenuOption.MAIN)} className="text-zinc-400 hover:text-zinc-300 text-[10px] uppercase">Main Menu</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {logs.map((log, i) => (
            <div key={i} className={log.startsWith("✓") ? "text-green-400" : log.startsWith("Error") ? "text-red-400" : "text-zinc-400"}>
              <span className="opacity-30 mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Summary Screen */}
      <AnimatePresence>
        {progress?.status === "completed" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-x-8 top-20 bg-zinc-900 border border-zinc-700 p-8 rounded-xl shadow-2xl z-50 text-center space-y-6"
          >
            <h2 className="text-2xl font-bold font-mono text-zinc-100">Scan Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="text-zinc-500 text-xs uppercase">Total Targets</div>
                <div className="text-2xl font-mono">{progress.summary?.totalTargets}</div>
              </div>
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="text-zinc-500 text-xs uppercase">Live Found</div>
                <div className="text-2xl font-mono text-green-400">{progress.summary?.liveResults}</div>
              </div>
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="text-zinc-500 text-xs uppercase">Duration</div>
                <div className="text-2xl font-mono">{progress.summary?.duration.toFixed(2)}s</div>
              </div>
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="text-zinc-500 text-xs uppercase">Success Rate</div>
                <div className="text-2xl font-mono">
                  {progress.summary ? ((progress.summary.liveResults / progress.summary.totalTargets) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setSavedScans(prev => [...prev, { ...progress, id: scanId, date: new Date().toLocaleString() }]);
                  setCurrentMenu(MenuOption.MAIN);
                }}
                className="flex-1 p-3 rounded-md bg-blue-600 text-white font-mono font-bold"
              >
                Save & Close
              </button>
              <button 
                onClick={() => setCurrentMenu(MenuOption.MAIN)}
                className="flex-1 p-3 rounded-md bg-zinc-800 text-zinc-300 font-mono"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderSaved = () => (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-mono font-bold text-zinc-100">History</h2>
        <button onClick={() => setCurrentMenu(MenuOption.MAIN)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button>
      </div>
      {savedScans.length === 0 ? (
        <div className="text-center py-20 text-zinc-600 font-mono italic">No saved scans found.</div>
      ) : (
        savedScans.map((scan, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex justify-between items-center">
            <div>
              <div className="text-zinc-100 font-mono">{scan.id}</div>
              <div className="text-zinc-500 text-xs">{scan.date}</div>
            </div>
            <div className="text-right">
              <div className="text-green-400 font-mono">{scan.summary?.liveResults} Live</div>
              <div className="text-zinc-500 text-xs">{scan.summary?.totalTargets} Targets</div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 font-sans selection:bg-zinc-800 selection:text-white">
      <div className="max-w-4xl mx-auto">
        {renderBanner()}
        
        <main className="relative">
          {currentMenu === MenuOption.MAIN && renderMainMenu()}
          {currentMenu === MenuOption.CIDR && renderInputForm("cidr")}
          {currentMenu === MenuOption.TXT && renderInputForm("txt")}
          {currentMenu === MenuOption.SCANNING && renderScanning()}
          {currentMenu === MenuOption.SAVED && renderSaved()}
        </main>

        <footer className="mt-12 text-center text-zinc-700 text-[10px] font-mono tracking-widest uppercase py-8 border-t border-zinc-900/50">
          Authorized Use Only • Built for Speed • Termux Compatible
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #000;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}} />
    </div>
  );
}
