// Milestone 2: ask the model.
//
// Two exports, and the split between them matters.
//
// analyzeEmail(emailText) does the real work: it sends the email to Bedrock
// and parses the answer. It knows nothing about how the email arrived.
//
// handler unwraps { email: "..." } from the test event and calls it. In
// milestone 3 the handler is the only part that changes, because the email
// starts arriving from S3 instead. analyzeEmail stays exactly as it is.

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

// Created once, outside the handler, so Lambda can reuse it between runs.
const bedrock = new BedrockRuntimeClient({});

// Set by the CDK stack from "modelId" in cdk.json.
const MODEL_ID = process.env.MODEL_ID!;

const SYSTEM_PROMPT = `You are a security analyst who reviews emails for phishing.
Look for: urgency or threats, links that don't match the sender,
requests to log in or share personal info, and sender mismatch.
Reply with ONLY this JSON and nothing else:
{"verdict": "phishing" | "suspicious" | "legitimate",
 "risk_score": 0-100,
 "red_flags": ["short phrases"],
 "explanation": "one or two plain sentences"}`;

export interface Analysis {
  verdict: "phishing" | "suspicious" | "legitimate" | "error";
  risk_score?: number;
  red_flags?: string[];
  explanation: string;
}

export async function analyzeEmail(emailText: string): Promise<Analysis> {
  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: "user", content: [{ text: emailText }] }],
      inferenceConfig: {
        // 0 means "be as consistent as you can". Good for classifying.
        // Note: the newest models think before answering and reject this.
        // See the README troubleshooting note before you swap models.
        temperature: 0,
        maxTokens: 500,
      },
    }),
  );

  // The reply is a list of content blocks. We want the text.
  const raw =
    response.output?.message?.content
      ?.filter((block) => typeof block.text === "string")
      .map((block) => block.text)
      .join("")
      .trim() ?? "";

  console.log("Model said:", raw);

  // We asked for JSON only, but models are not perfectly obedient. Take
  // everything between the first { and the last }, and never trust it blindly.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return { verdict: "error", explanation: "Model did not return valid JSON" };
  }

  try {
    return JSON.parse(raw.slice(start, end + 1)) as Analysis;
  } catch {
    return { verdict: "error", explanation: "Model did not return valid JSON" };
  }
}

// The test event is events/scam.json, which looks like { "email": "..." }.
export const handler = async (event: { email?: string }): Promise<Analysis> => {
  if (!event.email) {
    return {
      verdict: "error",
      explanation: 'Event had no "email" field. Try --payload file://events/scam.json',
    };
  }

  return analyzeEmail(event.email);
};
