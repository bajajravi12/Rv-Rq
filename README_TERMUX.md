# RV-RQ Scanner Implementation for Termux

This tool is designed for high-speed infrastructure inventory and service visibility on Termux (Android).

## Installation

1. Open Termux on your Android device.
2. Update packages and install Python:
   ```bash
   pkg update && pkg upgrade
   pkg install python
   ```
3. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the tool:
   ```bash
   python rv_rq_scanner.py
   ```

## Requirements
- Python 3.9+
- Internet access
- Recommended: 6GB+ RAM for large scans

## Features
- **CIDR Scan**: Automatically expands CIDR ranges (e.g., /24).
- **Service Discovery**: Detects HTTP/HTTPS, Status codes, Server headers.
- **Async Concurrency**: Built with `asyncio` for maximum speed.
- **Checkpoint System**: Allows resuming interrupted scans.

## Authorized Use Only
This tool is for authorized infrastructure testing and inventory management. Do not use for unauthorized or malicious activities.
