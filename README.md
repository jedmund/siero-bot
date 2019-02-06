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
Siero can help you save your sparks. You can access the commands any time in Discord with `$spark help`.

See how much you've saved
```
$spark status
``` 

Save an absolute value for a currency
```
$spark set {amount} {currency}
```

Add an amount of currency to your total
```
$spark add/save {amount} {currency}
```

Remove an amount of currency from your total
```
$spark remove/spend {amount} {currency}
```

Reset your spark
```
$spark reset
```

Quickly save all currencies
```
$spark quicksave {crystals} {tickets} {10tickets}
```
