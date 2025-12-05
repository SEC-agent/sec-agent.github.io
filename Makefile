.PHONY: serve clean help convert

# Default target
help:
	@echo "SEC-Agent GitHub.io - Build Commands"
	@echo ""
	@echo "Available commands:"
	@echo "  make serve              - Serve site locally at http://localhost:8000"
	@echo "  make serve-chromium     - Serve chromium viewer at http://localhost:8001"
	@echo "  make serve-trajectory   - Serve trajectory viewer at http://localhost:8002"
	@echo "  make clean              - Remove temporary files"
	@echo ""
	@echo "Conversion commands (requires cryptography library):"
	@echo "  make convert-trajectory SRC=<path> KEY=<password>"
	@echo "                          - Convert trajectory file(s) to encrypted dataset"
	@echo ""
	@echo "Examples:"
	@echo "  make serve"
	@echo "  make convert-trajectory SRC=../data/trajectories/ KEY=mypassword"
	@echo "  make convert-trajectory SRC=../data/session.jsonl KEY=mypassword"
	@echo ""

# Serve entire site locally
serve:
	@echo ""
	@echo "Starting local server at http://localhost:8000"
	@echo "  - Chromium viewer: http://localhost:8000/chromium/"
	@echo "  - Trajectory viewer: http://localhost:8000/trajectory/"
	@echo "Press Ctrl+C to stop"
	@echo ""
	python3 -m http.server 8000

# Serve chromium viewer
serve-chromium:
	@echo ""
	@echo "Starting chromium viewer at http://localhost:8001"
	@echo "Press Ctrl+C to stop"
	@echo ""
	cd chromium && python3 -m http.server 8001

# Serve trajectory viewer
serve-trajectory:
	@echo ""
	@echo "Starting trajectory viewer at http://localhost:8002"
	@echo "Press Ctrl+C to stop"
	@echo ""
	cd trajectory && python3 -m http.server 8002

# Clean temporary files
clean:
	@echo "Cleaning temporary files..."
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name ".DS_Store" -delete
	@echo "Done!"

