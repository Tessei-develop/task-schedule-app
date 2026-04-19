import { GoogleGenerativeAI } from '@google/generative-ai'

const globalForGemini = globalThis as unknown as {
  gemini: GoogleGenerativeAI | undefined
}

export const gemini =
  globalForGemini.gemini ??
  new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')

if (process.env.NODE_ENV !== 'production') globalForGemini.gemini = gemini

// Free tier model — fast and capable
export const GEMINI_MODEL = 'gemini-2.0-flash'
