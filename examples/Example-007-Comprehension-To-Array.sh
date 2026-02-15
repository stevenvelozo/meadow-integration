#!/bin/bash
# Example 007: Comprehension to Array
# -------------------------------------
# Convert an object-keyed comprehension into a JSON array.
# Comprehensions store records as { GUID: record } objects for
# fast lookup and merging.  But sometimes you need a plain array,
# for instance to feed into a UI table or export to CSV.
#
# This example first creates a Book comprehension, then converts
# it from the object format to an array format.
#
# Usage:  ./Example-007-Comprehension-To-Array.sh
# Output: examples/output/books-array.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/../source/cli/Meadow-Integration-CLI-Run.js"
DATA_DIR="${SCRIPT_DIR}/../docs/examples/data"
MAPPING_DIR="${SCRIPT_DIR}/../docs/examples/bookstore"
OUTPUT_DIR="${SCRIPT_DIR}/output"

echo "=== Example 007: Comprehension to Array ==="
echo ""

# Step 1: Create a Book comprehension
echo "--- Step 1: Create a Book comprehension ---"
node "${CLI}" csvtransform "${DATA_DIR}/books.csv" \
	-m "${MAPPING_DIR}/mapping_books_Book.json" \
	-o "${OUTPUT_DIR}/books-for-array.json"
echo ""

# Step 2: Convert from object comprehension to array
echo "--- Step 2: Convert to array format ---"
node "${CLI}" comprehensionarray "${OUTPUT_DIR}/books-for-array.json" \
	-e "Book" \
	-o "${OUTPUT_DIR}/books-array.json"
echo ""

echo "Array comprehension written to: examples/output/books-array.json"
echo ""
echo "Object format:  { 'Book': { 'Book_1': {...}, 'Book_2': {...} } }"
echo "Array format:   [ {...}, {...}, ... ]"
