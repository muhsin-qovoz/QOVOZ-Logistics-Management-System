
import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceData } from "../types";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = base64String.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const extractInvoiceData = async (base64Image: string): Promise<Partial<InvoiceData>> => {
  try {
    // Initialize the AI client lazily inside the function.
    // This prevents the entire app from crashing on load if the API Key is missing.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API Key is missing. Please check your environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Image
                }
            },
            {
                text: "Analyze this shipping invoice image and extract all data into the specified JSON structure. Be precise with numbers and names."
            }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            invoiceNo: { type: Type.STRING },
            date: { type: Type.STRING },
            shipmentType: { type: Type.STRING },
            shipper: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                idNo: { type: Type.STRING },
                tel: { type: Type.STRING },
                vatnos: { type: Type.STRING },
                pcs: { type: Type.NUMBER },
                weight: { type: Type.NUMBER },
              }
            },
            consignee: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                address: { type: Type.STRING },
                post: { type: Type.STRING },
                pin: { type: Type.STRING },
                country: { type: Type.STRING },
                district: { type: Type.STRING },
                state: { type: Type.STRING },
                tel: { type: Type.STRING },
                tel2: { type: Type.STRING },
              }
            },
            cargoItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                    slNo: { type: Type.NUMBER },
                    description: { type: Type.STRING },
                    boxNo: { type: Type.STRING },
                    qty: { type: Type.NUMBER },
                }
              }
            },
            financials: {
                type: Type.OBJECT,
                properties: {
                    total: { type: Type.NUMBER },
                    billCharges: { type: Type.NUMBER },
                    vat: { type: Type.NUMBER },
                    vatAmount: { type: Type.NUMBER },
                    netTotal: { type: Type.NUMBER }
                }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini");
    return JSON.parse(text) as Partial<InvoiceData>;

  } catch (error) {
    console.error("Error extracting invoice data:", error);
    throw error;
  }
};
