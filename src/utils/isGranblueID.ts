export default function isGranblueID(input: string | null) {
  if (input === null) return false

  // Define the regular expression pattern for a ten digit string
  const regex = /^\d{10}$/

  // Test the string against the pattern
  return regex.test(input)
}
