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
        skills: request.skills || [],
        ...(request.resumeSessionId === "new"
          ? {}
          : request.resumeSessionId
            ? { resume: request.resumeSessionId }
            : { continue: true }
        ),
      },
    });

    for await (const message of response) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") {
            console.log(JSON.stringify({ type: "response", text: block.text }));
          } else if (block.type === "tool_use") {
            console.log(JSON.stringify({
              type: "tool_call",
              name: block.name,
              input: block.input
            }));
          }
        }
      } else if (message.type === "tool_result") {
        console.log(JSON.stringify({
          type: "tool_result",
          name: message.tool_name,
          result: message.result
        }));
      } else if (message.type === "result") {
        console.log(JSON.stringify({ type: "done", session_id: message.session_id }));
      }
    }
  } catch (error) {
    console.log(JSON.stringify({ type: "error", message: error.message }));
    console.log(JSON.stringify({ type: "done" }));
  }
});
