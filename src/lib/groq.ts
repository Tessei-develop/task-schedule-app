import Groq from 'groq-sdk'

const globalForGroq = globalThis as unknown as { groq: Groq | undefined }

export const groq =
  globalForGroq.groq ??
  new Groq({ apiKey: process.env.GROQ_API_KEY })

if (process.env.NODE_ENV !== 'production') globalForGroq.groq = groq

// Free, fast, high-quality
export const GROQ_MODEL = 'llama-3.3-70b-versatile'
