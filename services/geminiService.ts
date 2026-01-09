
import { GoogleGenAI, Type } from "@google/genai";
import { ExpenseCategory } from "../types";

export const fileToGenerativePart = async (file: File | Blob): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      let mimeType = file.type;
      if (!mimeType && file instanceof File) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') mimeType = 'application/pdf';
        else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      }
      resolve({ mimeType: mimeType || 'image/jpeg', data: base64String });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Plain object for responseSchema recommended for structured extraction
const expenseSchema = {
  type: Type.OBJECT,
  properties: {
    vendorName: { type: Type.STRING, description: "Name of the merchant or vendor" },
    date: { type: Type.STRING, description: "Date of transaction in YYYY-MM-DD format" },
    amount: { type: Type.NUMBER, description: "Total amount paid (numeric)" },
    currency: { type: Type.STRING, description: "Currency code (e.g., MYR, USD, RM)" },
    category: { 
      type: Type.STRING, 
      enum: Object.values(ExpenseCategory),
      description: "Select the most appropriate category"
    },
    summary: { type: Type.STRING, description: "Brief description of the purchase" }
  },
  required: ["vendorName", "date", "amount", "category"]
};

export const extractInvoiceData = async (file: File | Blob) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const filePart = await fileToGenerativePart(file);
    const modelId = 'gemini-3-pro-preview';

    const result = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: filePart },
          { text: "Analyze the attached receipt or invoice. Extract the merchant name, date, total amount, currency, and categorize it based on the provided schema. If the date is not clear, use today's date." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: expenseSchema,
        temperature: 0.1
      }
    });

    const textOutput = result.text;
    if (!textOutput) throw new Error("No data returned from Gemini");
    
    return JSON.parse(textOutput.trim());
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};
