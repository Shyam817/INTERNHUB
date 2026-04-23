import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
console.log("API KEY:", import.meta.env.VITE_GEMINI_API_KEY);
const ai = new GoogleGenAI({ apiKey: apiKey || "AIzaSyDoN3Kf_4V7OLktS8xUlNiQI2utqobl8eI" });

export async function analyzeResume(text: string, domain: string) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an expert career coach and technical recruiter for ${domain}. 
    Analyze the following resume text extracted from a PDF.
    
    Resume Text:
    ${text}
    
    Provide a detailed analysis in JSON format with the following structure:
    - resumeScore: (0-100) overall strength for a ${domain} internship.
    - matchPct: (0-100) how well the skills match the domain.
    - advantages: array of strings for strengths identified in the resume.
    - disadvantages: array of strings for weaknesses or areas of concern.
    - found: array of objects { name: string, pct: number } for skills identified.
    - missing: array of strings for critical skills missing for ${domain}.
    - suggestions: array of strings for resume improvements.
    - roadmap: array of objects { week: string, topic: string, description: string } for a 4-week learning plan.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          resumeScore: { type: Type.NUMBER },
          matchPct: { type: Type.NUMBER },
          advantages: { type: Type.ARRAY, items: { type: Type.STRING } },
          disadvantages: { type: Type.ARRAY, items: { type: Type.STRING } },
          found: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                pct: { type: Type.NUMBER }
              },
              required: ["name", "pct"]
            }
          },
          missing: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          roadmap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                week: { type: Type.STRING },
                topic: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["week", "topic", "description"]
            }
          }
        },
        required: ["resumeScore", "matchPct", "advantages", "disadvantages", "found", "missing", "suggestions", "roadmap"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function matchJob(jd: string, resumeText: string) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Compare the following job description and resume text.
    
    Job Description:
    ${jd}
    
    Resume Text:
    ${resumeText}
    
    Provide a match analysis in JSON format:
    - pct: (0-100) match percentage.
    - matched: array of strings for matching keywords/skills.
    - missing: array of strings for keywords/skills in JD but not in resume.
    - suggestions: array of strings for specific resume tweaks to better fit this JD.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pct: { type: Type.NUMBER },
          matched: { type: Type.ARRAY, items: { type: Type.STRING } },
          missing: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["pct", "matched", "missing", "suggestions"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function searchInternships(query: string, domain: string) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Find 10 real internship opportunities for ${domain} based on the search query: "${query}". 
    Provide the results in JSON format as an array of objects with the following structure:
    - title: (string) job title.
    - company: (string) company name.
    - location: (string) location (e.g., Remote, City, State).
    - link: (string) URL to the job posting.
    - deadline: (string) application deadline (if available, else "N/A").
    - description: (string) brief 1-sentence description.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            location: { type: Type.STRING },
            link: { type: Type.STRING },
            deadline: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["title", "company", "location", "link", "deadline", "description"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
}