#!/bin/bash
# Example 002: CSV Transform (Implicit Configuration)
# ----------------------------------------------------
# Transform a CSV file into a comprehension using auto-detected settings.
# When no mapping file or explicit options are provided, meadow-integration
# will infer the entity name from the filename and create a 1:1 column mapping.
#
# Usage:  ./Example-002-CSV-Transform-Implicit.sh
# Output: examples/output/books-implicit-comprehension.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/../source/cli/Meadow-Integration-CLI-Run.js"
DATA_DIR="${SCRIPT_DIR}/../docs/examples/data"
OUTPUT_DIR="${SCRIPT_DIR}/output"

echo "=== Example 002: CSV Transform (Implicit Configuration) ==="
echo ""
echo "Transforming books.csv into a comprehension with auto-detected settings..."
echo "(Entity name and GUID will be derived from the file name and first column)"
echo ""

node "${CLI}" csvtransform "${DATA_DIR}/books.csv" \
	-o "${OUTPUT_DIR}/books-implicit-comprehension.json"

echo ""
echo "Comprehension written to: examples/output/books-implicit-comprehension.json"
echo ""
echo "The implicit configuration:"
echo "  - Entity name derived from the CSV filename"
echo "  - GUID generated from the first column value"
echo "  - All columns mapped 1:1 to comprehension fields"
