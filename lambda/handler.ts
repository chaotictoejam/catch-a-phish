// Milestone 1: the function code.
//
// It logs whatever it was invoked with and returns a message. That is all.
// Milestone 2 replaces this with a real Bedrock call.

export const handler = async (event: unknown) => {
  // Anything you console.log here ends up in CloudWatch Logs, which is where
  // you will spend most of your debugging time. Logging the whole event is a
  // good habit: it shows you the exact shape of what triggered the function.
  console.log("Event:", JSON.stringify(event, null, 2));

  return { message: "Hello from Lambda!" };
};
