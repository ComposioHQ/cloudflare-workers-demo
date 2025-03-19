/*
Simple example to first connect an entity's account 

import { Hono } from 'hono';
import { OpenAIToolSet } from "composio-core";
import OpenAI from "openai";

const app = new Hono();

const setupUserConnection = async (toolset, entityId) => {
  const entity = await toolset.client.getEntity(entityId);
  const connection = await entity.getConnection('github');
  if (!connection) {
    const newConnection = await entity.initiateConnection('github');
    console.log('Log in via: ', newConnection.redirectUrl);
    return { redirectUrl: newConnection.redirectUrl, message: 'Please log in to continue and then call this API again' };
  }
  return connection;
};

app.post('/', async (c) => {
  try {
    const openaiClient = new OpenAI({ apiKey: c.env.OPENAI_API_KEY });
    const toolset = new OpenAIToolSet({ apiKey: c.env.COMPOSIO_API_KEY });

    const entity = await toolset.client.getEntity('default2');
    const connection = await setupUserConnection(toolset, entity.id);
    if (connection.redirectUrl) return c.json(connection);

    const tools = await toolset.getTools({ actions: ['github_issues_create'] }, entity.id);
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful assistant that creates GitHub issues." },
        { role: "user", content: "Create an issue with the title 'Sample Issue' in the repo anonthedev/break. Use only the provided tools." }
      ],
      tools,
      tool_choice: "auto",
    });

    const result = await toolset.handleToolCall(response, entity.id);
    return c.json({ message: "Issue has been created successfully", result });
  } catch (err) {
    console.error('Error:', err);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
});

export default app;

*/

import { Hono } from 'hono';
import { OpenAIToolSet } from "composio-core"
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";


interface Env {
    AI: {
        run: (model: string, options: any) => Promise<any>;
    };
}

const app = new Hono<{ Bindings: Env }>();

const entityId = 'default2';
const model = "gpt-4o";

async function setupUserConnectionIfNotExists(t({}): string | undefined) {
  const entity = await toolset.client.getEntity(entityId);
  const connection = await entity.getConnection("googlesheets");

  if (!connection) {
    // If this entity/user hasn't already connected the account
    const connection = await entity.initiateConnection("googlesheets");
    console.log("Log in via: ", connection.redirectUrl);
    return connection.waitUntilActive(60);
  }

  return connection;
}

app.post('/auth', async (c) => {
  // this only works for oauth apps

  const toolset = new OpenAIToolSet({ apiKey: c.env.COMPOSIO_API_KEY });
  const entity = await toolset.client.getEntity(entityId);
  const connection = await setupUserConnectionIfNotExists(toolset, entity.id);
  if (connection.redirectUrl) return c.json(connection);
})


app.post('/', async (c) => {
    const toolset = new OpenAIToolSet({ apiKey: c.env.COMPOSIO_API_KEY });
    const openaiClient = new OpenAI({ apiKey: c.env.OPENAI_API_KEY });
    try {
      const tools = await toolset.getTools({ apps: ['github'],tags: ['important'] });
      console.log(tools)
        const instruction = 'Star the repository "composiohq/composio"';

        // const messages = [
        //   {
        //     role: "user",
        //     content: instruction,
        //   }
        // ]
        await setupUserConnectionIfNotExists(toolset, entityId);
        const maxTokens = 1024;
        const res = await openaiClient.chat.completions.create({
          model,
          messages: [{
            role: "user" as const,
            content: instruction
          }],
          tools,
          tool_choice: "auto"
        });
        // const config = {
        //     model: '',
        // };

        // const toolCallResp = await c.env.AI.run(config.model, {
        //     messages,
        //     tools,
        // });

        await toolset.handleToolCall(res, entityId);
        console.log(res)
        return c.json({ messages: res });
    } catch (err) {
        console.log(err);
        return c.text('Something went wrong', 500);
    }
});

export default app;
