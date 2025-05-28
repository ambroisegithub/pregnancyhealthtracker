import type { Request, Response, NextFunction } from "express"
import i18n from "../config/i18n"

export interface LocalizedRequest extends Request {
  t: (key: string, options?: any) => string
  language: string
}

export const i18nMiddleware = (req: LocalizedRequest, res: Response, next: NextFunction) => {
  // Get language from header, query, or default to 'en'
  const language = req.headers["accept-language"] || (req.query.lng as string) || req.cookies?.i18next || "en"

  // Validate language
  const supportedLanguages = ["en", "fr", "rw"]
  const selectedLanguage = supportedLanguages.includes(language) ? language : "en"

  // Set language for this request
  req.language = selectedLanguage

  // Create translation function for this request
  req.t = (key: string, options?: any) => {
    const result = i18n.getFixedT(selectedLanguage)(key, options)
    return typeof result === "string" ? result : JSON.stringify(result)
  }

  // Set language in i18n for this request
  i18n.changeLanguage(selectedLanguage)

  next()
}

export default i18nMiddleware
