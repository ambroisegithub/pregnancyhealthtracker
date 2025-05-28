import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai"
import dotenv from "dotenv"

dotenv.config()

class GeminiService {
  private genAI: GoogleGenerativeAI
  private model: GenerativeModel

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.")
    }
    this.genAI = new GoogleGenerativeAI(apiKey)

    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
  }

  public async generateText(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      return text
    } catch (error) {
      console.error("Error generating content with Gemini:", error)
      throw new Error("Failed to generate AI response.")
    }
  }

  public async generateChatResponse(
    systemInstruction: string,
    history: { role: "user" | "model"; parts: { text: string }[] }[],
    newMessage: string,
  ): Promise<string> {
    try {
      const chat = this.model.startChat({
        history: history,
        generationConfig: {
          maxOutputTokens: 500,
        },
      })
      const result = await chat.sendMessage(newMessage)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error("Error generating chat response with Gemini:", error)
      throw new Error("Failed to generate AI chat response.")
    }
  }

  // Backward compatibility method
  public async generateResponse(message: string, language = "en"): Promise<string> {
    const systemPrompts = {
      en: "You are a helpful pregnancy health assistant. Provide accurate, supportive, and medically sound advice about pregnancy, health, and wellness. Always recommend consulting healthcare providers for serious concerns.",
      fr: "Vous êtes un assistant de santé de grossesse utile. Fournissez des conseils précis, soutenants et médicalement solides sur la grossesse, la santé et le bien-être. Recommandez toujours de consulter des professionnels de la santé pour les préoccupations sérieuses.",
      rw: "Uri umufasha w'ubuzima bw'inda. Tanga inama nziza, zishyigikira kandi zifite ishingiro mu buvuzi ku bijyanye n'inda, ubuzima, n'ubwiza. Buri gihe usabe abantu gusaba inama z'abaganga mu bibazo bikomeye.",
    }

    const languageInstructions = {
      en: "Please respond in English.",
      fr: "Veuillez répondre en français.",
      rw: "Nyamuneka subiza mu kinyarwanda.",
    }

    const systemPrompt = systemPrompts[language as keyof typeof systemPrompts] || systemPrompts.en
    const languageInstruction =
      languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.en

    const fullPrompt = `${systemPrompt}\n\n${languageInstruction}\n\nUser question: ${message}`

    return await this.generateText(fullPrompt)
  }
}

export const geminiService = new GeminiService()
