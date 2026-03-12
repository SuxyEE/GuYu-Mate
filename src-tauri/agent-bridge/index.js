import { query } from "@anthropic-ai/claude-agent-sdk";
import readline from "readline";

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  try {
    const request = JSON.parse(line);

    const response = query({
      prompt: request.prompt,
      options: {
        apiKey: request.apiKey,
        baseURL: request.baseUrl,
        model: request.model,
        systemPrompt: request.systemPrompt,
        cwd: request.projectPath,
        settingSources: ["user", "project"],
        allowedTools: ["Skill","Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch","WebFetch"],
        includePartialMessages: true,
        ...(request.resumeSessionId === "new"
          ? {}
          : request.resumeSessionId
            ? { resume: request.resumeSessionId }
            : {continue: true}
        ),
      },
    });

    for await (const message of response) {
      if (message.type === "stream_event") {
        const event = message.event;

        if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            console.log(JSON.stringify({
              type: "tool_call",
              name: event.content_block.name,
              input: {}
            }));
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            process.stdout.write(JSON.stringify({ type: "response", text: event.delta.text }) + "\n");
          }
        }
      } else if (message.type === "result") {
        process.stdout.write(JSON.stringify({ type: "done", session_id: message.session_id }) + "\n");
      }
    }
  } catch (error) {
    console.log(JSON.stringify({ type: "error", message: error.message }));
    console.log(JSON.stringify({ type: "done" }));
  }
});
