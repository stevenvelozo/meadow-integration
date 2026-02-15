#!/bin/bash
# Example 003: CSV Transform (CLI Options)
# -----------------------------------------
# Transform a CSV file into a comprehension using command-line options to
# control the entity name, GUID template, and column mappings.
#
# This gives you explicit control over:
#   -e  Entity name (what this data represents)
#   -n  GUID column name in the output
#   -g  GUID template (Pict template using column values)
#
# Usage:  ./Example-003-CSV-Transform-CLI-Options.sh
# Output: examples/output/books-cli-comprehension.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/../source/cli/Meadow-Integration-CLI-Run.js"
DATA_DIR="${SCRIPT_DIR}/../docs/examples/data"
OUTPUT_DIR="${SCRIPT_DIR}/output"

echo "=== Example 003: CSV Transform (CLI Options) ==="
echo ""
echo "Transforming books.csv with explicit CLI options..."
echo "  Entity: Book"
echo "  GUID Column: GUIDBook"
echo "  GUID Template: Book_{~D:Record.id~}"
echo ""

node "${CLI}" csvtransform "${DATA_DIR}/books.csv" \
	-e "Book" \
	-n "GUIDBook" \
	-g "Book_{~D:Record.id~}" \
	-o "${OUTPUT_DIR}/books-cli-comprehension.json"

echo ""
echo "Comprehension written to: examples/output/books-cli-comprehension.json"
echo ""
echo "Each record in the comprehension now has:"
echo "  - A GUIDBook field with values like 'Book_1', 'Book_2', etc."
echo "  - All original CSV columns as additional fields"
