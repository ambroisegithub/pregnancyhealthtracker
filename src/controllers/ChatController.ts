import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../types';
import dbConnection from '../database';
import { PregnancyForm } from '../database/models/PregnancyForm';
import { User } from '../database/models/User';
import { ChatHistory } from '../database/models/ChatHistory';
import { PregnancyCalculator } from '../utils/pregnancyCalculator'; 
import { geminiService } from '../services/geminiService';

export class ChatController {
  static async startOrContinueChat(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        });
        return;
      }

      const { message } = req.body;
      const userId = req.user.id;

      if (!message) {
        res.status(400).json({ success: false, message: 'Message cannot be empty.' });
        return;
      }

      const userRepository = dbConnection.getRepository(User);
      const pregnancyRepository = dbConnection.getRepository(PregnancyForm);
      const chatHistoryRepository = dbConnection.getRepository(ChatHistory);

      // 1. Fetch User Profile and Pregnancy Data
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['profile'],
      });
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }

      const pregnancyForm = await pregnancyRepository.findOne({
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' }, // Get the latest pregnancy form
      });

      // Update gestational age if pregnant and LMP is available
      if (
        pregnancyForm &&
        pregnancyForm.pregnancyStatus === 'Pregnant' &&
        pregnancyForm.lastDateOfMenstruation
      ) {
        const lmpDate = new Date(pregnancyForm.lastDateOfMenstruation);
        if (!isNaN(lmpDate.getTime())) {
          const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(lmpDate);
          pregnancyForm.currentTrimester = pregnancyDetails.trimester;
          pregnancyForm.gestationalWeeks = pregnancyDetails.gestationalAge.weeks;
          pregnancyForm.gestationalDays = pregnancyDetails.gestationalAge.days;
          await pregnancyRepository.save(pregnancyForm); // Save updated gestational info
        }
      }

      // 2. Fetch Conversation History for the user
      const rawHistory = await chatHistoryRepository.find({
        where: { user: { id: userId } },
        order: { createdAt: 'ASC' },
        take: 20, // Limit history to recent messages to manage token usage
      });

      // Format history for Gemini API
      const geminiHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = rawHistory.map(
        (entry) => ({
          role: entry.role,
          parts: [{ text: entry.content }],
        })
      );

      const initialContextPrompt = `
        You are a supportive and informative AI assistant specializing in pregnancy and women's health.
        Your goal is to provide helpful, encouraging, and accurate information based on the user's specific context.
        Always advise users to consult with a healthcare professional for medical advice.
        Keep responses concise and easy to understand.

        Here is the user's current profile and pregnancy information:
        ---
        User Profile:
        First Name: ${user.profile?.firstName || 'N/A'}
        Last Name: ${user.profile?.lastName || 'N/A'}
        Date of Birth: ${user.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toDateString() : 'N/A'}

        Pregnancy Information (if available):
        ${pregnancyForm ? `
          Pregnancy Status: ${pregnancyForm.pregnancyStatus}
          ${pregnancyForm.lastDateOfMenstruation ? `Last Menstruation Date: ${new Date(pregnancyForm.lastDateOfMenstruation).toDateString()}` : ''}
          Gravida (Total Pregnancies): ${pregnancyForm.gravida || 'N/A'}
          Term Births: ${pregnancyForm.term || 'N/A'}
          Preterm Births: ${pregnancyForm.preterm || 'N/A'}
          Abortions/Miscarriages: ${pregnancyForm.abortion || 'N/A'}
          Living Children: ${pregnancyForm.living || 'N/A'}
          ${pregnancyForm.expectedDeliveryDate ? `Expected Delivery Date: ${new Date(pregnancyForm.expectedDeliveryDate).toDateString()}` : ''}
          ${pregnancyForm.currentTrimester ? `Current Trimester: ${pregnancyForm.currentTrimester}` : ''}
          ${pregnancyForm.gestationalWeeks !== null && pregnancyForm.gestationalWeeks !== undefined ? `Gestational Age: ${pregnancyForm.gestationalWeeks} weeks and ${pregnancyForm.gestationalDays} days` : ''}
        ` : 'No detailed pregnancy information submitted yet.'}
        ---

        Based on the above context and the conversation history, respond to the user's query.
        Do not repeat the provided user and pregnancy information unless specifically asked.
        Focus on answering the user's direct question while incorporating relevant context.
      `;

      const fullUserMessage = `${initialContextPrompt}\n\nUser's message: ${message}`;

      const aiResponseContent = await geminiService.generateChatResponse(
        initialContextPrompt,
        geminiHistory,
        fullUserMessage 
      );

      const userMessageEntry = chatHistoryRepository.create({
        user: user,
        role: 'user',
        content: message, 
      });
      await chatHistoryRepository.save(userMessageEntry);

      const aiMessageEntry = chatHistoryRepository.create({
        user: user,
        role: 'model',
        content: aiResponseContent,
      });
      await chatHistoryRepository.save(aiMessageEntry);

      res.status(200).json({
        success: true,
        data: {
          response: aiResponseContent,
        },
      });
    } catch (error) {
      console.error('Error in chat endpoint:', error);
      next(error); 
    }
  }
}