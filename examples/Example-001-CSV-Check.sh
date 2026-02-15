#!/bin/bash
# Example 001: CSV Check
# ---------------------
# Analyze a CSV file to get statistics about its structure and contents.
# This is typically the first step when working with a new data set.
#
# Usage:  ./Example-001-CSV-Check.sh
# Output: examples/output/books-stats.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/../source/cli/Meadow-Integration-CLI-Run.js"
DATA_DIR="${SCRIPT_DIR}/../docs/examples/data"
OUTPUT_DIR="${SCRIPT_DIR}/output"

echo "=== Example 001: CSV Check ==="
echo ""
echo "Running csvcheck on books.csv to gather statistics..."
echo ""

node "${CLI}" csvcheck "${DATA_DIR}/books.csv" \
	-o "${OUTPUT_DIR}/books-stats.json"

echo ""
echo "Statistics written to: examples/output/books-stats.json"
echo ""
echo "You can examine the output file to see:"
echo "  - Row and column counts"
echo "  - Column headers"
echo "  - Per-column statistics (empty counts, numeric counts, first/last values)"
