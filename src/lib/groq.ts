import Groq from 'groq-sdk'

// Free, fast, high-quality
export const GROQ_MODEL = 'llama-3.3-70b-versatile'

// Lazy singleton — only instantiated when first called, not at module load time.
// This prevents build failures when GROQ_API_KEY is not set in the build env.
let _groq: Groq | undefined

export function getGroq(): Groq {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set')
    }
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return _groq
}
