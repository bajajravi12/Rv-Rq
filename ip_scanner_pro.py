import os
import sys
import time
import json
import socket
import requests
import concurrent.futures
from datetime import datetime
from ipaddress import IPv4Address
from colorama import Fore, Style, init

# Init colorama
init(autoreset=True)

# ════════════════════════════════════════════════════════════
# CORE CONFIG & BANNER
# ════════════════════════════════════════════════════════════

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
║         ⚡ ELITE IP SCANNER PRO ⚡        ║
║                                            ║
╚════════════════════════════════════════════╝
{Fore.WHITE}      ULTRA-SPEED TUNNELING BUG FINDER
"""

class IPScannerPro:
    def __init__(self, start_ip, end_ip, port, threads):
        self.start_ip = IPv4Address(start_ip)
        self.end_ip = IPv4Address(end_ip)
        self.port = port
        self.threads = threads
        self.scanned = 0
        self.hits = 0
        self.total = int(self.end_ip) - int(self.start_ip) + 1
        self.results_file = "ip_results.txt"
        self.headers = {
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "*/*"
        }
        
    def generate_ips(self):
        for ip_int in range(int(self.start_ip), int(self.end_ip) + 1):
            yield str(IPv4Address(ip_int))

    def print_hit(self, ip, server, status, ts):
        # The specific visual block requested
        print(f"\n{Fore.GREEN}============================================================")
        print(f"{Fore.GREEN}✓  {Fore.WHITE}HIT {Fore.GREEN}[{ts}]")
        print(f"   {Fore.GREEN}Proxy  : {Fore.WHITE}{Style.BRIGHT}{ip}:{self.port}")
        print(f"   {Fore.WHITE}Server : {server}")
        print(f"   {Fore.WHITE}Status : {Fore.RED}{Style.BRIGHT}{status}")
        print(f"{Fore.GREEN}============================================================\n")
        
        # Save to file
        with open(self.results_file, "a") as f:
            f.write(f"{ip}:{self.port} | {server} | {status} | {ts}\n")

    def check_ip(self, ip):
        url = f"{'https' if self.port == 443 else 'http'}://{ip}:{self.port}"
        ts = datetime.now().strftime("%H:%M:%S")
        
        try:
            # Disable warnings for SSL
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            
            response = requests.get(
                url, 
                headers=self.headers, 
                timeout=0.8, 
                verify=False, 
                allow_redirects=False
            )
            
            status = response.status_code
            server = response.headers.get("Server", "Unknown")
            is_hit = False
            
            # Deep Signature Analysis
            # 1. 101 Switching Protocols (Gold Standard)
            if status == 101:
                is_hit = True
            # 2. CloudFront / Edge Detection
            elif "cloudfront" in server.lower() or "edge" in server.lower():
                is_hit = True
            # 3. Specific Tunneling Indicators (Websocket upgrade accepted)
            elif response.headers.get("Upgrade", "").lower() == "websocket":
                is_hit = True

            if is_hit:
                self.hits += 1
                self.print_hit(ip, server, f"HTTP/1.1 {status} {response.reason}", ts)
            
            # Progress Output (Replicating requested layout)
            pct = (self.scanned / self.total) * 100
            color = Fore.GREEN if status == 101 else Fore.YELLOW if status in [200, 403, 400] else Fore.WHITE
            
            # Formatted log line
            log_line = f"{Fore.WHITE}Progress: {self.scanned}/{self.total} ({pct:.1f}%) [{self.scanned}/{self.total}] {Fore.CYAN}{ip}:{self.port} {color}HTTP/1.1 {status} {response.reason}"
            sys.stdout.write(f"\r{log_line}{Style.RESET_ALL}\n")
            
        except Exception:
            # Silent errors to maintain speed
            pass
        finally:
            self.scanned += 1

    def run(self):
        print(f"\n{Fore.CYAN}╔══════════════ SCAN PREVIEW ══════════════╗")
        print(f"║ {Fore.WHITE}START IP : {self.start_ip:<25} ║")
        print(f"║ {Fore.WHITE}END IP   : {self.end_ip:<25} ║")
        print(f"║ {Fore.WHITE}PORT     : {self.port:<25} ║")
        print(f"║ {Fore.WHITE}THREADS  : {self.threads:<25} ║")
        print(f"║ {Fore.WHITE}TOTAL    : {self.total:<25} ║")
        print(f"{Fore.CYAN}╚══════════════════════════════════════════╝")
        
        confirm = input(f"\n{Fore.YELLOW}Confirm scan? [Y/n]: ").lower()
        if confirm == 'n':
            print(f"{Fore.RED}Scan aborted.")
            return

        print(f"\n{Fore.GREEN}[!] Initializing high-speed engine...\n")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.threads) as executor:
            executor.map(self.check_ip, self.generate_ips())

        print(f"\n{Fore.CYAN}Scan Complete!")
        print(f"{Fore.WHITE}Total Scanned : {self.scanned}")
        print(f"{Fore.GREEN}Valid HITS    : {self.hits}")
        print(f"{Fore.WHITE}Output saved to : {self.results_file}")

# ════════════════════════════════════════════════════════════
# MAIN ENTRY
# ════════════════════════════════════════════════════════════

if __name__ == "__main__":
    try:
        os.system('clear' if os.name == 'posix' else 'cls')
        print(BANNER)
        
        s_ip = input(f"{Fore.CYAN}Start IP : {Fore.WHITE}")
        e_ip = input(f"{Fore.CYAN}End IP   : {Fore.WHITE}")
        port_in = input(f"{Fore.CYAN}Port (443): {Fore.WHITE}")
        port = int(port_in) if port_in else 443
        
        thread_in = input(f"{Fore.CYAN}Threads (150): {Fore.WHITE}")
        threads = int(thread_in) if thread_in else 150
        
        scanner = IPScannerPro(s_ip, e_ip, port, threads)
        scanner.run()
        
    except KeyboardInterrupt:
        print(f"\n{Fore.RED}Control-C detected. Exiting...")
        sys.exit()
    except Exception as e:
        print(f"\n{Fore.RED}Error: {e}")
        sys.exit()
