export interface Character {
  [index: string]: string | number | boolean | null | { [index: string]: string }
  id: string
  granblue_id: string
  name: {
    [index: string]: string
    en: string
    jp: string
  }
}
