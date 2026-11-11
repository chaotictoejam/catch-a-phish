# Catch a Phish: Your First AI App on AWS

This is a small app that reads an email, asks an AI model whether it looks like phishing, and saves a report with the answer. You build it in three steps with the AWS CDK, which means the whole thing is TypeScript you can read, change, and deploy with one command.

```
   1. you upload            2. S3 triggers         3. Lambda asks
   incoming/scam.txt        the function           "is this phishing?"
          │                       │                        │
          ▼                       ▼                        ▼
   ┌──────────────┐        ┌──────────────┐        ┌─────────────────┐
   │              │───────▶│    Lambda    │───────▶│ Amazon Bedrock  │
   │  S3 bucket   │        │  (your code) │        │  Claude Haiku   │
   │              │◀───────│              │◀───────│                 │
   └──────────────┘        └──────────────┘        └─────────────────┘
   4. write the report                              verdict, risk score,
      to reports/scam.json                          and the reasons why
```

A finished report looks like this:

```json
{
  "verdict": "phishing",
  "risk_score": 92,
  "red_flags": [
    "24 hour account suspension threat",
    "Sender domain is not the real company domain",
    "Login link points somewhere else entirely"
  ],
  "explanation": "The email pressures you to act within 24 hours and sends you to a lookalike domain to log in. Real companies do not do this."
}
```

## How this repo is organized

There is one git branch per milestone. Check one out and deploy it. That is the whole workflow.

| Branch        | What you get                                                   |
| ------------- | -------------------------------------------------------------- |
| `milestone-1` | A Lambda function that says hello                              |
| `milestone-2` | The same function, now calling Bedrock. Permission deliberately missing |
| `milestone-3` | The finished app: Bedrock permission, an S3 bucket, and a trigger |
| `main`        | Identical to `milestone-3`                                     |

| File                        | What it is                                        |
| --------------------------- | ------------------------------------------------- |
| `bin/catch-a-phish.ts`      | The CDK app. Creates the stack and sets the tags  |
| `lib/catch-a-phish-stack.ts`| The infrastructure. This is the file that changes most between milestones |
| `lambda/handler.ts`         | The function code, in TypeScript                  |
| `events/scam.json`          | A test event for invoking the function by hand    |
| `samples/`                  | Four test emails, two fake and two normal         |

## What it costs

Honest answer: a few cents at most, and probably less than one cent.

| Thing           | What you use in this tutorial          | Cost                                            |
| --------------- | -------------------------------------- | ----------------------------------------------- |
| Amazon Bedrock  | Roughly 20,000 tokens across all tests | A fraction of one cent                          |
| AWS Lambda      | Around 20 runs of a few seconds        | Free. The free tier is 1 million runs per month |
| Amazon S3       | A handful of small text files          | A fraction of one cent                          |
| CloudWatch Logs | A few kilobytes of logs                | A fraction of one cent                          |

