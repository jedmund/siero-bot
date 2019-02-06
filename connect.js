const sqlite3 = require('sqlite3').verbose();
 
// open database from file
let db = new sqlite3.Database('./db/siero.db', (err) => {
    if (err) {
        console.error(err.message);
    }

    console.log('Connected to the Knickknack Shack.');
});

let createTableSql = 
`CREATE TABLE IF NOT EXISTS sparks (
    user_id TEXT PRIMARY KEY,
    crystals INTEGER DEFAULT 0,
    tickets INTEGER DEFAULT 0,
    ten_tickets INTEGER DEFAULT 0,
    target TEXT,
    last_updated TEXT
)`

db.run(createTableSql, (err) => {
    if (err) {
        console.log(err)
    }

    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }

        console.log('Close the database connection.');
    })
})