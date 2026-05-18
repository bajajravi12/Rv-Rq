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
  protocol: string;
  latency: number;
  timestamp: string;
}

interface ScanProgress {
  progress: number;
  total: number;
  status: string;
  results: ScanResult[];
  lastLive: ScanResult | null;
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
      
      const pct = data.total ? ((data.progress / data.total) * 100).toFixed(1) : "0.0";
      
      // Update logs with exact requested format
      if (data.lastLive) {
        setLogs(prev => [...prev.slice(-150), `Progress: ${data.progress}/${data.total} (${pct}%) [${data.progress}/${data.total}] ${data.lastLive?.host}:${data.lastLive?.port} ${data.lastLive?.protocol} ${data.lastLive?.status} ${data.lastLive?.statusText}`]);
      } else if (data.progress % 10 === 0) {
        // Just show basic progress if no hit
        setLogs(prev => [...prev.slice(-150), `Progress: ${data.progress}/${data.total} (${pct}%) [${data.progress}/${data.total}] Scanning...`]);
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
      setLogs([`> Initializing RV-RQ ${type.toUpperCase()} scanner...`]);
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
    <div className="flex flex-col items-center justify-center py-6 border-2 border-zinc-800 bg-zinc-950/50 mb-8 relative">
      <pre className="text-cyan-400 font-mono text-[8px] md:text-[10px] leading-tight select-none">
{`
╔════════════════════════════════════════════╗
║                                            ║
║   ▄██████╗ ██╗   ██╗      ██████╗  ██████╗║
║   ██╔══██╗██║   ██║      ██╔══██╗██╔═══██║
║   ██████╔╝██║   ██║█████╗██████╔╝██║▄▄ ██║
║   ██╔══██╗╚██╗ ██╔╝╚════╝██╔══██╗██║▀▀ ██║
║   ██║  ██║ ╚████╔╝       ██║  ██║╚██████╔╝
║   ╚═╝  ╚═╝  ╚═══╝        ╚═╝  ╚══▀▀═╝ ╚═══╝
║                                            ║
║            ⚡ MADE BY RV-RQ ⚡             ║
║                                            ║
╚════════════════════════════════════════════╝
`}
      </pre>
    </div>
  );

  const renderMainMenu = () => (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* SYSTEM BOX */}
      <div className="bg-black border border-zinc-800 rounded-none overflow-hidden">
        <div className="bg-zinc-900/50 px-4 py-1 text-[10px] font-black tracking-[0.3em] text-zinc-500 border-b border-zinc-800">SYSTEM STATUS</div>
        <div className="p-4 font-mono text-xs space-y-1">
          <div className="flex justify-between"><span className="text-zinc-500">STATUS</span> <span className="text-cyan-400">● READY</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">MODE</span> <span className="text-zinc-300">TERMUX OPTIMIZED</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">THREADS</span> <span className="text-zinc-300">AUTO</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">ENGINE</span> <span className="text-cyan-400">RV-RQ SCAN CORE</span></div>
        </div>
      </div>

