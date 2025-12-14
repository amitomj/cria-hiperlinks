import { GoogleGenAI, Type } from "@google/genai";
import { FileNode } from "../types";

// Helper to sanitize input for JSON safety
const sanitize = (str: string) => str.replace(/"/g, "'").replace(/\n/g, " ");

export const resolveAmbiguityWithAI = async (
  cellContent: string,
  candidates: FileNode[]
): Promise<string | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found for Gemini");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  const candidateList = candidates.map(c => c.name).join(", ");

  const prompt = `
    I have an Excel cell content that refers to a document.
    Cell Content: "${sanitize(cellContent)}"
    
    I found these potential file matches in the folder:
    [${candidateList}]
    
    Task: Analyze the cell content (context, dates, keywords) and identify which of the filenames is the correct match.
    If none seem correct, return null.
    
    Return the exact filename of the best match.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bestMatchFilename: { type: Type.STRING, description: "The exact name of the matching file or empty string if none." },
            reasoning: { type: Type.STRING, description: "Brief reason for selection" }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result.bestMatchFilename || null;

  } catch (error) {
    console.error("Gemini AI Error:", error);
    return null;
  }
};
