# Meadow Integration Examples

Runnable examples demonstrating meadow-integration features.  Each example can be run from this directory and writes output to the `output/` folder.

## Prerequisites

```shell
cd ..
npm install
```

## Examples

| # | File | Description |
|---|------|-------------|
| 001 | `Example-001-CSV-Check.sh` | Analyze a CSV file structure and column statistics |
| 002 | `Example-002-CSV-Transform-Implicit.sh` | Auto-detect entity and columns from a CSV |
| 003 | `Example-003-CSV-Transform-CLI-Options.sh` | Use CLI flags to control entity name and GUID template |
| 004 | `Example-004-CSV-Transform-Mapping-File.sh` | Use a JSON mapping file for precise column control |
| 005 | `Example-005-Multi-Entity-Bookstore.sh` | Build Book, Author, and BookAuthorJoin from one CSV |
| 006 | `Example-006-Multi-CSV-Intersect.sh` | Merge three Seattle neighborhood CSVs by common key |
| 007 | `Example-007-Comprehension-To-Array.sh` | Convert object-keyed comprehension to a JSON array |
| 008 | `Example-008-Comprehension-To-CSV.sh` | Full round-trip: CSV to comprehension back to CSV |
| 009 | `Example-009-JSON-Array-Transform.sh` | Transform a JSON array file into a comprehension |
| 010 | `Example-010-Programmatic-API.js` | Use the services directly in Node.js code |

## Running

```shell
# Run a single example
./Example-001-CSV-Check.sh

# Run the Node.js programmatic example
node Example-010-Programmatic-API.js
```

Output files are written to `output/` and ignored by git.

## Data Sources

Examples use data from `../docs/examples/data/`:

- **books.csv** -- 10,000 book records from Goodreads (id, title, author, isbn, ratings, etc.)
- **seattle_neighborhoods/** -- Three Seattle ACS census datasets that share a Neighborhood Name column