Claude Haiku is the cheapest Claude model on Bedrock. One email is a few hundred tokens. You would need to analyze thousands of emails to spend a dollar. Check the [Bedrock pricing page](https://aws.amazon.com/bedrock/pricing/) for the exact current rate.

The real risk is not this tutorial. It is leaving things running afterward and forgetting about them. Set up a billing alarm in the next section, and run `npx cdk destroy` at the end.

### Everything is tagged

`bin/catch-a-phish.ts` tags every resource in the stack, from milestone 1 onward, so you can answer "what did this project cost me?" in Cost Explorer instead of guessing. The tags are `Project`, `Environment`, `Owner`, `ManagedBy`, `Workload`, and `Temporary`.

Override the first three at deploy time if you like:

```bash
npx cdk deploy -c owner=jsmith -c environment=dev
```

Two things to know. A tag does nothing for billing until you activate it in the Billing console under **Cost allocation tags**, and activation is not retroactive. Also, Bedrock model usage is billed through AWS Marketplace and does not carry these tags, so the model spend shows up separately from the rest.

## Before you build: secure your account

Do this first. It takes about fifteen minutes. A stolen AWS account can run up thousands of dollars of charges before you notice, and this is how you stop that.

### 1. Turn on MFA for your root user

Your root user is the email address you signed up with. It can do anything in your account, including closing it. Protect it with multi-factor authentication. Use an authenticator app on your phone, or a hardware key if you have one.

Guide: [Enable MFA for the root user](https://docs.aws.amazon.com/IAM/latest/UserGuide/enable-virt-mfa-for-root.html)

### 2. Stop using root for daily work

After you turn on MFA, sign out of root and leave it alone. Create a separate user for yourself and use that from now on. The recommended way is IAM Identity Center.

Guides:
- [Root user best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html)
- [Get started with IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/get-started-enable-identity-center.html)

If you were handed a user by a class or a workplace, use that and skip this step.

### 3. Set a billing alarm

This emails you if your bill goes above a number you pick. Set it low. Five dollars is plenty for this tutorial. An AWS Budget is the simpler option and takes about three minutes.

Guides:
- [Create a cost budget with an alert](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html)
- [Create a CloudWatch billing alarm](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html)

Do not skip this. It is the single most useful thing on this page.

## Prerequisites

### 1. Node.js 20 or newer

Check with `node --version`. If you do not have it, get it from [nodejs.org](https://nodejs.org/).

### 2. The AWS CLI, signed in

Install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), then confirm it works:

```bash
aws sts get-caller-identity
```

That should print your account ID and user. If it errors, you are not signed in yet. Run `aws configure`, or sign in the way your class or workplace told you to.

### 3. Pick a region and stay in it

Everything must live in the same region. Set it once:

```bash
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
```

Use the same region for everything. If something later works for nobody and the error makes no sense, check this first.

### 4. Install the project

```bash
git clone <this repo>
cd catch-a-phish
npm install
```

This installs the CDK, TypeScript, and esbuild locally. You do not need to install anything globally.

### 5. Bootstrap CDK, once per account and region

CDK needs a small amount of its own infrastructure in your account before it can deploy anything. Run this once:

```bash
npx cdk bootstrap
```

If you already use CDK in this account and region, it is already done and this is a no-op.

### 6. Check you can actually reach a model

This is the step most likely to stop you, so do it before you deploy anything. It takes about one minute.

Bedrock models are **off by default**, and which ones you are allowed to turn on depends on your account. New accounts are restricted. In practice the newest models are often unavailable, so this project defaults to one that most accounts can get:

```json
"modelId": "us.anthropic.claude-haiku-4-5-20251001-v1:0"
```

That is already set in `cdk.json`. Check that it works for you:

```bash
aws bedrock-runtime converse \
  --model-id us.anthropic.claude-haiku-4-5-20251001-v1:0 \
  --messages '[{"role":"user","content":[{"text":"Reply with the single word: ok"}]}]' \
  --inference-config '{"maxTokens":20}' \
  --query 'output.message.content[0].text'
```

If that prints something like `"ok"`, you are done with this step. Go to Milestone 1.

### If it fails

You will get one of two errors, and they mean different things.

**`is not available for this account`** means you have no access to that model. Request it:

1. Open the [Amazon Bedrock console](https://console.aws.amazon.com/bedrock/) in your region
2. In the left sidebar, scroll down and choose **Model access**
3. Choose **Modify model access**, find **Claude Haiku 4.5**, check it, then **Next** and **Submit**
4. Wait for the status to read **Access granted**, then run the command again

Enabling a model is free. It is often instant, though some models ask for brief use case details first. Say you are a student learning to classify phishing emails.

**`ResourceNotFoundException`** means the ID itself is wrong or retired for your region. Get a current one from the list below.

### Finding a model you can use

To see every Claude profile your account knows about:

```bash
aws bedrock list-inference-profiles --type-equals SYSTEM_DEFINED --max-results 200 \
  --query "inferenceProfileSummaries[?starts_with(inferenceProfileId,'us.anthropic')].inferenceProfileId" \
  --output text | tr '\t' '\n' | sort
```

A word of warning. That list shows what **exists**, not what you can **use**. A model can be listed and still refuse you. The only real test is the `converse` command above, so run it against anything you are considering.

Work down this list and use the first one that answers:

| Model                | ID to try                                       | Notes                                   |
| -------------------- | ----------------------------------------------- | --------------------------------------- |
| Claude Haiku 4.5     | `us.anthropic.claude-haiku-4-5-20251001-v1:0`   | The default. Cheap and good enough      |
| Claude Sonnet 4.6    | `us.anthropic.claude-sonnet-4-6`                | Better reasoning, roughly 3x the cost   |
| Amazon Nova Lite     | `amazon.nova-lite-v1:0`                         | Last resort. See the warning below      |

Whatever you pick, put it in `cdk.json`, or pass it per deploy without editing the file:

```bash
npx cdk deploy -c modelId=us.anthropic.claude-sonnet-4-6
```

Nothing in the code changes. The handler reads the model from an environment variable, and the Converse API has the same request shape for every model on Bedrock, Amazon's own included.

**About Nova.** It needs no inference profile and is usually available, which makes it a genuine fallback if you cannot get any Claude model. But it is noticeably weaker at this task. Nova Micro labels one of the four sample emails `legitimate` when it is phishing. If you fall back to Nova, read the comparison in [Try a different model](#try-a-different-model-and-watch-what-changes) so you know what you are giving up.

Reference: [Model access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) and [the model list](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html)

## Milestone 1: a function that runs

```bash
git checkout milestone-1
npx cdk deploy
```

### What is in it, and why

`lib/catch-a-phish-stack.ts` creates exactly one thing: a `NodejsFunction` named `catch-a-phish`, running Node.js 22, whose code is `lambda/handler.ts`.

`NodejsFunction` is the construct worth understanding. You write TypeScript. It runs esbuild to bundle that into plain JavaScript, then uploads the result. You never run a build step yourself, and you never see the compiled output. Because `esbuild` is in `devDependencies`, the bundling happens locally in milliseconds instead of falling back to Docker.

The handler logs the event and returns a message. That is all. The point of this milestone is to prove the loop works: edit TypeScript, run one command, get a running function in AWS.

### Test it

```bash
aws lambda invoke --function-name catch-a-phish out.json && cat out.json
```

You should see:

```json
{"message":"Hello from Lambda!"}
```

Now watch the logs. This is where you will spend most of your debugging time, so get used to it early:

```bash
aws logs tail /aws/lambda/catch-a-phish --follow
```

Leave that running in a second terminal and invoke the function again. You will see your `console.log` output appear, along with `START`, `END`, and `REPORT` lines that AWS adds. Press Ctrl+C to stop following.

## Milestone 2: ask the model

```bash
git checkout milestone-2
npx cdk deploy
```

### What is in it, and why

Three things changed in the stack:

- `timeout: Duration.seconds(30)`, because the default is 3 seconds and a model call takes longer than that
- `environment: { MODEL_ID: modelId }`, which passes the model ID from `cdk.json` into the function
- Nothing else

That last point is deliberate. **There is no Bedrock permission on this branch.** The function is allowed to run and write logs, and that is it. Your first invoke is supposed to fail. There is a comment in the stack marking exactly where the permission goes.

The handler now has two exports. `analyzeEmail(emailText)` does the real work: it sends the email to Bedrock with the Converse API and a system prompt that tells the model what red flags to look for, then parses the JSON that comes back. The `handler` just unwraps `{ email: "..." }` from the event and calls it.

Two details in that code are worth a look. The model is asked for JSON and nothing else, but models are not perfectly obedient, so the code takes the text between the first `{` and the last `}` and returns `verdict: "error"` if that fails to parse. And `inferenceConfig` sends `temperature: 0`, which asks for the same answer run to run, inside a 500 token budget. That pairing is the thing to check before you swap models: the newest Claude models reason before answering, which rules out `temperature` and would spend the budget on thinking before any JSON is written. More on that in Troubleshooting.

### Test it, and watch it fail

```bash
aws lambda invoke \
  --function-name catch-a-phish \
  --payload file://events/scam.json \
  --cli-binary-format raw-in-base64-out \
  out.json && cat out.json
```

`--cli-binary-format raw-in-base64-out` tells the CLI that your payload is plain JSON. Without it, newer AWS CLI versions expect base64 and you get a confusing error.

This fails, and that is correct. Check the logs:

```bash
aws logs tail /aws/lambda/catch-a-phish --since 2m
```

You will see an `AccessDeniedException` saying the function is not authorized to perform `bedrock:InvokeModel`. The code is fine. The permission is missing. This is the single most common thing that goes wrong when people build on AWS, so it is worth meeting it on purpose once.

### Fix it

Add this to `lib/catch-a-phish-stack.ts`, where the comment tells you to:

```typescript
fn.addToRolePolicy(new PolicyStatement({
  actions: ["bedrock:InvokeModel"],
  resources: [
    `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${modelId}`,
    `arn:aws:bedrock:*::foundation-model/${modelId.replace(/^us\./, "")}`,
  ],
}));
```

You also need the import:

```typescript
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
```

Two resources, not one, and that is the part people get wrong. On Bedrock you do not call a model directly. You call an inference profile, which routes your request to whichever region has capacity. So the policy has to allow both the profile you call and the underlying model it routes to. The `*` in the second ARN covers those destination regions.

Then deploy and test again:

```bash
npx cdk deploy
aws lambda invoke \
  --function-name catch-a-phish \
  --payload file://events/scam.json \
  --cli-binary-format raw-in-base64-out \
  out.json && cat out.json
```

Now you get a verdict. Something like this, though the wording changes every run:

```json
{"verdict":"phishing","risk_score":95,"red_flags":["Threatens account suspension in 24 hours","Misspelled sender name","Login link on a lookalike domain"],"explanation":"This email creates false urgency and sends you to a domain that only looks like the real one."}
```

## Milestone 3: make it event driven

```bash
git checkout milestone-3
npx cdk deploy
```

### What is in it, and why

This branch has the Bedrock permission already in place, plus the storage and the trigger:

- An S3 bucket with public access blocked and HTTPS required. It has no hardcoded name, so CDK generates a unique one. The `BucketName` output tells you what it picked
- `bucket.grantRead(fn, "incoming/*")` and `bucket.grantPut(fn, "reports/*")`. The function can read emails and write reports, and nothing else. It cannot read its own reports or write into `incoming/`
- An event notification that fires the function when an object is created under `incoming/`

That prefix filter is the most important line in the file.

The function writes into the same bucket it reads from. If the trigger fired on the whole bucket, then writing a report would be a new object creation, which would trigger the function, which would write another report, forever. A loop like that runs until you notice, and it can burn real money overnight. The prefix means only uploads into `incoming/` can start the function, and reports written to `reports/` cannot.

The handler now takes an `S3Event` instead of a hand-written payload. It reads the object, calls the same unchanged `analyzeEmail`, and writes the result to the matching key under `reports/` with a `.json` extension. One detail: S3 URL-encodes object keys in events, so a file called `my email.txt` arrives as `my+email.txt`. The code decodes it before use.

### Test it

Grab the bucket name from the deploy output:

```bash
export BUCKET=<the BucketName output from cdk deploy>
```

Upload an email and read the report:

```bash
aws s3 cp samples/sneaky-scam.txt s3://$BUCKET/incoming/

# Wait a few seconds for the function to run.
aws s3 cp s3://$BUCKET/reports/sneaky-scam.json -
```

Then try the rest. The `samples/` folder has four emails:

| File                  | What it is                                           | Expected verdict           |
| --------------------- | ---------------------------------------------------- | -------------------------- |
| `obvious-scam.txt`    | A loud account suspension scam                        | `phishing`                 |
| `sneaky-scam.txt`     | A believable IT password reset on a lookalike domain  | `phishing` or `suspicious` |
| `legit-bank.txt`      | A real looking statement notice that asks for nothing | `legitimate`               |
| `legit-professor.txt` | A professor moving their office hours                 | `legitimate`               |

```bash
aws s3 cp samples/ s3://$BUCKET/incoming/ --recursive
aws s3 ls s3://$BUCKET/reports/
```

All four use made up companies and reserved `example.com` style domains. None of them impersonate a real business.

The interesting one is `sneaky-scam.txt`. It is polite, well written, and plausible. The giveaway is the domain. See whether the model catches it, and whether you agree with its reasoning.

Then write your own. A phishing email with no links. A real email that sounds urgent because it genuinely is. Finding the cases where it is wrong teaches you more than the cases where it is right.

## Troubleshooting

### Start with the logs

Almost every answer is here:

```bash
aws logs tail /aws/lambda/catch-a-phish --since 10m
```

The handler logs the model's raw reply every time, prefixed with `Model said:`, so you can always see exactly what came back.

### "This stack uses assets, so the toolkit stack must be deployed"

You have not bootstrapped. Run `npx cdk bootstrap` once for this account and region.

### Bundling failed, or CDK tries to use Docker

The error mentions Docker, or a failure to bundle the asset. CDK falls back to Docker when it cannot find esbuild locally.

Run `npm install` and confirm esbuild is there:

```bash
npx esbuild --version
```

If that prints a version, deploy again. You should see a line like `⚡ Done in 3ms` during synth, which means esbuild ran locally and Docker was never involved.

### AccessDeniedException on bedrock:InvokeModel

Two different problems produce this, and the message tells you which.

**"is not authorized to perform: bedrock:InvokeModel"** is an IAM problem. Your function is not allowed to call the model.

On `milestone-2` before you add the permission, this is expected. That is the whole point of the milestone. Anywhere else:

1. Are both ARNs in the policy? The inference profile **and** the foundation model. Missing the second one is the usual cause
2. Did you redeploy after editing the stack? Run `npx cdk deploy` again
3. Does the `modelId` you deployed with match the ARNs in the policy? If you passed `-c modelId=...`, pass the same value every time, or the policy and the call disagree

**"is not available for this account"** is not an IAM problem, and no amount of editing the policy will fix it. Your account has not been granted access to that model. Go to Prerequisites step 6 and either request access or pick a model you can reach.

### ValidationException, or the model ID is wrong

The error says the model does not exist or the identifier is invalid.

For Claude models, `modelId` must be an **inference profile** ID with a geography prefix such as `us.`, not a bare model name. Claude is not offered as a plain on-demand model, so `anthropic.claude-haiku-4-5-20251001-v1:0` on its own will fail where `us.anthropic.claude-haiku-4-5-20251001-v1:0` works.

Amazon Nova is the opposite. It takes the bare ID, `amazon.nova-lite-v1:0`, with no prefix.

Model IDs also change with every release and vary by region. Go back to Prerequisites step 6 and list what your account actually has.

### Thinking, temperature, and swapping models

The handler sends `temperature: 0`, which asks the model to be as consistent as it can between runs. Useful for classifying, and useful when you are demonstrating something live.

The newest Claude models reason before answering and cannot be told not to. Thinking is incompatible with `temperature`, so those models reject the request with a 400 mentioning `temperature` or `thinking.type`. Thinking tokens also count against `maxTokens`, so even without the temperature problem, a 500 token budget could be spent on reasoning before any JSON is written.

If a swap returns a 400, fix it in `lambda/handler.ts`: delete `temperature: 0` and raise `maxTokens` to a few thousand so the reasoning has room. You lose run to run consistency, which is worth knowing before you rely on it on stage.

Confirmed against a real account, so you can use this as a starting point:

| Model               | Handler works unchanged? |
| ------------------- | ------------------------ |
| Claude Haiku 4.5    | Yes                      |
| Claude Sonnet 4.6   | Yes                      |
| Amazon Nova Lite    | Yes                      |
| Amazon Nova Micro   | Yes                      |
| Claude Sonnet 5.5   | No. Rejects `temperature` |
| Claude Haiku 5.5    | No. Rejects `temperature` |

Do not trust that table over your own account. Model behaviour changes with every release, which is exactly why the handler logs the raw reply as `Model said:` rather than assuming a swap worked.

### Task timed out

The log ends with `Task timed out after 3.00 seconds`. You are on `milestone-1`, which has no timeout set. Milestones 2 and 3 set it to 30 seconds.

### ResourceNotFoundException from aws logs tail

The log group does not exist yet. Lambda creates it on the first invoke. Invoke the function once, then tail again.

### I uploaded a file and nothing happened

No logs at all means the function never ran, so the trigger did not fire.

1. Did you upload into `incoming/`? It has to be inside that prefix. `aws s3 cp file.txt s3://$BUCKET/` will not trigger anything
2. Are you on `milestone-3`? Milestones 1 and 2 have no bucket and no trigger
3. Check the bucket is the one the stack made: `aws s3 ls s3://$BUCKET/incoming/`

### The function runs over and over

You are in the recursive loop, which means the trigger lost its prefix filter. Stop it first, then fix it.

```bash
# Halt every invocation immediately.
aws lambda put-function-concurrency \
  --function-name catch-a-phish \
  --reserved-concurrent-executions 0
```

Then confirm your stack still has `{ prefix: "incoming/" }` on the event notification, deploy, and remove the concurrency limit:

```bash
aws lambda delete-function-concurrency --function-name catch-a-phish
```

AWS has a safety net called recursive loop detection that stops a runaway function after about 16 cycles. Treat it as a smoke alarm, not a plan. Background: [Lambda recursive loop detection](https://docs.aws.amazon.com/lambda/latest/dg/invocation-recursion.html).

### "verdict": "error" in the report

The model replied with something that was not the JSON we asked for. The code returns an error verdict instead of crashing, which is intended. Look for `Model said:` in the logs to see the raw reply. Upload the file again, since models vary between runs.

## Clean up

```bash
npx cdk destroy
```

Type `y` to confirm. This deletes the function, the role, the log group, and the bucket.

The bucket is set to `removalPolicy: DESTROY` with `autoDeleteObjects: true`, so it empties itself on the way out. That is the right setting for a tutorial and the wrong setting for anything you care about keeping.

Check that it is gone:

```bash
aws cloudformation describe-stacks --stack-name CatchAPhishStack
```

That should now say the stack does not exist.

Keep your billing alarm. It costs nothing and it protects every future project.

## Where to go next

### Put SQS between S3 and Lambda

Today S3 calls Lambda directly. If Bedrock is slow or rate limited, that run fails and the email is dropped.

Have S3 write to an SQS queue and have Lambda read from the queue instead. Failed messages are retried automatically, and a dead letter queue catches the ones that never succeed. This is the standard pattern for anything that matters.

Start with: [Using Lambda with Amazon SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)

### Store the verdicts in DynamoDB

Right now every report is a separate file, so you cannot ask "show me every phishing email from last week."

Add a DynamoDB table and write one row per email, with the verdict and risk score as attributes. In CDK that is a `Table` construct, a `grantWriteData(fn)` call, and about ten lines in the handler.

Start with: [DynamoDB getting started](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GettingStartedDynamoDB.html)

### Email yourself when something is phishing

Nobody is watching the `reports/` folder. Use SNS to push an alert when the verdict is `phishing` and the risk score is above, say, 80.

That is a `Topic` construct, a subscription with your email address, and a few lines in the handler.

Start with: [Amazon SNS getting started](https://docs.aws.amazon.com/sns/latest/dg/sns-getting-started.html)

### Try a different model, and watch what changes

This is the most interesting exercise here, so do this one if you only do one.

Everything about the model lives in one value. Swap it and redeploy:

```bash
npx cdk deploy -c modelId=amazon.nova-lite-v1:0
npx cdk deploy -c modelId=us.anthropic.claude-sonnet-4-6
```

That is the whole change. No code edits, not even for Amazon's own model. This is why the handler reads the model from an environment variable and talks to Bedrock through the Converse API, which has the same request shape for every model.

Re-upload the samples after each swap and compare. Four models were run against all four sample emails with the same prompt and the same settings, and the full matrix is in [docs/model-comparison.md](docs/model-comparison.md). Three findings are worth more than a lecture.

**The obvious scam told us nothing.** Every model caught `obvious-scam.txt`, from cheapest to most expensive. Had you tested with only that email, you would have shipped the cheapest model and felt good about it. One email in four did all the discriminating.

**The cheapest model was not worse, it was wrong.** Nova Micro labels `sneaky-scam.txt` as `legitimate`, risk 30, with an empty red flag list. In a real inbox that email goes through, and the tool that let it through reports no concerns at all.

**The highest risk score came from the weakest reasoning.** On that same email, Nova Lite scored 70, higher than either Claude model, reasoning only that there was "a specific deadline and a link to an external site". Claude Sonnet 4.6 scored it 42, the lowest of the three that got it right, and was the only model of the four to name the actual tell:

> sender domain (northbridge-edu.example.net) differs from recipient domain (northbridge.example.edu)

`northbridge-edu.example.net` is not `northbridge.example.edu`. Claude Haiku 4.5 got this backwards and said the sender domain "appears legitimate". Nova did not look at the domain at all.

So the model with the best reasoning produced the least alarming number. With an alert threshold at 50, the correct answer is filtered out and the shallow one fires.

### What to take from this

A number out of a model is not a measurement of that model. It is the model's opinion, and a confident opinion from a weak model looks exactly like a confident opinion from a strong one. You only found out which was which by reading the reasoning on the one hard case.

That is the actual job. Not finding the smartest model, but deciding which failure you can live with, then measuring whether a model gives you that, at a price you can afford, before you ship it.

### Things to try next

- Run the same email three times on the same model. The answers move. Anything you conclude from a single run is noise, including the numbers in that comparison
- Write an email that Nova Lite gets right and Sonnet overthinks. They exist
- Pick an alert threshold, then count how many of the four samples land on the wrong side of it for each model
- Change the prompt instead of the model. Add one line telling it to compare the sender domain against any link domains, then re-run Haiku on `sneaky-scam.txt`. A better prompt is usually cheaper than a better model

### Two practical notes

- Access is per model, per region, and per account. Before you rely on any model here, prove you can reach it with the `converse` command from Prerequisites step 6
- The newest models think before answering and reject `temperature`, which the handler sends. If a swap returns a 400, read the Troubleshooting note on thinking, temperature, and swapping models
