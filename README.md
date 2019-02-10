# Siero
Siero is a Discord bot for Granblue Fantasy crews.

## Usage
See the [wiki](https://github.com/jedmund/siero-bot/wiki) for more on how to use Siero

## Installation
Follow these instructions to get Siero running on your local machine.

First, install the dependencies from [NPM](https://www.npmjs.com/get-npm).
```
npm install
```

Next, create a file called `.env` to store the following secret keys
```
DISCORD_SECRET={your secret here} 
```

After that, set up the Postgres database with the included `.pgsql` file
```
psql -d <table_name> -a -f startup.pgsql
```

Then, import the included `gacha.csv` file to your Postgres database
```
psql
COPY gacha(name, rarity, item_type, recruits, premium, flash, legend, valentine, summer, halloween, holiday) FROM <path_to_csv> DELIMITER ',' CSV HEADER;
```

Finally, run Siero with [nodemon](https://nodemon.io)
```
npx nodemon
```
