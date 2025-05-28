import type { Request, Response, NextFunction } from "express"

export const debugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString()
  const requestId = Math.random().toString(36).substring(7)

  console.log(`🔍 [${timestamp}] [${requestId}] REQUEST DEBUG:`)
  console.log(`- Method: ${req.method}`)
  console.log(`- URL: ${req.url}`)
  console.log(`- Original URL: ${req.originalUrl}`)
  console.log(`- Base URL: ${req.baseUrl}`)
  console.log(`- Path: ${req.path}`)
  console.log(`- Route: ${req.route ? JSON.stringify(req.route) : "No route matched"}`)
  console.log(`- Headers:`, JSON.stringify(req.headers, null, 2))
  console.log(`- Query:`, JSON.stringify(req.query, null, 2))
  console.log(`- Body:`, JSON.stringify(req.body, null, 2))
  console.log(`- IP: ${req.ip}`)
  console.log(`- User Agent: ${req.get("User-Agent")}`)

  // Add request ID to response headers for tracking
  res.setHeader("X-Request-ID", requestId)

  // Override res.status to log response status
  const originalStatus = res.status
  res.status = function (code: number) {
    console.log(`📤 [${timestamp}] [${requestId}] RESPONSE STATUS: ${code}`)
    return originalStatus.call(this, code)
  }

  // Override res.json to log response body
  const originalJson = res.json
  res.json = function (body: any) {
    console.log(`📤 [${timestamp}] [${requestId}] RESPONSE BODY:`, JSON.stringify(body, null, 2))
    return originalJson.call(this, body)
  }

  next()
}

export const authDebugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log(`🔐 AUTH MIDDLEWARE DEBUG:`)
  console.log(`- URL: ${req.url}`)
  console.log(`- Method: ${req.method}`)
  console.log(`- Authorization Header: ${req.get("Authorization") || "NOT PRESENT"}`)
  console.log(`- Should Skip Auth: ${req.url.includes("/webhook")}`)

  next()
}
