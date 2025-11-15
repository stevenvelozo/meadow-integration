
node ../../../source/cli/Meadow-Integration-CLI-Run.js csvtransform ../data/books.csv -m ./mapping_book_author_join.json -o ./BookStore-Comprehension.json

node ../../../source/cli/Meadow-Integration-CLI-Run.js csvtransform ../data/books.csv -m ./mapping_book_author_join.json -o ./BookStore-Comprehension.json -i ./BookStore-Comprehension.json

node ../../../source/cli/Meadow-Integration-CLI-Run.js csvtransform ../data/books.csv -m ./mapping_book_author_join.json -o ./BookStore-Comprehension.json -i ./BookStore-Comprehension.json