// Milestone 3: the finished handler.
//
// analyzeEmail is unchanged from milestone 2. Only the handler changed:
// instead of reading email text out of a hand-written test event, it reads
// an object from S3 and writes the report back to the same bucket.
//
// That is the payoff for keeping the two separate. The thing that talks to
// the model did not have to know anything about S3.

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { S3Event } from "aws-lambda";

// Created once, outside the handler, so Lambda can reuse them between runs.
const bedrock = new BedrockRuntimeClient({});
const s3 = new S3Client({});

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
        temperature: 0,
        maxTokens: 500,
      },
      // This model reasons before answering by default. Two reasons to turn
      // that off here: thinking cannot be combined with temperature, and
      // thinking tokens count against maxTokens, so the reasoning could use
      // the whole 500 and leave no room for the JSON. See the README
      // troubleshooting note before you swap this model for a bigger one.
      additionalModelRequestFields: { thinking: { type: "disabled" } },
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

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;

    // S3 URL-encodes object keys in events. A file called "my email.txt"
    // arrives as "my+email.txt", so decode it before using it.
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    console.log(`New email: ${key}`);

    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const emailText = await object.Body!.transformToString();

    const analysis = await analyzeEmail(emailText);

    // incoming/scam.txt becomes reports/scam.json
    const reportKey = key
      .replace("incoming/", "reports/")
      .replace(/\.txt$/i, ".json");

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: reportKey,
        Body: JSON.stringify(analysis, null, 2),
        ContentType: "application/json",
      }),
    );

    console.log(`Report saved: ${reportKey}`);
  }
};
