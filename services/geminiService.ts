import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateCreativeIdeas = async (prompt: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a creative director for music videos. The user wants ideas for: ${prompt}. Provide a concise list of 3 visual concepts or scene ideas.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    return response.text || "No ideas generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I couldn't generate ideas at this moment. Please check your API key.";
  }
};

export const generateScript = async (concept: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Write a short timeline script for a 30-second music video based on this concept: ${concept}. Format it as a list of timestamps and actions.`,
    });
    return response.text || "No script generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating script.";
  }
};

export const detectMaskableObjects = async (clipName: string): Promise<string[]> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze a video clip titled "${clipName}". List 4 distinct physical objects or people likely to be in this scene that a video editor might want to mask (e.g., 'Main Dancer', 'Red Car', 'Sky', 'Neon Sign'). Return only the comma-separated list.`,
    });
    const text = response.text || "";
    return text.split(',').map(s => s.trim()).filter(s => s.length > 0);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return ["Person", "Background", "Sky", "Object"];
  }
};

export const analyzeReframeFocus = async (clipName: string): Promise<{ subject: string, xOffset: number }> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Imagine a video clip named "${clipName}". Identify the main subject and determining where they are likely positioned horizontally in a standard wide shot.
      Return a JSON object with:
      - "subject": string description of the subject.
      - "xOffset": number between -40 (far left) and 40 (far right), where 0 is center.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                subject: { type: Type.STRING },
                xOffset: { type: Type.NUMBER }
            }
        }
      }
    });
    
    if (response.text) {
        return JSON.parse(response.text);
    }
    return { subject: "Subject", xOffset: 0 };
  } catch (error) {
    console.error("Gemini Reframe Error", error);
    return { subject: "Center", xOffset: 0 };
  }
};

export const generateExtendedFrames = async (clipName: string, seconds: number): Promise<boolean> => {
    // In a real implementation, this would call a video generation model (like Veo)
    // passing the last frame of the clip as the input image to generate 'seconds' worth of video.
    // For this simulation, we'll assume the AI processing takes a moment and returns success.
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
    } catch (e) {
        return false;
    }
};