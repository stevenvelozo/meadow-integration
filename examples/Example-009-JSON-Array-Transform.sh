#!/bin/bash
# Example 009: JSON Array Transform
# -----------------------------------
# Transform a JSON array file into a comprehension.
# This works just like csvtransform but reads from a JSON array
# instead of a CSV file.
#
# This example first creates a JSON array from book data,
# then re-transforms it using the jsonarraytransform command.
#
# Usage:  ./Example-009-JSON-Array-Transform.sh
# Output: examples/output/books-from-json.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/../source/cli/Meadow-Integration-CLI-Run.js"
DATA_DIR="${SCRIPT_DIR}/../docs/examples/data"
MAPPING_DIR="${SCRIPT_DIR}/../docs/examples/bookstore"
OUTPUT_DIR="${SCRIPT_DIR}/output"

echo "=== Example 009: JSON Array Transform ==="
echo ""

# Step 1: First create a JSON array from the books CSV
echo "--- Step 1: Create a source JSON array ---"
node "${CLI}" csvtransform "${DATA_DIR}/books.csv" \
	-e "Book" -n "GUIDBook" -g "Book_{~D:Record.id~}" \
	-o "${OUTPUT_DIR}/books-object-source.json"

node "${CLI}" comprehensionarray "${OUTPUT_DIR}/books-object-source.json" \
	-e "Book" \
	-o "${OUTPUT_DIR}/books-json-array-source.json"
echo ""

# Step 2: Transform the JSON array into a new comprehension with mapping
echo "--- Step 2: Transform JSON array with mapping file ---"
node "${CLI}" jsonarraytransform "${OUTPUT_DIR}/books-json-array-source.json" \
	-m "${MAPPING_DIR}/mapping_books_Book.json" \
	-o "${OUTPUT_DIR}/books-from-json.json"
echo ""

echo "Comprehension from JSON array written to: examples/output/books-from-json.json"
echo ""
echo "jsonarraytransform supports the same options as csvtransform:"
echo "  -e, -n, -g, -c for CLI options"
echo "  -m for mapping files"
echo "  -i for incoming comprehension merging"
