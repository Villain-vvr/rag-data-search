import { GoogleGenerativeAI } from "@google/generative-ai";
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenerativeAIprocess.env.API_KEY || '' });

export const generateSummary = async (query: string, contextItems: any[]): Promise<string> => {
  const model = 'gemini-2.5-flash';
  
  const context = contextItems.map(p => JSON.stringify(p)).join('\n');

  const prompt = `
    You are an expert data analyst assistant. Your task is to answer a user's query based ONLY on the provided context of JSON data.
    
    Context:
    Here are the JSON objects you can use to answer the query:
    ---
    ${context}
    ---
    
    User's Query: "${query}"
    
    Instructions:
    1. Carefully analyze the user's query.
    2. Review the provided JSON objects to find the most relevant information.
    3. Formulate a helpful, concise, and natural language response that directly answers the query.
    4. Base your answer strictly on the information in the context. Do not invent any details or infer information not present.
    5. If no items in the context match the query, clearly state that you couldn't find a suitable answer in the provided data.
    6. Begin your response directly, without any preamble like "Based on the context..."
  `;

  try {
    const response = await ai..getGenerativeModel({ model })s.generateContent({
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating content with Gemini API:", error);
    return "Sorry, an error occurred while trying to generate a response. Please check the console for more details.";
  }
};
