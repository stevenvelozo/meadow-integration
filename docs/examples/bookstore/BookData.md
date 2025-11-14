# Processing and Importing Books

```shell
./mi-cli-test csvtransform ./books.csv -n "GUIDBook" -g "Book_{~D:Record.id~}" -e "Book" -o Books.json
```

This generates just a basic comprehension with the books in it.

```json
{
	"id": "1",
	"book_id": "2767052",
	"best_book_id": "2767052",
	"work_id": "2792775",
	"books_count": "272",
	"isbn": "439023483",
	"isbn13": "9.78043902348e+12",
	"authors": "Suzanne Collins",
	"original_publication_year": "2008.0",
	"original_title": "The Hunger Games",
	"title": "The Hunger Games (The Hunger Games, #1)",
	"language_code": "eng",
	"average_rating": "4.34",
	"ratings_count": "4780653",
	"work_ratings_count": "4942365",
	"work_text_reviews_count": "155254",
	"ratings_1": "66715",
	"ratings_2": "127936",
	"ratings_3": "560092",
	"ratings_4": "1481305",
	"ratings_5": "2706317",
	"image_url": "https://images.gr-assets.com/books/1447303603m/2767052.jpg",
	"small_image_url": "https://images.gr-assets.com/books/1447303603s/2767052.jpg"
}
```

```json
{
	"Entity": "Book",
	"GUIDTemplate": "Book_{~D:Record.id~}",
	"Mappings":
	{
		"Title": "{~D:Record.title~}",
		"Language": "{~D:Record.language_code~}",
		"PublicationYear": "{~D:Fable.Math.roundPrecise(Record.original_publication_year,0)~}",
		"ISBN": "{~D:Record.isbn~}",
		"Genre": "Unknown",
		"Type": "Book",
		"ImageURL": "{~D:Record.image_url~}"
}
```