# comprehensionintersect

Merge two Comprehension JSON files together. Records with the same GUID in both files are merged, with values from the secondary file overwriting values in the primary file. This is useful when the same entities have data spread across multiple source files.

**Aliases:** `intersect`

## Usage

```shell
mdwint comprehensionintersect <primary_file> [options]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<primary_file>` | Yes | Path to the primary Comprehension file |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --intersect <path>` | Path to the secondary Comprehension file to merge with the primary | (required) |
| `-e, --entity <name>` | Entity name to merge | Auto-detected from the first key of the primary Comprehension |
| `-o, --output <path>` | Output file path | `./Intersected-Comprehension-<filename>.json` |

## How Merging Works

The intersect operation iterates over every record in the secondary Comprehension and matches it to the primary Comprehension by GUID:

- **Matching GUID found in primary**: The record fields are merged. Fields from the secondary file overwrite fields in the primary file. Fields that exist only in the primary are preserved.
- **No matching GUID in primary**: The record from the secondary file is added to the result.
- **GUID exists only in primary**: The record is preserved as-is in the output.

This behavior makes `comprehensionintersect` ideal for enriching records with data from additional sources.

## Output Format

The output is a standard Comprehension JSON object containing the merged records:

```json
{
  "Neighborhood": {
    "Capitol Hill": {
      "GUIDNeighborhood": "Capitol Hill",
      "MedianHomeValue": "625000",
      "MedianRent": "1850",
      "Population": "32000",
      "MedianAge": "33"
    }
  }
}
```

## Examples

### Basic intersection

```shell
mdwint comprehensionintersect set1.json \
  -i set2.json \
  -e Document \
  -o merged.json
```

### Auto-detect entity name

```shell
mdwint comprehensionintersect set1.json \
  -i set2.json \
  -o merged.json
```

If `-e` is omitted, the entity name is inferred from the first key in the primary Comprehension file.

### Chain multiple intersections

When you have data spread across three or more source files, chain the intersect operations:

```shell
# Step 1: Transform each source to a Comprehension
mdwint csvtransform housing_chars.csv \
  -e Neighborhood -n GUIDNeighborhood \
  -g "{~D:Record.Neighborhood Name~}" \
  -o set_chars.json

mdwint csvtransform housing_costs.csv \
  -e Neighborhood -n GUIDNeighborhood \
  -g "{~D:Record.Neighborhood Name~}" \
  -o set_costs.json

mdwint csvtransform demographics.csv \
  -e Neighborhood -n GUIDNeighborhood \
  -g "{~D:Record.Neighborhood Name~}" \
  -o set_demographics.json

# Step 2: Merge the first two
mdwint comprehensionintersect set_chars.json \
  -i set_costs.json \
  -e Neighborhood \
  -o merged.json

# Step 3: Merge the third into the result
mdwint comprehensionintersect merged.json \
  -i set_demographics.json \
  -e Neighborhood \
  -o merged.json
```

### Using the alias

```shell
mdwint intersect primary.json -i secondary.json -o result.json
```

## Tips

- The GUID template must be identical across the source Comprehensions for records to match. Use the same `-g` value or the same mapping file GUID template when generating the source Comprehensions.
- The secondary file's values overwrite the primary file's values for matching fields. If you want the primary's values to take priority, swap the file arguments.
- You can intersect Comprehensions that were generated from different file formats (e.g., one from CSV, one from TSV, one from JSON array).
- For large merge operations with many source files, consider writing a shell script that chains the intersect calls sequentially.

## Notes

- The `-i` option is required. The command will error if no secondary Comprehension file is specified.
- If no entity is specified and the primary Comprehension has multiple entity keys, the first key is used.
- The output file can be the same as one of the input files, allowing in-place merge operations.

## See Also

- [csvtransform](csvtransform.md) -- Generate Comprehensions from CSV files
- [Comprehensions](../comprehensions.md) -- Core data structure and merging concepts
