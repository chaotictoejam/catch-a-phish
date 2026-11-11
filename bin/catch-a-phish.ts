#!/usr/bin/env node
// Entry point for the CDK app.
//
// Everything this project deploys is defined here and in lib/catch-a-phish-stack.ts.
// Run it with: npx cdk deploy

import * as cdk from "aws-cdk-lib";
import { CatchAPhishStack } from "../lib/catch-a-phish-stack";

const app = new cdk.App();

new CatchAPhishStack(app, "CatchAPhishStack", {
  // Deploy into whatever account and region your AWS CLI is configured for.
  // Use the same region for everything. The default in the README is us-east-1.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  // Kept milestone-neutral on purpose: this file is identical on every
  // branch, and milestones 1 and 2 have no bucket and no trigger yet.
  description:
    "Catch a Phish: a tutorial app that asks Amazon Bedrock whether an email is phishing",
});

// ---------------------------------------------------------------------------
// Cost allocation tags
// ---------------------------------------------------------------------------
// Tags.of(app) walks every construct in every stack and tags each resource
// that supports tagging. That is the bucket, the function, the role, and the
// log group here. Tagging at the app level means you cannot forget a resource.
//
// Tags are how you answer "what did this project cost me?" in Cost Explorer.
// Two things to know, both covered in README.md:
//   1. A tag does nothing for billing until you activate it in the Billing
//      console, under Cost allocation tags. That step is manual and one time.
//   2. Bedrock model usage is billed through AWS Marketplace and will not
//      carry these tags. The README explains how to track that separately.
//
// Override any of these at deploy time, for example:
//   npx cdk deploy -c owner=jsmith -c environment=dev
const tags = cdk.Tags.of(app);

tags.add("Project", app.node.tryGetContext("project") ?? "catch-a-phish");
tags.add("Environment", app.node.tryGetContext("environment") ?? "tutorial");
tags.add("Owner", app.node.tryGetContext("owner") ?? "unassigned");

// Fixed values. These describe how the stack was made and what it is for,
// which is what makes a tag useful six months later.
tags.add("ManagedBy", "aws-cdk");
tags.add("Workload", "phishing-triage-demo");

// A deliberate reminder that nothing here is production and nothing here
// should outlive the tutorial.
tags.add("Temporary", "true");
