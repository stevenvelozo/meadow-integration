# Mapping Demo

A self-contained example application that demonstrates the full
`meadow-integration` data pipeline:

```
CSV file  →  Parse  →  Map  →  TabularTransform  →  Comprehension  →  IntegrationAdapter  →  Meadow DB
```

## What it demonstrates

| Stage | Component | Description |
|---|---|---|
| Parse | CSV reader | Reads `data/books-sample.csv` into raw record objects |
| Map | Mapping JSON | Declares how CSV columns become entity fields via Pict templates |
| Transform | `TabularTransform` | Applies the mapping to every record, produces a GUID-keyed comprehension |
| Load | `IntegrationAdapter` | Upserts comprehension records into a Meadow REST API (idempotent) |
| Verify | `meadow-endpoints` | Reads records back through the auto-generated Book REST API |

The demo uses an **in-memory SQLite database** so nothing is written to disk.

## Running

From the `meadow-integration` module root, install dependencies once:

```sh
npm install
```

Then start the demo server:

```sh
cd example-applications/mapping-demo
node server.js
```

Open **http://localhost:8092/** in your browser and click through each pipeline step.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Pipeline demo web UI |
| `GET` | `/1.0/Demo/Status` | Server status and endpoint list |
| `GET` | `/1.0/Demo/SampleData` | Raw parsed CSV records |
| `GET` | `/1.0/Demo/Mapping` | Current mapping configuration |
| `POST` | `/1.0/Demo/Transform` | Run mapping → comprehension |
| `POST` | `/1.0/Demo/Load` | Push comprehension via IntegrationAdapter |
| `GET` | `/1.0/Demo/Books` | Read loaded books from database |
| `GET` | `/1.0/Books/0/20` | Meadow-Endpoints live Book list |
| `GET` | `/1.0/Books/Count` | Record count |

## Sample data

`data/books-sample.csv` contains 20 well-known books with these columns:

```
id, title, original_publication_year, isbn, language_code
```

## Mapping configuration

`mappings/books-to-book.json` maps the CSV columns to the `Book` entity
(from the retold-harness bookstore schema):

```json
{
    "Entity": "Book",
    "GUIDTemplate": "DemoBook-{~D:Record.id~}",
    "Mappings": {
        "Title":           "{~D:Record.title~}",
        "Language":        "{~D:Record.language_code~}",
        "PublicationYear": "{~D:Record.original_publication_year~}",
        "ISBN":            "{~D:Record.isbn~}",
        "Genre":           "Classic",
        "Type":            "Fiction",
        "ImageURL":        ""
    }
}
```

The `GUIDTemplate` uses `Record.id` from the source CSV to generate a stable
external GUID (`DemoBook-1`, `DemoBook-2`, …). The `IntegrationAdapter`
tracks these in a `GUIDMap` so repeat loads are safe upserts.

## Architecture

```
server.js
├── SQLite (in-memory)          ← meadow-connection-sqlite
├── Meadow DAL (Book entity)    ← meadow + inline schema
├── meadow-endpoints (Book)     ← auto-generates /1.0/Book(s) REST routes
├── Demo pipeline endpoints     ← /1.0/Demo/*
│   ├── TabularTransform        ← parse + map = comprehension
│   └── IntegrationAdapter      ← comprehension → upsert via REST
└── Static web UI               ← web/index.html
```

All components run on a single Orator (Restify) server at port 8092.
