import { Hono } from 'hono';
import { OpenAIToolSet, ComposioError, COMPOSIO_SDK_ERROR_CODES, VercelAIToolSet } from "composio-core"
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

interface Env {
    AI: {
        run: (model: string, options: any) => Promise<any>;
    };
    COMPOSIO_API_KEY: string;
    OPENAI_API_KEY: string;
    ANTHROPIC_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

const model = "gpt-4-turbo";

async function checkIfActiveConnectionExists(toolset: VercelAIToolSet, appName: string, entityId: string) {
  const entity = await toolset.client.getEntity(entityId);
  try { 
    await entity.getConnection({app: appName});
    return true;
  } catch (err) {
    if (err instanceof ComposioError && err.errCode === COMPOSIO_SDK_ERROR_CODES.SDK.NO_CONNECTED_ACCOUNT_FOUND) {
      return false;
    }
    throw err;
  }
}

async function setupUserConnectionIfNotExists(toolset: VercelAIToolSet, appName: string, entityId: string) {
  const entity = await toolset.client.getEntity(entityId);
  try {
  await entity.getConnection({ appName: appName });

  return {
    message: 'Connection already exists',
  };
} catch (err) {
  if(err instanceof ComposioError && err.errCode === COMPOSIO_SDK_ERROR_CODES.SDK.NO_CONNECTED_ACCOUNT_FOUND) {
    // If this entity/user hasn't already connected the account
    const connection = await entity.initiateConnection({ appName: appName });
    return {
      redirectUrl: connection.redirectUrl,
      message: 'Please log in to continue and then call this API again with this url :' + connection.redirectUrl
    }
  }
  return {
    message: 'Something went wrong',
    error: JSON.stringify(err)
  };
}
}

app.get('/auth_github', async (c) => {
  // this only works for oauth apps
  const entityId = c.req.query('entityId');
  const toolset = new VercelAIToolSet({ apiKey: c.env.COMPOSIO_API_KEY });

  // const app = await toolset.apps.get({ appKey: 'github' });
  // if(!app.auth_schemes?.find((a) => a.mode === 'OAUTH2' || a.mode === 'OAUTH1')) {
  //   // Handle authentication differently for Non-OAuth app
  // }
  const entity = await toolset.client.getEntity(entityId);
  const connection = await setupUserConnectionIfNotExists(toolset, 'github', entity.id);
  return c.json(connection);
})


app.post('/execute_github_task', async (c) => {
    const toolset = new VercelAIToolSet({ apiKey: c.env.COMPOSIO_API_KEY });
    const entityId = c.req.query('entityId');

    if(!checkIfActiveConnectionExists(toolset, 'github', entityId!)) {
      return c.json({ error: 'No active connection found. Please use /auth and complete the flow to authenticate' }, 400);
    }

    try {

      const tools = await toolset.getTools({ apps: ["github"], tags: ['important'] });
        const instruction = 'Star the repository "composiohq/composio"';


        const output = await generateText({
          model: createAnthropic({ apiKey: c.env.ANTHROPIC_API_KEY })("claude-3-5-sonnet-20240620"),
          tools,
          prompt: instruction,
      });
        return c.json({ messages: output });
    } catch (err) {
        console.log(err);
        return c.text('Something went wrong', 500);
    }
});

export default app;
