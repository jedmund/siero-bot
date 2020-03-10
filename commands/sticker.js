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
                },
                {
                    id: 'language',
                    type: 'string',
                    default: null
                }
            ],
            trigger: ['(?<=\:)(.*?)(?=\:)']
        })
    }

    exec(message, args) {
        var alias
        if (args[0] != null) {
            alias = args[0]
        } else if (args['alias'] != null) {
            alias = args['alias']
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
            let sticker = this.sticker(alias, args)

            if (sticker != null) {
                embed.setImage(sticker)
                message.channel.send(embed)
            }
        }
    }

    sticker(alias, args) {
        var sticker = null
        let stickers = getStickers()
        var isJapanese = (alias.startsWith("jp") || args.language != null)

        if (alias.startsWith("jp")) {
            alias = this.extractAlias(alias)
        }

        if (Object.keys(stickers).includes(alias)) {
            if (isJapanese) {
                sticker = stickers[alias].jp
            } else {
                sticker = stickers[alias].en
            }

            return sticker
        } else {
            return null
        }
    }

    extractAlias(string) {
        return string.substring(2).charAt(0).toLowerCase() + string.substring(2).slice(1)
    }
}

// Command methods
function getStickers() {
    let stickers = {
        'amazing': {
            en: 'https://gbf.wiki/images/7/74/Stamp37.png',
            jp: 'https://gbf.wiki/images/6/66/Stamp37jp.png'
        },
        'cagTeehee': {
            en: 'https://gbf.wiki/images/0/08/Stamp142.png',
            jp: 'https://gbf.wiki/images/8/8f/Stamp142jp.png'
        },
        'charlottaNo': {
            en: 'https://gbf.wiki/images/8/81/Stamp111.png',
            jp: 'https://gbf.wiki/images/d/d5/Stamp111jp.png'
        },
        'chloeQt': {
            en: 'https://gbf.wiki/images/b/bd/Stamp169.png',
            jp: 'https://gbf.wiki/images/7/79/Stamp169jp.png'
        },
        'clarisseCutie': {
            en: 'https://gbf.wiki/images/0/03/Stamp148.png',
            jp: 'https://gbf.wiki/images/2/28/Stamp148jp.png'
        },
        'djeetaLook': {
            en: 'https://gbf.wiki/images/b/be/Stamp133.png',
            jp: ''
        },
        'ferryWhoa': {
            en: 'https://gbf.wiki/images/c/c8/Stamp57.png',
            jp: 'https://gbf.wiki/images/0/06/Stamp57jp.png'
        },
        'ferryYikes': {
            en: 'https://gbf.wiki/images/a/af/Stamp73.png',
            jp: 'https://gbf.wiki/images/5/55/Stamp73jp.png'
        },
        'granGives': {
            en: 'https://gbf.wiki/images/2/2b/Stamp8.png',
            jp: 'https://gbf.wiki/images/a/ad/Stamp8jp.png'
        },
        'grimnir': {
            en: 'https://gbf.wiki/images/f/f1/Stamp263.png',
            jp: 'https://gbf.wiki/images/2/26/Stamp263jp.png'
        },
        'grimnirGreat': {
            en: 'https://gbf.wiki/images/6/6a/Stamp275.png',
            jp: 'https://gbf.wiki/images/0/0a/Stamp275jp.png'
        },
        'jkPump': {
            en: 'https://gbf.wiki/images/f/fd/Stamp242.png',
            jp: 'https://gbf.wiki/images/f/f9/Stamp242jp.png'
        },
        'jkWakannai': {
            en: 'https://gbf.wiki/images/c/cc/Stamp241.png',
            jp: 'https://gbf.wiki/images/5/55/Stamp241jp.png'
        },
        'katPlz': {
            en: 'https://gbf.wiki/images/e/e5/Stamp97.png',
            jp: 'https://gbf.wiki/images/b/bd/Stamp97jp.png'
        },
        'katStare': {
            en: 'https://gbf.wiki/images/9/9c/Stamp43.png',
            jp: 'https://gbf.wiki/images/9/9c/Stamp43.png'
        },
        'leciaProblem': {
            en: 'https://gbf.wiki/images/2/26/Stamp253.png',
            jp: 'https://gbf.wiki/images/7/71/Stamp253jp.png'
        },
        'legendOfRackam': {
            en: 'https://gbf.wiki/images/4/4f/Stamp36.png',
            jp: 'https://gbf.wiki/images/e/e9/Stamp36jp.png'
        },
        'like': {
            en: 'https://gbf.wiki/images/6/68/Stamp260.png',
            jp: 'https://gbf.wiki/images/6/6b/Stamp260jp.png'
        },
        'lunaluGhost': {
            en: 'https://gbf.wiki/images/f/f3/Stamp218.png',
            jp: 'https://gbf.wiki/images/f/f3/Stamp218.png'
        },
        'lyriaChomp': {
            en: 'https://gbf.wiki/images/c/cf/Stamp83.png',
            jp: 'https://gbf.wiki/images/a/a3/Stamp83jp.png'
        },
        'lyriaHelp': {
            en: 'https://gbf.wiki/images/6/6c/Stamp46.png',
            jp: 'https://gbf.wiki/images/2/29/Stamp46jp.png'
        },
        'lyriaHi': {
            en: 'https://gbf.wiki/images/4/4d/Stamp41.png',
            jp: 'https://gbf.wiki/images/6/6a/Stamp41jp.png'
        },
        'lyriaHurray': {
            en: 'https://gbf.wiki/images/d/dc/Stamp2.png',
            jp: 'https://gbf.wiki/images/0/0b/Stamp2jp.png'
        },
        'lyriaOk': {
            en: 'https://gbf.wiki/images/a/ab/Stamp44.png',
            jp: 'https://gbf.wiki/images/9/9a/Stamp44jp.png'
        },
        'lyriaSorry': {
            en: 'https://gbf.wiki/images/0/0f/Stamp17.png',
            jp: ''
        },
        'lyriaTummy': {
            en: 'https://gbf.wiki/images/b/b2/Stamp131.png',
            jp: ''
        },
        'lyriaUntz': {
            en: 'https://gbf.wiki/images/a/a5/Stamp161.png',
            jp: 'https://gbf.wiki/images/a/a4/Stamp17jp.png'
        },
        'lyriaYummy': {
            en: 'https://gbf.wiki/images/0/0c/Stamp99.png',
            jp: 'https://gbf.wiki/images/5/51/Stamp99jp.png'
        },
        'meteraBad': {
            en: 'https://gbf.wiki/images/3/36/Stamp112.png',
            jp: 'https://gbf.wiki/images/f/f7/Stamp112jp.png'
        },
        'moniMoni': {
            en: 'https://gbf.wiki/images/a/a4/Stamp252.png',
            jp: 'https://gbf.wiki/images/7/71/Stamp252jp.png'
        },
        'naruWakannai': {
            en: 'https://gbf.wiki/images/d/d4/Stamp245.png',
            jp: 'https://gbf.wiki/images/c/ca/Stamp245jp.png'
        },
        'naruPlay': {
            en: 'https://gbf.wiki/images/0/0b/Stamp244.png',
            jp: 'https://gbf.wiki/images/9/91/Stamp244jp.png'
        },
        'ohNo': {
            en: 'https://gbf.wiki/images/6/69/Stamp89.png',
            jp: 'https://gbf.wiki/images/6/67/Stamp89jp.png'
        },
        'otsukaresama': {
            en: 'https://gbf.wiki/images/7/7c/Stamp10.png',
            jp: 'https://gbf.wiki/images/8/8a/Stamp10jp.png'
        },
        'percyLaugh': {
            en: 'https://gbf.wiki/images/6/65/Stamp201.png',
            jp: 'https://gbf.wiki/images/e/e7/Stamp201jp.png'
        },
        'percyWombo': {
            en: 'https://gbf.wiki/images/7/70/Stamp216.png',
            jp: 'https://gbf.wiki/images/c/c8/Stamp216jp.png'
        },
        'rackamBye': {
            en: 'https://gbf.wiki/images/0/02/Stamp100.png',
            jp: 'https://gbf.wiki/images/6/62/Stamp100jp.png'
        },
        'rackamWobble': {
            en: 'https://gbf.wiki/images/e/e4/Stamp90.png',
            jp: 'https://gbf.wiki/images/c/ce/Stamp90jp.png'
        },
        'raziaDie': {
            en: 'https://gbf.wiki/images/2/2c/Stamp255.png',
            jp: 'https://gbf.wiki/images/6/68/Stamp255jp.png'
        },
        'sagAmazing': {
            en: 'https://gbf.wiki/images/7/79/Stamp204.png',
            jp: 'https://gbf.wiki/images/7/79/Stamp204.png'
        },
        'scathHumph': {
            en: 'https://gbf.wiki/images/2/2b/Stamp157.png',
            jp: 'https://gbf.wiki/images/6/6e/Stamp157jp.png'
        },
        'siegDaikon': {
            en: 'https://gbf.wiki/images/b/b1/Stamp69.png',
            jp: 'https://gbf.wiki/images/8/83/Stamp69jp.png'
        },
        'sieroAbout': {
            en: 'https://gbf.wiki/images/c/c3/Stamp77.png',
            jp: ''
        },
        'sieroHello': {
            en: 'https://gbf.wiki/images/0/05/Stamp45.png',
            jp: 'https://gbf.wiki/images/9/93/Stamp45jp.png'
        },
        'sieroPffft': {
            en: 'https://gbf.wiki/images/f/fc/Stamp103.png',
            jp: 'https://gbf.wiki/images/0/07/Stamp103jp.png'
        },
        'sieroStare': {
            en: 'https://gbf.wiki/images/0/0a/Stamp102.png',
            jp: 'https://gbf.wiki/images/0/0a/Stamp102.png'
        },
        'silvaAHHH': {
            en: 'https://gbf.wiki/images/8/87/Stamp273.png',
            jp: 'https://gbf.wiki/images/2/23/Stamp273jp.png'
        },
        'socieBully': {
            en: 'https://gbf.wiki/images/7/7a/Stamp74.png',
            jp: 'https://gbf.wiki/images/e/e9/Stamp74jp.png'
        },
        'suteraFail': {
            en: 'https://gbf.wiki/images/8/8c/Stamp113.png',
            jp: 'https://gbf.wiki/images/4/4e/Stamp113jp.png'
        },
        'ten': {
            en: 'https://gbf.wiki/images/b/b0/Stamp115.png',
            jp: 'https://gbf.wiki/images/b/b0/Stamp115.png'
        },
        'vaneCalmDown': {
            en: 'https://gbf.wiki/images/3/39/Stamp67.png',
            jp: 'https://gbf.wiki/images/4/41/Stamp67jp.png'
        },
        'vyrnHeyo': {
            en: 'https://gbf.wiki/images/9/9f/Stamp110.png',
            jp: 'https://gbf.wiki/images/c/c0/Stamp110jp.png'
        },
        'vyrnShoobity': {
            en: 'https://gbf.wiki/images/f/fb/Stamp162.png',
            jp: 'https://gbf.wiki/images/f/f8/Stamp162jp.png'
        },
        'vyrnGreat': {
            en: 'https://gbf.wiki/images/b/bf/Stamp78.png',
            jp: 'https://gbf.wiki/images/6/61/Stamp78jp.png'
        },
        'vyrnZzz': {
            en: 'https://gbf.wiki/images/7/7c/Stamp79.png',
            jp: 'https://gbf.wiki/images/7/74/Stamp79jp.png'
        },
        'zetaWhat': {
            en: 'https://gbf.wiki/images/3/3a/Stamp118.png',
            jp: 'https://gbf.wiki/images/1/13/Stamp118jp.png'
        },
        'wei': {
            en: 'https://gbf.wiki/images/b/b6/Stamp128.png',
            jp: 'https://gbf.wiki/images/e/e0/Stamp128jp.png'
        }
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
}

module.exports = StickerCommand