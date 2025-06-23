# Meadow Integration

A suite of tools for managing data into a centralized non-specific schema format.

These tools are built to be usable from the command-line, as a web service, or within your own codebase.  This code repository presents these behaviors both as a suite of externally usable fable services, a command-line utility to leverage them and a set of web service behaviors.

## CSV Stuff

So you like the CSV format?  So does this utility.

You can try out what it can do to provide stats on CSVs by running the following from the repository root:

```shell
 npm start -- csvcheck ./documentation/examples/data/housing_costs_Neighborhoods_-8848403750169343217.csv
 ```