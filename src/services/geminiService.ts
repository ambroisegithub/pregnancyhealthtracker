import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);

   this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  public async generateText(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return text;
    } catch (error) {
      console.error('Error generating content with Gemini:', error);
      throw new Error('Failed to generate AI response.');
    }
  }

  public async generateChatResponse(
    systemInstruction: string,
    history: { role: 'user' | 'model'; parts: { text: string }[] }[],
    newMessage: string
  ): Promise<string> {
    try {
      const chat = this.model.startChat({
        history: history,
        generationConfig: {
          maxOutputTokens: 500, 
        },
      });
      const result = await chat.sendMessage(newMessage);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating chat response with Gemini:', error);
      throw new Error('Failed to generate AI chat response.');
    }
  }
}

export const geminiService = new GeminiService();