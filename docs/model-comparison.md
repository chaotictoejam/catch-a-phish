# Four models, four emails

Same prompt. Same four sample emails. Same settings this project deploys (`temperature: 0`, `maxTokens: 500`). Only the model changed.

| Email                 | Nova Micro        | Nova Lite     | Claude Haiku 4.5 | Claude Sonnet 4.6 |
| --------------------- | ----------------- | ------------- | ---------------- | ----------------- |
| `obvious-scam.txt`    | phishing 95       | phishing 95   | phishing 98      | phishing 99       |
| `sneaky-scam.txt`     | **legitimate 30** | suspicious 70 | suspicious 62    | suspicious 42     |
| `legit-bank.txt`      | legitimate 20     | legitimate 10 | legitimate 5     | legitimate 5      |
| `legit-professor.txt` | legitimate 10     | legitimate 10 | legitimate 2     | legitimate 3      |

## 1. The easy email told us nothing

Every model caught `obvious-scam.txt`, from cheapest to most expensive. Test with only that one and you would ship the cheapest model and feel good about it.

One email in four did all of the discriminating.

## 2. The cheapest model was not worse, it was wrong

Nova Micro called a phishing email `legitimate`. Risk 30. Red flags: none. Its explanation:

> The email appears to be from an internal service desk and contains a legitimate request for multi-factor authentication.

That is not a near miss. In a real inbox that email goes through, and the tool that let it through reported no concerns at all.

## 3. The highest score came from the weakest reasoning

Look at `sneaky-scam.txt` again.

**Nova Lite scored it 70**, higher than either Claude model. Its entire reasoning:

> The email requests immediate action with a specific deadline and includes a link to an external site.

**Claude Sonnet 4.6 scored it 42**, the lowest of the three that got it right, and was the only model of the four to find the actual tell:

> sender domain (northbridge-edu.example.net) differs from recipient domain (northbridge.example.edu)

That is the scam. `northbridge-edu.example.net` is not `northbridge.example.edu`. Claude Haiku 4.5 got it backwards and said the sender domain "appears legitimate". Nova did not look at the domain at all.

So the model with the best reasoning produced the least alarming number. With an alert threshold at 50, the correct answer gets filtered out and the shallow one fires.

## What to take from it

A number out of a model is not a measurement of that model. It is the model's opinion, and a confident opinion from a weak model looks exactly like a confident opinion from a strong one.

The only way to tell them apart was to read the reasoning on the one hard case.

Picking a model is not about finding the smartest one. It is deciding which failure you can live with, then measuring whether you got it, at a price you can afford, before you ship.

## Reproduce it

```bash
npx cdk deploy -c modelId=amazon.nova-micro-v1:0
aws s3 cp samples/ s3://$BUCKET/incoming/ --recursive
aws s3 cp s3://$BUCKET/reports/sneaky-scam.json -
```

Then try `amazon.nova-lite-v1:0`, `us.anthropic.claude-haiku-4-5-20251001-v1:0`, and `us.anthropic.claude-sonnet-4-6`.

Your numbers will not match this table exactly. Models vary between runs, which is its own lesson: run each email three times before you conclude anything.

Cost, for scale: Haiku 4.5 is roughly a tenth of a cent per email, Sonnet 4.6 about three times that, Nova less than either. Across this tutorial the difference is a few cents. At a million emails a month it is the whole budget conversation.
