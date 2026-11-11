// Milestone 2: ask the model.
//
// Three things changed from milestone 1:
//   1. timeout: 30 seconds, because the default 3 is not enough for a
//      model call
//   2. environment: MODEL_ID, which passes the model ID from cdk.json
//      into the function
//   3. Nothing else
//
// That last point is deliberate. There is no Bedrock permission on this
// branch. The function is allowed to run and write logs, and that is it.
// Your first invoke is supposed to fail with AccessDeniedException. See
// the marker below, and the README section "Fix it".

import * as path from "node:path";
import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class CatchAPhishStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The model to call. This comes from "modelId" in cdk.json, so you can
    // change models without touching any code. Paste your own ID from the
    // Bedrock console. See the README, Prerequisites step 6.
    const modelId = this.node.tryGetContext("modelId") as string;

    const fn = new NodejsFunction(this, "AnalyzeEmail", {
      functionName: "catch-a-phish",
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "..", "lambda", "handler.ts"),

      // A model call takes longer than the 3 second default. Without this
      // you get "Task timed out after 3.00 seconds" instead of a verdict.
      timeout: Duration.seconds(30),

      // Environment variables are how configuration reaches your code.
      // The handler reads this as process.env.MODEL_ID.
      environment: { MODEL_ID: modelId },
    });

    // ------------------------------------------------------------------
    // The Bedrock permission goes HERE
    // ------------------------------------------------------------------
    // Nothing below this line yet, and that is the point of the milestone.
    //
    // A Lambda function starts with permission to run and write logs and
    // nothing more. Calling Bedrock is a separate permission you have to
    // grant on purpose. Invoke the function first and read the
    // AccessDeniedException in the logs, then come back and add it.
    //
    // The README section "Fix it" has the code. It starts with
    // fn.addToRolePolicy(...) and needs one more import:
    //   import { PolicyStatement } from "aws-cdk-lib/aws-iam";
    //
    // Until you add it, fn is declared and never used. That is expected.
  }
}
