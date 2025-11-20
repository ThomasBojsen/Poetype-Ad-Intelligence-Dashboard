import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in process.env.API_KEY");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeAdCopy = async (heading: string, copy: string, brand: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI Analysis unavailable (Missing API Key).";

  const prompt = `
    Analyze the following Facebook Ad for the brand "${brand}".
    
    Heading: "${heading}"
    Copy: "${copy}"
    
    Provide a brief, bulleted analysis covering:
    1. The core hook/angle.
    2. The target audience implication.
    3. A suggestion to improve the copy.
    
    Keep it concise (under 150 words).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Failed to generate analysis. Please try again.";
  }
};