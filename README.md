# Siero
Siero is a Discord bot for Granblue Fantasy crews.

## Installation
First, install the dependencies from [NPM](https://www.npmjs.com/get-npm).
```
npm install
```

Next, create a file called `.env` to store the following secret keys
```
DISCORD_SECRET={your secret here} 
```

After that, run the setup script to configure the SQLite database
```
node connect.js
```

Finally, run Siero with [nodemon](https://nodemon.io)
```
npx nodemon
```

## Usage
See the [wiki](https://github.com/jedmund/siero-bot/wiki) for more on how to use Siero
