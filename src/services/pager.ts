import { Collection, Message, MessageEmbed, MessageReaction, User } from 'discord.js'

type PageMap = { [key: string]: PageEntry }
type PageEntry = {
    page: Page
    selected: boolean
}

export type Section = {
    name: string
    value: string
}

type NullableSectionList = Section[] | null

export class Pager {
    pages: PageMap

    embed: MessageEmbed | null = null
    message: Message | null = null
    originalUser: User
    hasRendered: boolean = false
       
    public constructor(user: User, pages: PageMap = {}) {
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

            if (this.hasRendered) {
                await this.update(selectedKey)
            }
        }
    }

    public listPages(): void {
        const keys = Object.keys(this.pages)

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            const preceding = (this.pages[key].selected) ? '->\t' : '\t'
            // console.log(`${preceding}${key}\t: ${this.pages[key].page.description}`)    
        }
    }

    public render(message: Message) {
        let embed: MessageEmbed = new MessageEmbed
        const selectedPage: Page = this.selectedPage()

        if (this.embed) {
            console.log('There is already a message embed, let\'s update it.')
        } else {
            embed = new MessageEmbed({
                title: selectedPage.title,
                description: selectedPage.description || '',
            })

            embed.setImage(selectedPage.image || '')

            for (let i in selectedPage.sections) {
                const section = selectedPage.sections[i]
                embed.addField(section.name, section.value)
            }
        }

        this.embed = embed
        message.channel.send(embed)
            .then((sentMessage: Message) => {
                this.message = sentMessage
                this.addReactions()
                this.hasRendered = true
            })
            .catch((error: Error) => {
                console.error(`Unable to send message due to error: ${error}`)
            })
    }

    private async update(key: string) {
        const page = this.pages[key].page
        
        if (this.embed && this.message) {
            this.embed.setTitle(page.title)
            this.embed.setDescription(page.description || '')
            this.embed.setImage(page.image || '')
            
            this.embed.fields = []

            for (let i in page.sections) {
                const section = page.sections[i]
                this.embed.addField(section.name, section.value)
            }

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

    private lock() {    
        if (this.message && this.embed) {
            // console.log("Locking...")

            this.embed.setFooter('This embed has expired. For options, please run the command again.')
            this.message.edit(this.embed)

            this.message.reactions.removeAll().catch(error => console.error('Failed to clear reactions: ', error))
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
                time: 60000,
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
            .catch((_: Collection<string, MessageReaction>) => {
                this.lock()
            })
        }
    }

    public selectedPage(): Page {
        const defaultPage: Page = this.pages[Object.keys(this.pages)[0]].page
        const mappedPages: (Page | undefined)[] = Object.entries(this.pages).map((entry: [string, PageEntry]) => {
            return (entry[1].selected) ? entry[1].page : undefined
        })
        const selectedPage: Page | undefined = mappedPages.filter((p => p !== undefined))[0]

        if (selectedPage) {
            return selectedPage
        } else {
            return defaultPage
        }
    }
}

export type PageConfig = {
    title: string,
    description?: string,
    author?: string,
    image?: string
}

export class Page {
    title: string
    description: string | null
    author: string | null
    image: string | null
    sections: Section[] = []

    public constructor(config: PageConfig, sections: NullableSectionList = null) {
        this.title = config.title
        this.description = config.description || null
        this.author = config.author || null
        this.image = config.image || null
        this.sections = (sections) ? sections : []
    }

    public addSection(section: Section) {
        this.sections.push(section)
    }
}
