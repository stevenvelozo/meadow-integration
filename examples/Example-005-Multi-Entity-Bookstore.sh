#!/bin/bash
# Example 005: Multi-Entity Bookstore Integration
# -------------------------------------------------
# Build a complete multi-entity comprehension from a single CSV file.
# This demonstrates how one CSV can produce multiple entity types
# using different mapping files.
#
# The books.csv file contains book data with authors in a single column.
# We use three mapping files to extract:
#   1. Book      - Basic book information
#   2. Author    - Unique author names (using Solvers to split comma-separated authors)
#   3. BookAuthorJoin - Many-to-many relationship between books and authors
#
# Each transform pass adds its entity to the same comprehension file
# by using the -i flag to pass in the existing comprehension.
#
# Usage:  ./Example-005-Multi-Entity-Bookstore.sh
# Output: examples/output/bookstore-comprehension.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/../source/cli/Meadow-Integration-CLI-Run.js"
DATA_DIR="${SCRIPT_DIR}/../docs/examples/data"
MAPPING_DIR="${SCRIPT_DIR}/../docs/examples/bookstore"
OUTPUT_DIR="${SCRIPT_DIR}/output"
COMP_FILE="${OUTPUT_DIR}/bookstore-comprehension.json"

echo "=== Example 005: Multi-Entity Bookstore ==="
echo ""

# Step 1: Create the Book entity comprehension
echo "--- Step 1: Creating Book entities ---"
node "${CLI}" csvtransform "${DATA_DIR}/books.csv" \
	-m "${MAPPING_DIR}/mapping_books_Book.json" \
	-o "${COMP_FILE}"
echo ""

# Step 2: Add the Author entities to the same comprehension
echo "--- Step 2: Adding Author entities ---"
echo "(Uses Solvers to split comma-separated author names into individual records)"
node "${CLI}" csvtransform "${DATA_DIR}/books.csv" \
	-m "${MAPPING_DIR}/mapping_books_Author.json" \
	-i "${COMP_FILE}" \
	-o "${COMP_FILE}"
echo ""

# Step 3: Add the BookAuthorJoin entities to complete the comprehension
echo "--- Step 3: Adding BookAuthorJoin entities ---"
echo "(Creates a join record for every book-author pair)"
node "${CLI}" csvtransform "${DATA_DIR}/books.csv" \
	-m "${MAPPING_DIR}/mapping_books_BookAuthorJoin.json" \
	-i "${COMP_FILE}" \
	-o "${COMP_FILE}"
echo ""

echo "Complete bookstore comprehension written to: examples/output/bookstore-comprehension.json"
echo ""
echo "The comprehension contains three entity types:"
echo "  - Book: One record per book"
echo "  - Author: One record per unique author"
echo "  - BookAuthorJoin: One record per book-author relationship"
