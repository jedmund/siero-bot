const { Command } = require('discord-akairo')
const { RichEmbed } = require('discord.js')

class StickerCommand extends Command {
    constructor() {
        super('sticker', {
            aliases: ['sticker', 'ss'],
            args: [
                {
                    id: 'alias',
                    type: 'string'
                }
            ],
            trigger: ['(?<=\:)(.*?)(?=\:)']
        })
    }

    exec(message, match, args) {
        var alias
        if (match[0] != null) {
            alias = match[0]
        } else if (match['alias'] != null) {
            alias = match['alias']
        }

        var embed = new RichEmbed()
        embed.setColor(0xb58900)

        if (alias === "list" || alias === "help") {
            embed.setTitle("Stickers")
            embed.setDescription("Here are all the stickers you can send:")
            embed.addField("List", listStickers())

            message.reply("I've sent you a direct message with the list of all of the currently available stickers. Have a look!")
            message.author.send(embed)
        } else {
            let stickers = getStickers()

            if (stickers[alias] != null ) {
                var embed = new RichEmbed()
                embed.setColor(0xb58900)
                embed.setImage(stickers[alias])
                message.channel.send(embed)
            }
        }
    }
}

// Command methods
function getStickers() {
    let stickers = {
        'amazing': 'https://gbf.wiki/images/7/74/Stamp37.png',
        'cagTeehee': 'https://gbf.wiki/images/0/08/Stamp142.png',
        'charlottaNo': 'https://gbf.wiki/images/8/81/Stamp111.png',
        'chloeQt': 'https://gbf.wiki/images/b/bd/Stamp169.png',
        'clarisseCutie': 'https://gbf.wiki/images/0/03/Stamp148.png',
        'djeetaLook': 'https://gbf.wiki/images/b/be/Stamp133.png',
        'ferryWhoa': 'https://gbf.wiki/images/c/c8/Stamp57.png',
        'ferryYikes': 'https://gbf.wiki/images/a/af/Stamp73.png',
        'granGives': 'https://gbf.wiki/images/2/2b/Stamp8.png',
        'grimnir': 'https://gbf.wiki/images/f/f1/Stamp263.png',
        'grimnirGreat': 'https://gbf.wiki/images/6/6a/Stamp275.png',
        'jkPump': 'https://gbf.wiki/images/f/fd/Stamp242.png',
        'jkWakannai': 'https://gbf.wiki/images/c/cc/Stamp241.png',
        'katalinaPlz': 'https://gbf.wiki/images/e/e5/Stamp97.png',
        'katalinaStare': 'https://gbf.wiki/images/9/9c/Stamp43.png',
        'like': 'https://gbf.wiki/images/6/68/Stamp260.png',
        'lunaluGhost': 'https://gbf.wiki/images/f/f3/Stamp218.png',
        'lyriaChomp': 'https://gbf.wiki/images/c/cf/Stamp83.png',
        'lyriaHelp': 'https://gbf.wiki/images/6/6c/Stamp46.png',
        'lyriaHi': 'https://gbf.wiki/images/4/4d/Stamp41.png',
        'lyriaHurray': 'https://gbf.wiki/images/d/dc/Stamp2.png',
        'lyriaOk': 'https://gbf.wiki/images/a/ab/Stamp44.png',
        'lyriaSorry': 'https://gbf.wiki/images/0/0f/Stamp17.png',
        'lyriaTummy': 'https://gbf.wiki/images/b/b2/Stamp131.png',
        'lyriaUntz': 'https://gbf.wiki/images/a/a5/Stamp161.png',
        'lyriaYummy': 'https://gbf.wiki/images/0/0c/Stamp99.png',
        'meteraBad': 'https://gbf.wiki/images/3/36/Stamp112.png',
        'moniMoni': 'https://gbf.wiki/images/a/a4/Stamp252.png', 
        'ohNo': 'https://gbf.wiki/images/6/69/Stamp89.png',
        'otsukaresama': 'https://gbf.wiki/images/7/7c/Stamp10.png',
        'percyLaugh': 'https://gbf.wiki/images/6/65/Stamp201.png',
        'percyWombo': 'https://gbf.wiki/images/7/70/Stamp216.png',
        'rackamBye': 'https://gbf.wiki/images/0/02/Stamp100.png',
        'rackamWobble': 'https://gbf.wiki/images/e/e4/Stamp90.png',
        'sagAmazing': 'https://gbf.wiki/images/7/79/Stamp204.png',
        'siegDaikon': 'https://gbf.wiki/images/b/b1/Stamp69.png',
        'sieroAbout': 'https://gbf.wiki/images/c/c3/Stamp77.png',
        'sieroHello': 'https://gbf.wiki/images/0/05/Stamp45.png',
        'sieroPffft': 'https://gbf.wiki/images/f/fc/Stamp103.png',
        'sieroStare': 'https://gbf.wiki/images/0/0a/Stamp102.png',
        'silvaAHHH': 'https://gbf.wiki/images/8/87/Stamp273.png',
        'socieBully': 'https://gbf.wiki/images/7/7a/Stamp74.png',
        'suteraFail': 'https://gbf.wiki/images/8/8c/Stamp113.png',
        'ten': 'https://gbf.wiki/images/b/b0/Stamp115.png',
        'vaneCalmDown': 'https://gbf.wiki/images/3/39/Stamp67.png',
        'vyrnHeyo': 'https://gbf.wiki/images/9/9f/Stamp110.png',
        'vyrnShoobity': 'https://gbf.wiki/images/f/fb/Stamp162.png',
        'vyrnZzz': 'https://gbf.wiki/images/7/7c/Stamp79.png',
        'zetaWhat': 'https://gbf.wiki/images/3/3a/Stamp118.png',
        'wei': 'https://gbf.wiki/images/b/b6/Stamp128.png'
    }

    return stickers
}

function listStickers() {
    let stickers = getStickers()
    let aliases = Object.keys(stickers).join("\n")

    return `\`\`\`${aliases}\`\`\``
}

function exportListForGithub() {
    let stickers = getStickers()
    
    var list = ""

    for (i in stickers) {
        var sticker = stickers[i]
        var row = `|![${i}](${sticker})|\`${i}\`|\n`
        list += row
    }

    console.log(list)
}

module.exports = StickerCommand