const sqlite3 = require('sqlite3').verbose();
 
// open database from file
let db = new sqlite3.Database('./db/siero.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the Knickknack Shack.');
});

let sql = 
`CREATE TABLE IF NOT EXISTS sparks (
    user_id TEXT PRIMARY KEY,
    crystals INTEGER,
    tickets INTEGER,
    ten_tickets INTEGER,
    target TEXT,
    last_updated TEXT
)`
 
db.serialize(() => {
    db.run(sql)
})

// close the database connection
db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Close the database connection.');
});