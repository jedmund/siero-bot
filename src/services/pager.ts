import { Collection, Message, MessageEmbed, MessageReaction, User } from 'discord.js'

type PageMap = { [key: string]: PageEntry }
type PageEntry = {
    page: Page
    selected: boolean
}

type Section = {
    name: string
    value: string
}

type NullableSectionList = Section[] | null

export class Pager {
    title: string
    pages: PageMap

    embed: MessageEmbed | null = null
    message: Message | null = null
    originalUser: User

    public constructor(title: string, user: User, pages: PageMap = {}) {
        this.title = title
        this.pages = pages
        this.originalUser = user
    }

    public addPage(key: string, page: Page): void {
        this.pages[key] = {
            page: page,
            selected: (Object.keys(this.pages).length === 0) ? true : false
        }
    }

    public async selectPage(selectedKey: string): Promise<void> {
        if (this.pages[selectedKey]) {
            for (const [_, value] of Object.entries(this.pages)) {
                value.selected = false
            }

            this.pages[selectedKey].selected = true

            await this.update(selectedKey)
        }
    }

    public listPages(): void {
        const keys = Object.keys(this.pages)

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            const preceding = (this.pages[key].selected) ? '->\t' : '\t'
            console.log(`${preceding}${key}\t: ${this.pages[key].page.content}`)    
        }
    }

    public render(message: Message) {
        let embed: MessageEmbed = new MessageEmbed
        const selectedPage: Page = this.selectedPage()

        if (this.embed) {
            console.log('There is already a message embed, let\'s update it.')
        } else {
            embed = new MessageEmbed({
                title: this.title,
                description: selectedPage.content
            })
        }

        this.embed = embed
        message.channel.send(embed)
            .then((sentMessage: Message) => {
                this.message = sentMessage
                this.addReactions()
            })
            .catch((error: Error) => {
                console.error(`Unable to send message due to error: ${error}`)
            })
    }

    private async update(key: string) {
        const page = this.pages[key].page
        
        if (this.embed && this.message) {
            this.embed.setDescription(page.content)
            this.message.edit(this.embed)

            await this.receiveReaction()
        }
    }

    private async addReactions() {
        if (this.message) {
            const keys = Object.keys(this.pages)

            for (const key of keys) {
                await this.message.react(key)
            }

            await this.receiveReaction()
        }
    }

    private async receiveReaction() {
        const filter = (reaction: MessageReaction, user: User) => {
            return Object.keys(this.pages).includes(reaction.emoji.name) && user.id === this.originalUser.id
        }

        if (this.message) {
            const message: Message = this.message
            await message.awaitReactions(filter, {
                max: 1,
                time: 6000,
                errors: ['time']
            })
            .then((collected: Collection<string, MessageReaction>) => {
                const reaction = collected.first()

                if (reaction) {
                    this.selectPage(reaction.emoji.name)

                    if (message.channel.type != 'dm') {
                        reaction.users.remove(this.originalUser.id)
                    }
                }
            })
            .catch((error) => {
                console.log(`There was an error receiving reactions: ${error}`)
            })
        }
    }

    private selectedPage(): Page {
        const defaultPage: Page = this.pages[Object.keys(this.pages)[0]].page
        const selectedPage: Page | undefined = Object.entries(this.pages).map((entry: [string, PageEntry]) => {
            return (entry[1].selected) ? entry[1].page : undefined
        })[0]

        if (selectedPage) {
            return selectedPage
        } else {
            return defaultPage
        }
    }
}

export class Page {
    content: string
    sections: Section[] = []

    public constructor(content: string, sections: NullableSectionList = null) {
        this.content = content
        this.sections = (sections) ? sections : []
    }

    public addSection(section: Section) {
        this.sections.push(section)
    }
}
