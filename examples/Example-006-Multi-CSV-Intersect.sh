#!/bin/bash
# Example 006: Multi-CSV Intersect (Seattle Neighborhoods)
# ---------------------------------------------------------
# Merge data from multiple CSV files that share a common key.
# This is a common scenario when data about the same entities
# comes from different sources or different tables.
#
# The Seattle neighborhood data has three CSV files:
#   - housing_characteristics_Neighborhoods.csv
#   - housing_costs_Neighborhoods.csv
#   - race_ethnicity_Neighborhoods.csv
#
# All three share a "Neighborhood Name" column.  We transform
# each into a comprehension keyed on that column, then use
# comprehensionintersect to merge them into one unified dataset.
#
# Usage:  ./Example-006-Multi-CSV-Intersect.sh
# Output: examples/output/seattle-merged.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/../source/cli/Meadow-Integration-CLI-Run.js"
DATA_DIR="${SCRIPT_DIR}/../docs/examples/data/seattle_neighborhoods"
OUTPUT_DIR="${SCRIPT_DIR}/output"

echo "=== Example 006: Multi-CSV Intersect (Seattle Neighborhoods) ==="
echo ""

# Step 1: Transform housing characteristics
echo "--- Step 1: Transform housing characteristics CSV ---"
node "${CLI}" csvtransform "${DATA_DIR}/housing_characteristics_Neighborhoods.csv" \
	-e "Neighborhood" \
	-n "GUIDNeighborhood" \
	-g "{~D:Record.Neighborhood Name~}" \
	-o "${OUTPUT_DIR}/seattle-housing-chars.json"
echo ""

# Step 2: Transform housing costs
echo "--- Step 2: Transform housing costs CSV ---"
node "${CLI}" csvtransform "${DATA_DIR}/housing_costs_Neighborhoods.csv" \
	-e "Neighborhood" \
	-n "GUIDNeighborhood" \
	-g "{~D:Record.Neighborhood Name~}" \
	-o "${OUTPUT_DIR}/seattle-housing-costs.json"
echo ""

# Step 3: Transform race and ethnicity
echo "--- Step 3: Transform race and ethnicity CSV ---"
node "${CLI}" csvtransform "${DATA_DIR}/race_ethnicity_Neighborhoods.csv" \
	-e "Neighborhood" \
	-n "GUIDNeighborhood" \
	-g "{~D:Record.Neighborhood Name~}" \
	-o "${OUTPUT_DIR}/seattle-race-ethnicity.json"
echo ""

# Step 4: Merge housing chars + housing costs
echo "--- Step 4: Intersect housing characteristics with housing costs ---"
node "${CLI}" comprehensionintersect "${OUTPUT_DIR}/seattle-housing-chars.json" \
	-i "${OUTPUT_DIR}/seattle-housing-costs.json" \
	-e "Neighborhood" \
	-o "${OUTPUT_DIR}/seattle-merged.json"
echo ""

# Step 5: Merge the result with race/ethnicity data
echo "--- Step 5: Intersect merged data with race/ethnicity ---"
node "${CLI}" comprehensionintersect "${OUTPUT_DIR}/seattle-merged.json" \
	-i "${OUTPUT_DIR}/seattle-race-ethnicity.json" \
	-e "Neighborhood" \
	-o "${OUTPUT_DIR}/seattle-merged.json"
echo ""

echo "Merged comprehension written to: examples/output/seattle-merged.json"
echo ""
echo "Each neighborhood record now contains columns from all three source CSVs,"
echo "merged by matching Neighborhood Name."
