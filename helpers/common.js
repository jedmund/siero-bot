const common = require('./common.js')

module.exports = {
    mapRarity: function(rarity) {
        var rarityString = ""

        if (rarity == 1) {
            rarityString = "R"
        } else if (rarity == 2) {
            rarityString = "SR"
        } else if (rarity == 3) {
            rarityString = "SSR"
        }

        return rarityString
    },
    spacedString: function(string, maxNumChars) {
        let numSpaces = maxNumChars - string.length
        var spacedString = string

        for (var i = 0; i < numSpaces; i++) {
            spacedString += " "
        }

        return spacedString
    },
    storeArgs: function(that, args) {
        that.args = args
    },
    storeMessage: function(that, message) {
        that.message = message
    },
    storeUser: function(that, id) {
        that.userId = id
    }
}