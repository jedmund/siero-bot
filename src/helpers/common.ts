import { Client } from '../services/connection.js'

type Section = {
    title: string
    content: string
} | null

export function capitalize(string: string, allWords: boolean = false): string {
    const blacklist: string[] = ['of', 'the', 'for', 'and']
    if (allWords) {
        return string.split(' ').map((item) => {
            if (!blacklist.includes(item)) { 
                return item.charAt(0).toUpperCase() + item.slice(1) 
            } else {
                return item
            }
        }).join(' ')
    } else {
        return string.charAt(0).toUpperCase() + string.slice(1)
    }
}

export function sanitize(string: string): string {
    let re = /[|;$%@"<>()+]/g
    return string.replace(re, '').toLowerCase()
}

export function intersection(source: string[], destination: string[]): string[] {
    return source.filter(x => {
        if (destination.includes(x)) {
            source.splice(source.indexOf(x), 1)
        }

        return destination.includes(x)
    })
}

export function wrap(text: string): string {
    return `(${text})`
}

export function parse(request: string) {
    // Establish keywords
    let galas = ['premium', 'flash', 'legend', 'p', 'ff', 'lf']
    let elements = ['fire', 'water', 'earth', 'wind', 'dark', 'light']
    let seasons = ['halloween', 'holiday', 'summer', 'valentines']
    let suffixes = ['halloween', 'holiday', 'summer', 'valentines', 'themed', 'grand']
    
    // Establish blacklist
    let exceptions = [
        'fire piece', 'fire sword', 'fire baselard', 'fire glaive', 
        'water kukri', 'water rod', 'water balloons', 
        'earth cutlass', 'earth halberd', 'earth zaghnal', 'earth bow',
        'wind axe', 'wind rod',
        'light staff', 'light buckler', 'ghost light',
        'dark angel olivia', 'dark sword', 'dark knife',
        'summer genesis'
    ]

    // Sanitize and split the string
    let string = sanitize(request)
    let parts = string.split(' ')

    // Determine if the target is in the exception list
    let excluded = false
    exceptions.forEach(x => {
        if (request.includes(x)) {
            excluded = true
        }
    })

    // Extract keywords from split string using arrays
    // Don't perform an element intersection if the excluded flag is on

    // TODO: How can we prevent race conditions and 
    // match element and prefixes before the word OR after the word
    let elementCross = (excluded) ? [] : intersection(parts, elements)
    let galaCross = intersection(parts, galas)
    let seasonCross = intersection(parts, seasons)
    let suffixCross = intersection(parts, suffixes)

    // Rebuild the base item name
    const cleanedName = `${capitalize(parts.join(' '), true)}`

    // Reconstruct the item name with its suffixes
    let constructedName = cleanedName
    if (suffixCross.length == 1) {
        constructedName = `${cleanedName} ${wrap(capitalize(suffixCross[0]))}`
    } else if (elementCross.length == 1) {
        constructedName = `${cleanedName} ${wrap(capitalize(elementCross[0]))}`
    }

    return {
        name: constructedName,
        gala: galaCross[0],
        season: seasonCross[0]
    }
}

export function mapRarity(rarity: number): string | null {
    switch(rarity) {
        case 1:
            return 'R'
        case 2:
            return 'SR'
        case 3:
            return 'SSR'
        default:
            return null
    }
}

export function spacedString(string: string, maxNumChars: number) {
    if (string) {
        let numSpaces = maxNumChars - string.length
        var spacedString = string

        for (var i = 0; i < numSpaces; i++) {
            spacedString += " "
        }

        return spacedString
    } else {
        return ''
    }
}

// Database methods
export async function fetchPrefix(guildId: string) {
    const sql = 'SELECT prefix FROM guilds WHERE id = $1 LIMIT 1'

    return await Client.oneOrNone(sql, guildId)
        .then((result: { [key: string]: string }) => {
            if (result && result.prefix) {
                return result.prefix
            } else {
                return '$'
            }
        })
        .catch(() => {
            console.error(`There was an error fetching a prefix for ${guildId}`)
        })
}

export function missingItem(originalMessage: string, authorId: string, itemName: string) {
    const text = `We couldn\'t find \`${itemName}\` in our database. Double-check that you're using the correct item name and that the name is properly capitalized.`
    const error = `[Item not found] ${authorId}: ${originalMessage}`

    let section: Section = null
    
    let hasUpperCase = /[A-Z]/.test(itemName)
    if (!hasUpperCase) {
        const prediction = itemName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        const command = originalMessage.substring(0, originalMessage.indexOf(itemName))

        section = {
            title: 'Did you mean...',
            content: `\`\`\`${command}${prediction}\`\`\``
        }
    }

    return {
        text: text,
        error: error,
        section: section
    }
}
