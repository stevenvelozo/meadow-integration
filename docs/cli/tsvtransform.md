# tsvtransform

Transform a TSV (tab-separated values) file into a Comprehension JSON file. This command works identically to [csvtransform](csvtransform.md) but uses a tab character as the column delimiter instead of a comma.

**Aliases:** `tsv_t`, `tsv_transform`

## Usage

```shell
mdwint tsvtransform <file> [options]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<file>` | Yes | Path to the TSV file to transform |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --entity <name>` | Entity name in the Comprehension | Auto-detected from filename |
| `-n, --guidname <name>` | Name of the GUID column in the generated Comprehension | `GUID<Entity>` |
| `-g, --guidtemplate <template>` | Pict template for generating the entity GUID | `GUID-<Entity>-{~Data:Record.<first_column>~}` |
| `-c, --columns <mappings>` | Inline column mappings in `Key={~D:col~}` format | Auto-detected 1:1 mapping |
| `-m, --mappingfile <path>` | Path to a JSON mapping file | -- |
| `-i, --incoming <path>` | Existing Comprehension file to merge into | -- |
| `-o, --output <path>` | Output file path | `./TSV-Comprehension-<filename>.json` |
| `-x, --extended` | Output full operation state, not just the Comprehension | `false` |
| `-q, --quotedelimiter <char>` | Quote delimiter character for TSV parsing | `"` |

## Configuration Priority

The same three-layer configuration priority applies as with `csvtransform`:

1. **Implicit** -- Auto-detected from the first TSV row
2. **Explicit** -- Loaded from a mapping file via `-m`
3. **User** -- Command-line options (`-e`, `-n`, `-g`, `-c`)

Each layer overrides the previous.

## Output Format

The output is a standard Comprehension JSON object, identical in format to `csvtransform` output:

```json
{
  "Airport": {
    "Airport-SEA": {
      "GUIDAirport": "Airport-SEA",
      "Code": "SEA",
      "Name": "Seattle Tacoma International",
      "City": "Seattle",
      "State": "WA"
    }
  }
}
```

## Examples

### Basic TSV transform with a mapping file

Given a TSV file `airports.tsv` with columns `iata`, `name`, `city`, `state`, `country`, `lat`, `long`:

```shell
mdwint tsvtransform ./data/airports.tsv \
  -m mapping_Airport.json \
  -o airports.json
```

Where `mapping_Airport.json` contains:

```json
{
  "Entity": "Airport",
  "GUIDTemplate": "Airport-{~D:Record.iata~}",
  "Mappings": {
    "Code": "{~D:Record.iata~}",
    "Name": "{~D:Record.name~}",
    "Description": "{~D:Record.name~} airport in {~D:Record.city~}",
    "City": "{~D:Record.city~}",
    "State": "{~D:Record.state~}",
    "Country": "{~D:Record.country~}",
    "Latitude": "{~D:Record.lat~}",
    "Longitude": "{~D:Record.long~}"
  }
}
```

### Transform with CLI options

```shell
mdwint tsvtransform ./data/airports.tsv \
  -e Airport \
  -n GUIDAirport \
  -g "Airport-{~D:Record.iata~}" \
  -c "Code={~D:Record.iata~},Name={~D:Record.name~},City={~D:Record.city~},State={~D:Record.state~},Country={~D:Record.country~},Latitude={~D:Record.lat~},Longitude={~D:Record.long~}" \
  -o airports.json
```

### Implicit transform (auto-detect everything)

```shell
mdwint tsvtransform ./data/airports.tsv -o airports.json
```

### Merge into an existing Comprehension

```shell
mdwint tsvtransform ./data/airports.tsv \
  -m mapping_Airport.json \
  -i existing-comprehension.json \
  -o existing-comprehension.json
```

### Extended output for debugging

```shell
mdwint tsvtransform ./data/airports.tsv \
  -m mapping_Airport.json \
  -x \
  -o debug-airports.json
```

## Tips

- TSV files are common exports from spreadsheet applications and database tools. The tab delimiter avoids issues with commas embedded in field values.
- The quote delimiter defaults to `"` but can be changed with `-q`. TSV files often do not use quote delimiters at all; if your file has no quoting, you can leave the default.
- All other behavior, including duplicate GUID merging, multi-entity support, and Solver expressions, works identically to `csvtransform`.
- Inline column mappings (`-c`) do not support commas or equal signs within template values. Use a mapping file for complex mappings.

## Notes

- The default output filename pattern is `./TSV-Comprehension-<filename>.json` (note the `TSV-` prefix rather than `CSV-`).
- The delimiter is set to `\t` internally. You do not need to specify it.

## See Also

- [csvtransform](csvtransform.md) -- Comma-delimited equivalent
- [jsonarraytransform](jsonarraytransform.md) -- JSON array equivalent
- [Mapping Files](../mapping-files.md) -- Full mapping file specification
- [Comprehensions](../comprehensions.md) -- Core data structure documentation
