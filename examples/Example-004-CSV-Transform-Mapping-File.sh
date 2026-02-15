#!/bin/bash
# Example 004: CSV Transform (Mapping File)
# ------------------------------------------
# Transform a CSV file using a mapping file for precise control over
# which columns are extracted and how they are named.
#
# The mapping file (mapping_books_Book.json) defines:
#   Entity       - The entity name
#   GUIDTemplate - How to generate unique IDs
#   Mappings     - Column name -> Pict template pairs
#
# This is the recommended approach for production data integration.
#
# Usage:  ./Example-004-CSV-Transform-Mapping-File.sh
# Output: examples/output/books-mapped-comprehension.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/../source/cli/Meadow-Integration-CLI-Run.js"
DATA_DIR="${SCRIPT_DIR}/../docs/examples/data"
MAPPING_DIR="${SCRIPT_DIR}/../docs/examples/bookstore"
OUTPUT_DIR="${SCRIPT_DIR}/output"

echo "=== Example 004: CSV Transform (Mapping File) ==="
echo ""
echo "Transforming books.csv using mapping_books_Book.json..."
echo ""
echo "Mapping file contents:"
cat "${MAPPING_DIR}/mapping_books_Book.json"
echo ""
echo ""

node "${CLI}" csvtransform "${DATA_DIR}/books.csv" \
	-m "${MAPPING_DIR}/mapping_books_Book.json" \
	-o "${OUTPUT_DIR}/books-mapped-comprehension.json"

echo ""
echo "Comprehension written to: examples/output/books-mapped-comprehension.json"
echo ""
echo "Notice the output only contains the mapped fields:"
echo "  Title, Language, PublicationYear, ISBN, Genre, Type, ImageURL"
echo "  (not all 23 original CSV columns)"
