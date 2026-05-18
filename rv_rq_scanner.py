import concurrent.futures
import requests
import json
import time
import sys
import os
import argparse
from datetime import datetime
from ipaddress import ip_network
from colorama import Fore, Style, init

# Init colorama
init(autoreset=True)

BANNER = f"""{Fore.CYAN}
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
"""

SYSTEM_BOX = f"""{Fore.WHITE}
╭──────────────── SYSTEM ────────────────╮
│ STATUS    : ● {Fore.GREEN}READY{Fore.WHITE}                    │
│ MODE      : TERMUX OPTIMIZED           │
│ THREADS   : 200 (FIXED)                │
│ DEFAULT   : 80,443,8080                │
│ ENGINE    : RV-RQ ULTRA CORE v2.0      │
╰────────────────────────────────────────╯
"""

MENU = f"""{Fore.YELLOW}
╔═══════════════ RV-RQ MENU ═══════════════╗
║                                           ║
║  [01] ⚡ CIDR SCAN                        ║
║  [02] 📂 TXT FILE SCAN                   ║
║  [03] ♻ RESUME SCAN                      ║
║  [04] 💾 SAVED RESULTS                   ║
║  [05] ⚙ SETTINGS                         ║
║  [00] ❌ EXIT                            ║
║                                           ║
╚═══════════════════════════════════════════╝
"""

class RV_RQ_Engine:
    def __init__(self, targets, ports, workers=200):
        self.targets = targets
        self.ports = ports
        self.workers = workers
        self.results = []
        self.scanned = 0
        self.hits = 0
        self.total = len(targets) * len(ports)
        self.headers = {
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Pragma": "no-cache",
            "Cache-Control": "no-cache"
        }

    def check_target(self, target_data):
        host, port = target_data
        url = f"{'https' if port == 443 else 'http'}://{host}:{port}"
        
        try:
            # Ultra-tight timeout for high-speed scanning
            response = requests.get(
                url, 
                headers=self.headers, 
                timeout=0.8, 
                verify=False, 
                allow_redirects=False
            )
            
            # CRITICAL FILTER: Strict 101 Switching Protocols check
            if response.status_code == 101:
                timestamp = datetime.now().strftime("%H:%M:%S")
                server = response.headers.get("Server", "CloudFront SSH Proxy + SNI")
                
                hit_data = {
                    "host": host,
                    "port": port,
                    "server": server,
                    "status": "HTTP/1.1 101 Switching Protocols",
                    "time": timestamp
                }
                self.hits += 1
                self.results.append(hit_data)
                self.print_hit(hit_data)
                
        except Exception:
            pass
        finally:
            self.scanned += 1
            self.print_progress(host, port)

    def print_progress(self, host, port):
        # Professional single-line rolling counter
        sys.stdout.write(f"\r{Fore.WHITE}[{Fore.CYAN}{self.scanned}{Fore.WHITE}/{Fore.CYAN}{self.total}{Fore.WHITE}] {Fore.YELLOW}Scanning: {host}:{port} {Style.RESET_ALL}")
        sys.stdout.flush()

    def print_hit(self, res):
        # Beautifully formatted visual block for HITS
        sys.stdout.write("\r" + " " * 80 + "\r")
        print(f"{Fore.GREEN}============================================================")
        print(f"{Fore.GREEN}✓  {Fore.WHITE}HIT [{res['time']}]")
        print(f"   {Fore.GREEN}Proxy  : {Fore.WHITE}{res['host']}:{res['port']}")
        print(f"   {Fore.WHITE}Server : {res['server']}")
        print(f"   {Fore.WHITE}Status : {Fore.WHITE}HTTP/1.1 {Fore.RED}{Style.BRIGHT}101 Switching Protocols")
        print(f"{Fore.GREEN}============================================================")

    def start_scan(self):
        print(f"\n{Fore.CYAN}╔══════════════ SCANNING ENGINE ══════════════╗")
        print(f"║ {Fore.WHITE}TARGETS : {len(self.targets):<32} ║")
        print(f"║ {Fore.WHITE}THREADS : {self.workers:<32} ║")
        print(f"║ {Fore.WHITE}TIMEOUT : 0.8s                             ║")
        print(f"{Fore.CYAN}╚═════════════════════════════════════════════╝\n")

        # Prep the queue
        target_queue = []
        for host in self.targets:
            for port in self.ports:
                target_queue.append((host, port))

        with concurrent.futures.ThreadPoolExecutor(max_workers=self.workers) as executor:
            executor.map(self.check_target, target_queue)

        self.summary()

    def summary(self):
        print(f"\n\n{Fore.GREEN}Scan Complete!")
        print(f"{Fore.WHITE}Total Scanned : {self.scanned}")
        print(f"{Fore.GREEN}Valid HITS    : {self.hits}")
        
        if self.hits > 0:
            save = input(f"\n{Fore.YELLOW}Save HITS to file? [Y/N]: ").lower()
            if save == 'y':
                fname = f"hits_{datetime.now().strftime('%Y%H%M')}.txt"
                with open(fname, "w") as f:
                    for h in self.results:
                        f.write(f"{h['host']}:{h['port']} | {h['status']} | {h['server']}\n")
                print(f"{Fore.GREEN}Saved to {fname}")

def validate_cidr(cidr):
    try:
        network = ip_network(cidr, strict=False)
        return [str(ip) for ip in network]
    except Exception:
        return None

def main():
    while True:
        os.system('clear' if os.name == 'posix' else 'cls')
        print(BANNER)
        print(SYSTEM_BOX)
        print(MENU)
        
        choice = input(f"{Fore.CYAN}╭─ RV-RQ ► {Fore.WHITE}")
        
        if choice in ['1', '01']:
            cidr = input(f"{Fore.CYAN}Enter CIDR Range: ")
            targets = validate_cidr(cidr)
            if not targets:
                print(f"{Fore.RED}Invalid CIDR format!")
                time.sleep(1)
                continue
            
            p_input = input(f"{Fore.CYAN}Target Ports (default 80,443): ")
            ports = [int(p.strip()) for p in p_input.split(",")] if p_input else [80, 443]
            
            engine = RV_RQ_Engine(targets, ports)
            engine.start_scan()
            input("\nPress Enter to return...")

        elif choice in ['2', '02']:
            path = input(f"{Fore.CYAN}Path to target file: ")
            if not os.path.exists(path):
                print(f"{Fore.RED}File not found!")
                time.sleep(1)
                continue
                
            with open(path, "r") as f:
                targets = [line.strip() for line in f if line.strip()]
            
            p_input = input(f"{Fore.CYAN}Target Ports (default 80,443): ")
            ports = [int(p.strip()) for p in p_input.split(",")] if p_input else [80, 443]
            
            engine = RV_RQ_Engine(targets, ports)
            engine.start_scan()
            input("\nPress Enter to return...")

        elif choice in ['0', '00']:
            print(f"{Fore.RED}Exiting system...")
            sys.exit()

if __name__ == "__main__":
    try:
        # Suppress insecure request warnings for SSL verification bypass
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        main()
    except KeyboardInterrupt:
        print(f"\n{Fore.RED}Process halted by user.")
        sys.exit()
