// Milestone 3: the finished app.
//
// Everything from milestone 2, plus the three things that make it real:
//   1. The Bedrock permission that was deliberately missing
//   2. An S3 bucket to hold emails and reports
//   3. A trigger so an upload runs the function automatically

import * as path from "node:path";
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { BlockPublicAccess, Bucket, EventType } from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";
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
      timeout: Duration.seconds(30),
      environment: { MODEL_ID: modelId },
    });

    // ------------------------------------------------------------------
    // 1. The Bedrock permission
    // ------------------------------------------------------------------
    // Two resources, not one, and this is the part people get wrong.
    //
    // On Bedrock you do not call a Claude model directly. You call an
    // inference profile, which routes the request to whichever region has
    // capacity. So the policy has to allow both the profile you call and the
    // model it routes to. The * covers those destination regions.
    //
    // The profile ID carries a geography prefix such as us. or global. The
    // underlying model ID does not, so strip it for the second ARN. Models
    // that need no profile, like Amazon Nova, have no prefix to strip and
    // simply match the second ARN.
    const foundationModelId = modelId.replace(
      /^(us|eu|apac|global|ca|au|jp|in)\./,
      "",
    );

    fn.addToRolePolicy(new PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: [
        `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${modelId}`,
        `arn:aws:bedrock:*::foundation-model/${foundationModelId}`,
      ],
    }));

    // ------------------------------------------------------------------
    // 2. The bucket
    // ------------------------------------------------------------------
    // No bucket name is set, so CDK generates a unique one. That matters
    // for two reasons: bucket names are globally unique across every AWS
    // customer, and a hardcoded name would put an account ID on screen.
    const bucket = new Bucket(this, "EmailBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,

      // These two make cdk destroy empty and remove the bucket. Right for a
      // tutorial, wrong for anything you care about keeping.
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Least privilege, scoped to prefixes. The function can read emails and
    // write reports. It cannot read its own reports or write into incoming/.
    bucket.grantRead(fn, "incoming/*");
    bucket.grantPut(fn, "reports/*");

    // ------------------------------------------------------------------
    // 3. The trigger
    // ------------------------------------------------------------------
    // The prefix filter is the most important line in this file.
    //
    // This function writes into the same bucket it reads from. Without the
    // prefix, writing a report would itself be an object creation, which
    // would trigger the function, which would write another report, forever.
    // A loop like that runs until you notice and can cost real money.
    //
    // With the prefix, only uploads into incoming/ start the function, and
    // reports written to reports/ cannot.
    bucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(fn),
      { prefix: "incoming/" },
    );

    // The bucket name is generated, so print it. The README uses this.
    new CfnOutput(this, "BucketName", {
      value: bucket.bucketName,
      description: "Upload emails to the incoming/ folder of this bucket",
    });
  }
}
