import axios from 'axios';
import { Configuration, OpenAIApi } from 'openai';
import vm from 'vm';

import {
  MEMBER_FUNCTION_EXAMPLE,
  MEMBER_QUERY_EXAMPLE,
  RAID_FUNCTION_EXAMPLE,
  RAID_QUERY_EXAMPLE
} from '@/generate/examples';
import { SCHEMAS } from '@/generate/schemas';
import {
  HASURA_GRAPHQL_ADMIN_SECRET,
  HASURA_GRAPHQL_ENDPOINT,
  OPENAI_API_KEY
} from '@/utils/constants';

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

const generatePrompt = (prompt: string) => {
  return `
    Based on the following schemas, how would you query in GraphQL to get the data you need?
    The question I am asking is: ${prompt}

    The schemas are:

    ${SCHEMAS}

    An example would be:
    
    ${RAID_QUERY_EXAMPLE}
    
    OR
    
    ${MEMBER_QUERY_EXAMPLE}

    IMPORTANT: Don't respond with anything except the exact query. Return all fields for an entity, even if they are not needed.
  `;
};

const fetchAPIData = async (query: string): Promise<{ data: unknown }> => {
  try {
    const headers = {
      'x-hasura-admin-secret': HASURA_GRAPHQL_ADMIN_SECRET
    };

    const response = await axios({
      url: HASURA_GRAPHQL_ENDPOINT,
      method: 'post',
      headers,
      data: {
        query
      }
    });

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const generateFormattingFunction = (prompt: string) => {
  return `
  The question I am asking is: ${prompt}

  The schemas are:

  ${SCHEMAS}

  An example of returned data would be:

  ${RAID_FUNCTION_EXAMPLE}
  
  OR
  
  ${MEMBER_FUNCTION_EXAMPLE}

  Based on returned data, write a function that returns the data formatted as the answer to the above question. You don't need to do anything complicated (no loops or equality checks). Just return the data in the format that the question is asking for.

  IMPORTANT: Don't respond with anything except the function. Call the function "parseData" and make sure it takes a single argument called "data". Use the function keyword, not the arrow function syntax. Return a string.
`;
};

export const generateResponse = async (prompt: string): Promise<string> => {
  let completion = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: generatePrompt(prompt)
      }
    ],
    temperature: 0.4,
    max_tokens: 150
  });

  const query = (completion.data.choices[0].message?.content ?? '').trim();

  console.log(`Generated query: ${query}`);

  if (!query) {
    throw new Error('No query generated');
  }

  if (query.includes('mutation')) {
    throw new Error('Query generated is a mutation');
  }

  const data = await fetchAPIData(query);

  console.log(`Fetched data: ${JSON.stringify(data)}`);

  completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: generatePrompt(prompt)
      },
      {
        role: 'assistant',
        content: query
      },
      {
        role: 'user',
        content: generateFormattingFunction(prompt)
      }
    ],
    temperature: 0.1,
    max_tokens: 500
  });

  const generatedFunction = completion.data.choices[0].message?.content;
  const separatedFunction = generatedFunction?.split(
    'function parseData(data) {'
  );
  const functionBody = separatedFunction?.[1] || '';
  const formattedFunction = `function parseData(data) {${functionBody}`;

  console.log(`Generated function: ${formattedFunction}`);

  const script = new vm.Script(formattedFunction);
  const context = vm.createContext({});

  script.runInContext(context);
  return context.parseData(data.data);
};
