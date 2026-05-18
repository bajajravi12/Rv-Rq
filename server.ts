import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import ipaddr from "ipaddr.js";
import http from "http";
import https from "https";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Global state for scans (in-memory for demo)
  const scans = new Map();

  // Helper to resolve CIDR to individual IPs
  function expandCIDR(cidr: string): string[] {
    try {
      const [address, mask] = cidr.split("/");
      const parsedAddr = ipaddr.parse(address);
      const maskNum = parseInt(mask, 10);
      
      if (parsedAddr.kind() === "ipv4") {
        const range = ipaddr.IPv4.networkAddressAndPrefixLength(parsedAddr as ipaddr.IPv4, maskNum);
        // Simplified expansion for /24 or smaller to avoid memory issues
        // In a real tool for /16 we'd use a stream/generator
        if (maskNum < 16) throw new Error("CIDR too large for web demo. Please use /16 or smaller.");
        
        const network = range[0];
        const ips: string[] = [];
        const numIps = Math.pow(2, 32 - maskNum);
        
        const startOctets = network.toByteArray();
        for (let i = 0; i < numIps; i++) {
          const currentOctets = [...startOctets];
          let remainder = i;
          for (let j = 3; j >= 0; j--) {
            currentOctets[j] += remainder % 256;
            remainder = Math.floor(remainder / 256);
          }
          ips.push(currentOctets.join("."));
        }
        return ips;
      }
      return [address];
    } catch (e) {
      console.error("CIDR expansion error:", e);
      return [];
    }
  }

  // Scanning endpoint - returns a scan ID
  app.post("/api/scan/start", (req, res) => {
    const { type, input, ports } = req.body;
    let targets: string[] = [];

    if (type === "cidr") {
      targets = expandCIDR(input);
    } else if (type === "txt") {
      targets = input.split("\n")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
    }

    if (targets.length === 0) {
      return res.status(400).json({ error: "No valid targets found" });
    }

    const scanId = Math.random().toString(36).substring(7);
    const scanState = {
      id: scanId,
      targets,
      ports: ports || [80, 443, 8080],
      progress: 0,
      total: targets.length * (ports?.length || 3),
      results: [],
      status: "running",
      startTime: Date.now(),
    };

    scans.set(scanId, scanState);
    
    // Start background scan process
    runScan(scanId);

    res.json({ scanId });
  });

  async function runScan(scanId: string) {
    const scan = scans.get(scanId);
    if (!scan) return;

    const concurrency = 20; // limit concurrency to avoid being blocked
    const queue = [];
    
    for (const host of scan.targets) {
      for (const port of scan.ports) {
        queue.push({ host, port });
      }
    }

    let completed = 0;
    
    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        if (scan.status === "stopped") break;

        const { host, port } = item;
        try {
          const protocol = port === 443 ? "https" : "http";
          const url = `${protocol}://${host}:${port}`;
          
          const startTime = Date.now();
          const response = await axios.get(url, {
            timeout: 3000,
            maxRedirects: 5,
            validateStatus: () => true, // capture all status codes
            headers: { 'User-Agent': 'RV-RQ-Scanner/1.0' },
            // Keep-alive agent for better performance
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false })
          });

          const result = {
            host,
            port,
            status: response.status,
            statusText: response.statusText,
            server: response.headers['server'] || 'Unknown',
            protocol: response.config.url?.startsWith('https') ? 'HTTPS/1.1' : 'HTTP/1.1',
            latency: Date.now() - startTime,
            timestamp: new Date().toLocaleTimeString(),
          };

          scan.results.push(result);
          scan.lastLive = result;
        } catch (e: any) {
          // Send back individual errors as results for the progress feed
          scan.lastLive = {
            host,
            port,
            status: e.response?.status || 0,
            statusText: e.response?.statusText || (e.code === 'ECONNABORTED' ? 'Timeout' : 'Connection Refused'),
            server: 'N/A',
            protocol: port === 443 ? 'HTTPS/1.1' : 'HTTP/1.1',
            latency: 0,
            timestamp: new Date().toLocaleTimeString()
          };
        }
        
        completed++;
        scan.progress = completed;
        
        // Brief sleep to yield
        if (completed % 10 === 0) await new Promise(r => setTimeout(r, 10));
      }
    }

    // Launch workers
    const workers = Array(concurrency).fill(null).map(worker);
    await Promise.all(workers);
    
    scan.status = "completed";
    scan.endTime = Date.now();
  }

  // SSE endpoint for scan updates
  app.get("/api/scan/events/:scanId", (req, res) => {
    const { scanId } = req.params;
    const scan = scans.get(scanId);

    if (!scan) {
      return res.status(404).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const interval = setInterval(() => {
      const currentScan = scans.get(scanId);
      if (!currentScan) {
        clearInterval(interval);
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify({
        progress: currentScan.progress,
        total: currentScan.total,
        status: currentScan.status,
        lastLive: currentScan.lastLive,
        results: currentScan.results, 
        summary: currentScan.status === "completed" ? {
          totalTargets: currentScan.targets.length,
          liveResults: currentScan.results.length,
          duration: (currentScan.endTime - currentScan.startTime) / 1000
        } : null
      })}\n\n`);

      if (currentScan.status === "completed" || currentScan.status === "stopped") {
        clearInterval(interval);
        res.end();
      }
    }, 500);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  app.post("/api/scan/stop/:scanId", (req, res) => {
    const scan = scans.get(req.params.scanId);
    if (scan) {
      scan.status = "stopped";
    }
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
