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

BANNER = f"""
{Style.BRIGHT}{Fore.WHITE}      RV-RQ
{Style.NORMAL}{Fore.CYAN} Made by Rv-Rq
"""

class Scanner:
    def __init__(self, targets, ports, concurrency=50):
        self.targets = targets
        self.ports = ports
        self.concurrency = concurrency
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

        protocol = "https" if port == 443 else "http"
        url = f"{protocol}://{host}:{port}"
        
        try:
            async with session.get(url, timeout=3, ssl=False) as response:
                server = response.headers.get("Server", "Unknown")
                status = f"HTTP/{response.version.major}.{response.version.minor} {response.status} {response.reason}"
                
                result = {
                    "host": host,
                    "port": port,
                    "server": server,
                    "status": status,
                    "time": datetime.now().strftime("%H:%M:%S")
                }
                self.results.append(result)
                self.print_live_service(result)
        except Exception:
            pass
        finally:
            self.scanned_count += 1
            self.print_progress(host, port)

    def print_progress(self, host, port):
        percentage = (self.scanned_count / self.total_count) * 100
        progress_str = f"{Fore.CYAN}Progress: {self.scanned_count}/{self.total_count} ({percentage:.1f}%) [{host}:{port}]{Style.RESET_ALL}"
        # Use carriage return to overwrite line
        sys.stdout.write(f"\r{progress_str}")
        sys.stdout.flush()

    def print_live_service(self, res):
        # Clear line before printing highlighted result
        sys.stdout.write("\r" + " " * 80 + "\r")
        print(f"{Fore.GREEN}=================================")
        print(f"{Fore.GREEN}✓ LIVE SERVICE [{res['time']}]")
        print(f"{Fore.WHITE}Host   : {res['host']}")
        print(f"{Fore.WHITE}Port   : {res['port']}")
        print(f"{Fore.WHITE}Server : {res['server']}")
        print(f"{Fore.WHITE}Status : {res['status']}")
        print(f"{Fore.GREEN}=================================")

    async def run(self, start_index=0):
        self.start_time = time.time()
        print(f"\n{Fore.YELLOW}Starting scan with concurrency {self.concurrency}...")
        
        queue = []
        for i in range(len(self.targets)):
            for port in self.ports:
                queue.append((self.targets[i], port))

        # Slice queue based on resume index
        current_queue = queue[start_index:]
        self.scanned_count = start_index

        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # Chunk processing to handle large ranges
            chunk_size = self.concurrency
            for i in range(0, len(current_queue), chunk_size):
                if self.is_stopped: break
                
                chunk = current_queue[i:i+chunk_size]
                tasks = [self.scan_target(session, host, port) for host, port in chunk]
                await asyncio.gather(*tasks)
                
                # Checkpoint every 5 chunks
                if i % (chunk_size * 5) == 0:
                    self.save_checkpoint(start_index + i)

        duration = time.time() - self.start_time
        self.results_summary(duration)

    def results_summary(self, duration):
        print(f"\n\n{Fore.CYAN}Scan Complete")
        print(f"{Fore.WHITE}Total Targets : {len(self.targets) * len(self.ports)}")
        print(f"{Fore.GREEN}Live Results  : {len(self.results)}")
        print(f"{Fore.WHITE}Duration      : {duration:.2s}s")
        
        save = input(f"\n{Fore.YELLOW}Do you want to save results? [Y/N]: ").lower()
        if save == 'y':
            filename = input("Enter filename (txt/json): ")
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
        print(BANNER)
        print(f"{Fore.WHITE}[1] CIDR Scan")
        print(f"{Fore.WHITE}[2] TXT File Scan")
        print(f"{Fore.WHITE}[3] Resume Scan")
        print(f"{Fore.WHITE}[4] Saved Results")
        print(f"{Fore.RED}[0] Exit")
        
        choice = input(f"\n{Fore.YELLOW}RV-RQ > ")
        
        if choice == '1':
            cidr = input(f"{Fore.CYAN}Enter CIDR (e.g. 192.168.1.0/24): ")
            targets = validate_cidr(cidr)
            if not targets:
                print(f"{Fore.RED}Invalid CIDR")
                time.sleep(1)
                continue
            
            ports_input = input(f"{Fore.CYAN}Select ports (default 80,443,8080): ")
            ports = [int(p.strip()) for p in ports_input.split(",")] if ports_input else [80, 443, 8080]
            
            scanner = Scanner(targets, ports)
            asyncio.run(scanner.run())
            input("\nPress Enter to return...")

        elif choice == '2':
            path = input(f"{Fore.CYAN}Enter TXT file path: ")
            if not os.path.exists(path):
                print(f"{Fore.RED}File not found")
                time.sleep(1)
                continue
                
            with open(path, "r") as f:
                targets = list(set([line.strip() for line in f if line.strip()]))
            
            ports_input = input(f"{Fore.CYAN}Select ports (default 80,443,8080): ")
            ports = [int(p.strip()) for p in ports_input.split(",")] if ports_input else [80, 443, 8080]
            
            scanner = Scanner(targets, ports)
            asyncio.run(scanner.run())
            input("\nPress Enter to return...")

        elif choice == '3':
            if os.path.exists("scan_checkpoint.json"):
                with open("scan_checkpoint.json", "r") as f:
                    cp = json.load(f)
                print(f"{Fore.GREEN}Resuming from index {cp['index']}...")
                scanner = Scanner(cp['targets'], cp['ports'])
                scanner.results = cp['results']
                asyncio.run(scanner.run(start_index=cp['index']))
            else:
                print(f"{Fore.RED}No checkpoint found")
            time.sleep(1)

        elif choice == '4':
            print(f"\n{Fore.CYAN}Saved scan files in current directory:")
            files = [f for f in os.listdir('.') if f.endswith(('.txt', '.json'))]
            for f in files: print(f" - {f}")
            input("\nPress Enter to return...")

        elif choice == '0':
            sys.exit()

if __name__ == "__main__":
    try:
        main_menu()
    except KeyboardInterrupt:
        print(f"\n{Fore.RED}Interrupted by user. Exiting...")
        sys.exit()
