const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({ 
  region: process.env.AWS_REGION_BEDROCK || 'us-east-1' 
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const body = JSON.parse(event.body);
    const { prompt, max_tokens = 500, temperature = 0.7 } = body;

    if (!prompt) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'prompt is required' })
      };
    }

    // Prepare Bedrock request for Claude
    const bedrockBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(bedrockBody)
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract the text content from Claude's response
    const content = responseBody.content?.[0]?.text || '';

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        completion: content,
        usage: responseBody.usage
      })
    };

  } catch (error) {
    console.error('Bedrock error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to invoke Bedrock',
        message: error.message 
      })
    };
  }
};
