interface Character {
  [index: string]: any | string | number | boolean | null
  id: string
  granblue_id: string
  name: {
    [index: string]: string
    en: string
    jp: string
  }
}
