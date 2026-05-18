import asyncio
import aiohttp
import json
import time
import sys
import os
import argparse
from datetime import datetime
from ipaddress import ip_network
from colorama import Fore, Style, init

# Init colorama for cross-platform color support (Termux compatible)
init(autoreset=True)

BANNER = """
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

SYSTEM_BOX = """
╭──────────────── SYSTEM ────────────────╮
│ STATUS    : ● READY                    │
│ MODE      : TERMUX OPTIMIZED           │
│ THREADS   : AUTO                       │
│ DEFAULT   : 80,443,8080                │
│ ENGINE    : RV-RQ SCAN CORE            │
╰────────────────────────────────────────╯
"""

MENU = """
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

class Scanner:
    def __init__(self, targets, ports, concurrency=50, mode_name="CIDR"):
        self.targets = targets
        self.ports = ports
        self.concurrency = concurrency
        self.mode_name = mode_name
        self.results = []
        self.scanned_count = 0
        self.total_count = len(targets) * len(ports)
        self.start_time = 0
        self.is_paused = False
        self.is_stopped = False
        self.checkpoint_file = "scan_checkpoint.json"

    def save_checkpoint(self, index):
        data = {
            "index": index,
            "targets": self.targets,
            "ports": self.ports,
            "results": self.results
        }
        with open(self.checkpoint_file, "w") as f:
            json.dump(data, f)

    async def scan_target(self, session, host, port):
        if self.is_stopped:
            return

        protocol_v = "HTTP/1.1"
        url = f"{'https' if port == 443 else 'http'}://{host}:{port}"
        
        status_code = "---"
        status_text = "..."
        
        try:
            async with session.get(url, timeout=3, ssl=False) as response:
                server = response.headers.get("Server", "Unknown")
                status_code = response.status
                status_text = response.reason
                full_status = f"HTTP/{response.version.major}.{response.version.minor} {status_code} {status_text}"
                
                result = {
                    "host": host,
                    "port": port,
                    "server": server,
                    "status": full_status,
                    "time": datetime.now().strftime("%H:%M:%S")
                }
                self.results.append(result)
                self.print_live_service(result)
        except Exception as e:
            status_text = "ERROR"
            if "Timeout" in str(e): status_text = "TIMEOUT"
            full_status = f"{status_text}"
        finally:
            self.scanned_count += 1
            self.print_progress(host, port, full_status)

    def print_progress(self, host, port, status):
        # Format: [003421/25856] 56.xxx.xxx.xxx:443  HTTP/1.1 200 OK
        progress_str = f"{Fore.WHITE}[{str(self.scanned_count).zfill(6)}/{str(self.total_count).zfill(6)}] {Fore.CYAN}{host}:{port}  {Fore.YELLOW}{status}{Style.RESET_ALL}"
        sys.stdout.write(f"\r{progress_str}")
        sys.stdout.flush()

    def print_live_service(self, res):
        sys.stdout.write("\r" + " " * 120 + "\r")
        print(f"{Fore.GREEN}╔══════════════ ✓ LIVE HIT ═════════════╗")
        print(f"{Fore.GREEN}║ {Fore.WHITE}TIME    : {res['time']}                    ║")
        print(f"{Fore.GREEN}║ {Fore.WHITE}HOST    : {res['host']}             ║")
        print(f"{Fore.GREEN}║ {Fore.WHITE}PORT    : {res['port']}                         ║")
        print(f"{Fore.GREEN}║ {Fore.WHITE}SERVER  : {res['server'][:25]:<25} ║")
        print(f"{Fore.GREEN}║ {Fore.WHITE}STATUS  : {res['status'][:25]:<25} ║")
        print(f"{Fore.GREEN}╚═══════════════════════════════════════╝")

    async def run(self, start_index=0, input_val=""):
        self.start_time = time.time()
        
        print(f"\n{Fore.CYAN}╔══════════════ {self.mode_name} MODE ══════════════╗")
        if self.mode_name == "CIDR":
            print(f"║ {Fore.WHITE}CIDR RANGE : {input_val:<25} ║")
        else:
            print(f"║ {Fore.WHITE}TARGETS    : {len(self.targets):<25} ║")
        print(f"║ {Fore.WHITE}PORTS      : {','.join(map(str, self.ports[:3]))}{'...' if len(self.ports) > 3 else '':<18} ║")
        print(f"║ {Fore.WHITE}THREADS    : AUTO                      ║")
        print(f"{Fore.CYAN}╚═══════════════════════════════════════╝\n")
        
        queue = []
        for i in range(len(self.targets)):
            for port in self.ports:
                queue.append((self.targets[i], port))

        current_queue = queue[start_index:]
        self.scanned_count = start_index

        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            chunk_size = self.concurrency
            for i in range(0, len(current_queue), chunk_size):
                if self.is_stopped: break
                chunk = current_queue[i:i+chunk_size]
                tasks = [self.scan_target(session, host, port) for host, port in chunk]
                await asyncio.gather(*tasks)
                if i % (chunk_size * 5) == 0:
                    self.save_checkpoint(start_index + i)

        duration = time.time() - self.start_time
        self.results_summary(duration)

    def results_summary(self, duration):
        print(f"\n\n{Fore.GREEN}Scan Complete")
        print(f"{Fore.WHITE}Total Targets : {len(self.targets) * len(self.ports)}")
        print(f"{Fore.CYAN}Live Results  : {len(self.results)}")
        print(f"{Fore.WHITE}Duration      : {duration:.2f}s")
        
        save = input(f"\n{Fore.YELLOW}Do you want to save results? [Y/N]: ").lower()
        if save == 'y':
            filename = input("Enter filename: ")
            if filename.endswith(".json"):
                with open(filename, "w") as f:
                    json.dump(self.results, f, indent=4)
            else:
                with open(filename, "w") as f:
                    for r in self.results:
                        f.write(f"{r['host']}:{r['port']} - {r['status']} ({r['server']})\n")
            print(f"{Fore.GREEN}Results saved to {filename}")

