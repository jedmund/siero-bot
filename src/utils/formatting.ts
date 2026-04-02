export function spacedString(string: string, maxNumChars: number) {
  const base = string || ""
  return base + " ".repeat(Math.max(0, maxNumChars - base.length))
}

export function splitString(string: string, maxNumChars: number) {
  return {
    string1: string.slice(0, maxNumChars),
    string2: string.slice(maxNumChars),
  }
}

export function renderHtmlBlock(content: string): string {
  return `\`\`\`html\n${content}\`\`\``
}
