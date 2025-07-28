# Multi Set Integration Example

So we have multiple CSV files and their records connect based on a matching column across them.

## Step 1: Generate the Object Comprehension for the first file

We want to generate the comprehensions with row uniqueness based on the common key between them.  We can do that easily with the `csvtransform` command.

```shell
npx meadow-integration csvtransform ~/FortWorthDocuments.csv -n "GUIDDocument" -g "{~D:Record.IDDocument~}" -e "Document" -o Set1.json
```

What does this do?  Let's walk through the parameters:

### Part 1: Running the command: `npx meadow-integration csvtransform `

This executes the `meadow-integration` utility and tells it to execute the `csvtransform` command which extracts a comprehension from a CSV files.

### Part 2: Telling it the input file: ... `~/FortWorthDocuments.csv `

This tells the csvtransform command to load the `~/FortWorthDocuments.csv` file.

### Part 3: Defining the GUID Column Name: ... `-n "GUIDDocument" `

For comprehensions expected to be used either in Upsert operations and/or interconnected with other data sets, this defines the GUID column name within the record.  This is a column created *on top of* the other columns defined as the record's data.

### Part 4: Defining the template for the GUID Column Contents: ... `-g "{~D:Record.IDDocument~} " `

This allows us to easily create combinatorial keys within the record.  It's a pict template with access to the entire Record (the row) having named properties based on the CSV header.  In this case we are just using a single value, that maps across the two files.

### Part 5: Defining the common Entity for the Comprehension: ... `-e "Document" `

Because comprehensions can store multiple entities, we want to make sure the two share an entity type.

### Part 5: Telling it the output file name: ... `-o Set1.json`

This tells it where to write the comprehension JSON.  To aid in speed, this generates a comprehension that is an object map where the GUID is the property name for subobjects with each record.

## Step 2: Generate the Object Comprehension for the second file

This performs the same operation for the second file in the set.

```shell
npx meadow-integration csvtransform ~/FortWorthDocumentDataAnalysis.csv -n "GUIDDocument" -g "{~D:Record.IDDocument~}" -e "Document" -o Set2.json
```

## Step 3: Merge the Two Object Comprehensions Together

This command takes the two `Document` comprehensions we generated above and merges them together as one simple Document

```shell
npx meadow-integration comprehensionintersect ./Set1.json -i Set2.json -e "Document"
```

## Step 4: Convert the Object Comprehension to an Array Comprehension