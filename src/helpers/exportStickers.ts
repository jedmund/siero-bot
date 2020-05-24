const stickers = require('../resources/stickers.js')

interface StickerList {
    [key: string]: { en: string; jp: string; }
}

function exportListForGithub() {
    const stickerList: StickerList = stickers.list

    delete stickerList.st
    
    var list: string = [
        '| Sticker | Alias | Sticker | Alias |',
        '|---------|-------|---------|-------|\n'
    ].join("\n")

    const keys: string[] = []
    for (let key in stickerList) {
        if (stickerList.hasOwnProperty(key)) {
            keys.push(key)
        }
    }

    for (let i = 0; i < keys.length; i++) {
        let alias: string = keys[i]
        let stickerImage: string = stickerList[keys[i]].en

        if (alias == "at") {
            alias = "at\` or \`st"
        }

        var row:string = `|![${alias}](${stickerImage})|\`${alias}\``

        if (i % 2 != 0) {
            row += `|\n`
        }

        list += row
    }

    console.log(list)
}