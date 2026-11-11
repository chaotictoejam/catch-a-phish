// Milestone 1: a function that runs.
//
// This stack creates exactly one thing: a Lambda function. No Bedrock, no
// bucket, no trigger. The point is to prove the loop works end to end:
// edit TypeScript, run one command, get a running function in AWS.
//
// Milestone 2 adds the model call. Milestone 3 adds the bucket and trigger.

import * as path from "node:path";
import { Stack, StackProps } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class CatchAPhishStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // NodejsFunction is the construct worth understanding. You point it at a
    // TypeScript file; it runs esbuild to bundle that into plain JavaScript
    // and uploads the result. You never run a build step yourself and you
    // never see the compiled output.
    //
    // Because esbuild is in devDependencies, bundling happens locally in
    // milliseconds instead of falling back to Docker.
    new NodejsFunction(this, "AnalyzeEmail", {
      // Without functionName, CDK generates one. We set it so the README's
      // aws cli commands can refer to "catch-a-phish" on every milestone.
      functionName: "catch-a-phish",
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "..", "lambda", "handler.ts"),

      // Note what is NOT here: no timeout, so this function gets the default
      // 3 seconds. That is plenty for a hello world and nowhere near enough
      // for a model call. Milestone 2 raises it to 30.
    });
  }
}
