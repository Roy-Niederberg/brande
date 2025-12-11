import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()

export default {
  name: 'gemini',

  generate: async (prompt, config) => {
    const api_key = read_scrt('gemini_api_key')
    const genai = new GoogleGenerativeAI(api_key)
    const model = genai.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: config.temperature,
        topK: config.topK,
        topP: config.topP,
        maxOutputTokens: config.maxOutputTokens
      }
    })
    const result = await model.generateContent(prompt)
    return result.response.text()
  }
}