def validate_cidr(cidr):
    try:
        network = ip_network(cidr, strict=False)
        return [str(ip) for ip in network]
    except Exception:
        return None

def main_menu():
    while True:
        os.system('clear')
        print(Fore.CYAN + BANNER)
        print(Fore.WHITE + SYSTEM_BOX)
        print(Fore.YELLOW + MENU)
        
        choice = input(f"{Fore.CYAN}╭─ RV-RQ ► {Fore.WHITE}")
        
        if choice in ['1', '01']:
            cidr = input(f"{Fore.CYAN}Enter CIDR: ")
            targets = validate_cidr(cidr)
            if not targets:
                print(f"{Fore.RED}Invalid CIDR")
                time.sleep(1)
                continue
            
            ports_input = input(f"{Fore.CYAN}Select ports (default 80,443,8080): ")
            ports = [int(p.strip()) for p in ports_input.split(",")] if ports_input else [80, 443, 8080]
            
            scanner = Scanner(targets, ports, mode_name="CIDR")
            asyncio.run(scanner.run(input_val=cidr))
            input("\nPress Enter to return...")

        elif choice in ['2', '02']:
            path = input(f"{Fore.CYAN}Enter TXT file path: ")
            if not os.path.exists(path):
                print(f"{Fore.RED}File not found")
                time.sleep(1)
                continue
                
            with open(path, "r") as f:
                targets = list(set([line.strip() for line in f if line.strip()]))
            
            ports_input = input(f"{Fore.CYAN}Select ports: ")
            ports = [int(p.strip()) for p in ports_input.split(",")] if ports_input else [80, 443, 8080]
            
            scanner = Scanner(targets, ports, mode_name="TXT")
            asyncio.run(scanner.run())
            input("\nPress Enter to return...")

        elif choice in ['3', '03']:
            if os.path.exists("scan_checkpoint.json"):
                with open("scan_checkpoint.json", "r") as f:
                    cp = json.load(f)
                scanner = Scanner(cp['targets'], cp['ports'])
                scanner.results = cp['results']
                asyncio.run(scanner.run(start_index=cp['index']))
            else:
                print(f"{Fore.RED}No checkpoint found")
            time.sleep(1)

        elif choice in ['4', '04']:
            print(f"\n{Fore.CYAN}Saved files:")
            files = [f for f in os.listdir('.') if f.endswith(('.txt', '.json'))]
            for f in files: print(f" - {f}")
            input("\nPress Enter to return...")

        elif choice in ['0', '00']:
            sys.exit()

if __name__ == "__main__":
    try:
        main_menu()
    except KeyboardInterrupt:
        print(f"\n{Fore.RED}Interrupted by user. Exiting...")
        sys.exit()
