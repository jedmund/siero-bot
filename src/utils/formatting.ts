export function spacedString(string: string, maxNumChars: number) {
  if (string) {
    let numSpaces = maxNumChars - string.length
    let spacedString = string

    for (var i = 0; i < numSpaces; i++) {
      spacedString += " "
    }

    return spacedString
  } else {
    let spacedString = ""

    for (var i = 0; i < maxNumChars; i++) {
      spacedString += " "
    }

    return spacedString
  }
}

export function splitString(string: string, maxNumChars: number) {
  return {
    string1: string.substr(0, maxNumChars),
    string2: string.substr(maxNumChars),
  }
}
