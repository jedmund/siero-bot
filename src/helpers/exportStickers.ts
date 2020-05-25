const stickers = require('../resources/stickers.js')

interface StickerList {
    [key: string]: { en: string; jp: string; }
}

module.exports = {
    exportListForGithub: function() {
        const stickerList: StickerList = stickers.list

        delete stickerList.st
        
        let stickerTable: string = [
            '| Sticker | Alias | Sticker | Alias |',
            '|---------|-------|---------|-------|\n'
        ].join('\n')

        const keys = Object.keys(stickerList)
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            const stickerImage = stickerList[key].en
            const stickerAlias = key === 'at' ? 'at\` or \`st' : key

            const row = `|![${stickerAlias}](${stickerImage})|\`${stickerAlias}\`${i % 2 != 0 ? '|\n' : ''}`

            stickerTable += row
        }

        console.log(stickerTable)
    }
}
