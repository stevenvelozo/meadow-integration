#!/bin/bash
# Example 008: Comprehension to CSV
# ------------------------------------
# Export a comprehension back to CSV format.  This is useful for:
#   - Sharing data with tools that expect CSV input
#   - Reviewing merged/transformed data in a spreadsheet
#   - Round-tripping data through the integration pipeline
#
# Workflow:
#   1. CSV -> Comprehension (csvtransform with mapping file)
#   2. Object Comprehension -> Array (comprehensionarray)
#   3. Array -> CSV (objectarraytocsv)
#
# Usage:  ./Example-008-Comprehension-To-CSV.sh
# Output: examples/output/books-export.csv

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/../source/cli/Meadow-Integration-CLI-Run.js"
DATA_DIR="${SCRIPT_DIR}/../docs/examples/data"
MAPPING_DIR="${SCRIPT_DIR}/../docs/examples/bookstore"
OUTPUT_DIR="${SCRIPT_DIR}/output"

echo "=== Example 008: Comprehension to CSV ==="
echo ""

# Step 1: Create a Book comprehension (object format)
echo "--- Step 1: Create a Book comprehension ---"
node "${CLI}" csvtransform "${DATA_DIR}/books.csv" \
	-m "${MAPPING_DIR}/mapping_books_Book.json" \
	-o "${OUTPUT_DIR}/books-for-csv.json"
echo ""

# Step 2: Convert to array format (objectarraytocsv needs an array)
echo "--- Step 2: Convert object comprehension to array ---"
node "${CLI}" comprehensionarray "${OUTPUT_DIR}/books-for-csv.json" \
	-e "Book" \
	-o "${OUTPUT_DIR}/books-array-for-csv.json"
echo ""

# Step 3: Export array to CSV
# objectarraytocsv reads a plain JSON array and writes CSV
echo "--- Step 3: Export array to CSV ---"
node "${CLI}" objectarraytocsv "${OUTPUT_DIR}/books-array-for-csv.json" \
	-o "${OUTPUT_DIR}/books-export.csv"
echo ""

LINECOUNT=$(wc -l < "${OUTPUT_DIR}/books-export.csv")
echo "CSV exported to: examples/output/books-export.csv (${LINECOUNT} lines)"
echo ""
echo "First 3 lines of output:"
head -3 "${OUTPUT_DIR}/books-export.csv"