      <div className="bg-black border-2 border-zinc-800 p-1">
        <div className="bg-zinc-900/30 px-6 py-2 border-b border-zinc-800 text-center font-mono font-bold text-xs tracking-widest text-zinc-400">
          ╔═══════════════ RV-RQ MENU ═══════════════╗
        </div>
        <div className="p-2 space-y-1">
          {[
            { id: MenuOption.CIDR, label: "⚡ CIDR SCAN", index: "01" },
            { id: MenuOption.TXT, label: "📂 TXT FILE SCAN", index: "02" },
            { id: MenuOption.MAIN, label: "♻ RESUME SCAN", index: "03" },
            { id: MenuOption.SAVED, label: "💾 SAVED RESULTS", index: "04" },
            { id: "SETTINGS", label: "⚙ SETTINGS", index: "05" },
            { id: "EXIT", label: "❌ EXIT", index: "00", color: "text-rose-500" }
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => opt.id !== "EXIT" && setCurrentMenu(opt.id as MenuOption)}
              className={`w-full flex items-center gap-4 p-3 font-mono text-left hover:bg-zinc-900 transition-colors group relative`}
            >
              <span className={`text-zinc-400 font-bold w-12 group-hover:text-cyan-400 transition-colors`}>[{opt.index}]</span>
              <span className={`flex-1 text-sm ${opt.color || 'text-zinc-300'} font-bold`}>{opt.label}</span>
              <ChevronRight size={14} className="text-zinc-800 group-hover:text-cyan-500 transition-colors" />
            </button>
          ))}
        </div>
        <div className="bg-zinc-900/30 px-6 py-2 border-t border-zinc-800 text-center font-mono font-bold text-xs tracking-widest text-zinc-400">
          ╚═══════════════════════════════════════════╝
        </div>
      </div>
      
      <div className="text-[10px] font-mono text-zinc-700 text-center uppercase tracking-[0.5em] animate-pulse">
        ╭─ RV-RQ ►
      </div>
    </div>
  );

  const renderInputForm = (type: "cidr" | "txt") => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-xl mx-auto"
    >
      <div className="bg-zinc-950 border-2 border-zinc-800">
        <div className="bg-zinc-900 px-6 py-2 border-b-2 border-zinc-800 text-center font-mono font-black text-sm tracking-tighter text-white italic">
           ╔══════════════ {type.toUpperCase()} MODE ══════════════╗
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">INPUT VECTOR</label>
            {type === "cidr" ? (
              <input 
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="w-full bg-black border border-zinc-800 p-4 text-cyan-400 font-mono text-sm focus:outline-hidden focus:border-cyan-500 transition-all font-bold"
                placeholder="56.228.0.0/23"
              />
            ) : (
              <textarea 
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="w-full bg-black border border-zinc-800 p-4 text-cyan-400 font-mono text-sm h-40 focus:outline-hidden focus:border-cyan-500 transition-all font-bold resize-none"
                placeholder="targets.txt data..."
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">PORT RANGE</label>
            <input 
              type="text"
              value={portsVal}
              onChange={(e) => setPortsVal(e.target.value)}
              className="w-full bg-black border border-zinc-800 p-4 text-amber-500 font-mono text-sm focus:outline-hidden focus:border-amber-500 transition-all font-bold"
              placeholder="80,443,8080"
            />
          </div>
        </div>
        <div className="bg-zinc-900 p-2 flex gap-2">
          <button 
            onClick={() => setCurrentMenu(MenuOption.MAIN)}
            className="flex-1 p-3 bg-zinc-800 text-zinc-400 font-mono text-xs font-bold hover:bg-zinc-700 uppercase"
          >
            [ CANCEL ]
          </button>
          <button 
            onClick={() => handleStartScan(type)}
            className="flex-1 p-3 bg-cyan-600 text-white font-mono text-xs font-black hover:bg-cyan-500 uppercase shadow-[0_0_15px_rgba(6,182,212,0.4)]"
          >
            [ START_SCAN ]
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderScanning = () => (
    <div className="flex flex-col h-[75vh] gap-4">
      {/* HUD GAUGE */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { l: "PROC", v: `${progress?.total ? ((progress.progress / progress.total) * 100).toFixed(1) : 0}%`, c: "text-cyan-400" },
          { l: "HIT", v: progress?.results.length || 0, c: "text-lime-400" },
          { l: "REMAIN", v: (progress?.total || 0) - (progress?.progress || 0), c: "text-zinc-500" },
          { l: "TPS", v: "AUTO", c: "text-zinc-500" }
        ].map((s, i) => (
          <div key={i} className="bg-zinc-950 border border-zinc-900 p-2 text-center">
            <div className="text-[8px] text-zinc-700 font-black tracking-widest">{s.l}</div>
            <div className={`font-mono text-lg font-black ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* COMPACT LOGS */}
      <div className="flex-1 bg-black border-2 border-zinc-900 relative overflow-hidden flex flex-col">
        <div className="bg-zinc-900 px-4 py-2 border-b border-black flex justify-between items-center">
          <span className="text-[10px] font-mono text-cyan-400 font-black tracking-widest animate-pulse italic">RV-RQ ENGINE ACTIVE</span>
          <button onClick={stopScan} className="text-rose-500 font-mono text-[10px] font-bold hover:underline">[ STOP ]</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-0.5 custom-scrollbar font-mono text-[11px]">
          {logs.map((log, i) => (
            <div key={i} className={log.includes("200 OK") ? "text-lime-400 font-bold" : "text-zinc-600"}>
              {log}
            </div>
          ))}
          
          {/* POP OVERLAY HIT BOX */}
          <AnimatePresence>
            {progress?.lastLive && (
              <motion.div 
                key={progress.lastLive.timestamp}
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="my-4 mx-auto max-w-sm sticky bottom-4 z-50 shadow-[0_0_40px_rgba(34,197,94,0.3)]"
              >
                <div className="bg-black border-2 border-lime-500 text-lime-400 font-mono text-[11px]">
                  <div className="bg-lime-500 text-black px-4 py-1 flex justify-between font-black">
                    <span>╔══════════════ ✓ LIVE HIT ═════════════╗</span>
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="flex justify-between"><span>║ TIME    :</span> <span>{progress.lastLive.timestamp} ║</span></div>
                    <div className="flex justify-between"><span>║ HOST    :</span> <span className="text-white">{progress.lastLive.host} ║</span></div>
                    <div className="flex justify-between"><span>║ PORT    :</span> <span className="text-white">{progress.lastLive.port} ║</span></div>
                    <div className="flex justify-between"><span>║ SERVER  :</span> <span className="text-white truncate max-w-[150px]">{progress.lastLive.server} ║</span></div>
                    <div className="flex justify-between"><span>║ STATUS  :</span> <span className="text-cyan-400 font-black">{progress.lastLive.protocol} {progress.lastLive.status} {progress.lastLive.statusText} ║</span></div>
                  </div>
                  <div className="bg-zinc-900/50 px-4 py-1 text-[10px] opacity-70 text-right">
                    ╚═══════════════════════════════════════════╝
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
