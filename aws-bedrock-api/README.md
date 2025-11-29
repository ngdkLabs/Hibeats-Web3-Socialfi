# AWS Bedrock API for YourVibe

Backend API untuk mengakses AWS Bedrock dari frontend YourVibe.

## Setup

### 1. Prerequisites
- AWS Account dengan akses ke Bedrock
- AWS CLI configured
- Node.js 18+

### 2. Enable Bedrock Model Access
1. Buka AWS Console → Amazon Bedrock
2. Pilih "Model access" di sidebar
3. Request access untuk "Claude 3 Haiku" (anthropic.claude-3-haiku-20240307-v1:0)
4. Tunggu approval (biasanya instant)

### 3. Deploy dengan AWS SAM

```bash
cd aws-bedrock-api
sam build
sam deploy --guided
```

### 4. Configure Frontend
Setelah deploy, copy API Gateway URL dan API Key ke `.env`:

```env
VITE_BEDROCK_API_ENDPOINT=https://xxx.execute-api.us-east-1.amazonaws.com/prod
VITE_BEDROCK_API_KEY=your-api-key
```

## API Endpoints

### POST /analyze
Analyze user context dan generate vibe recommendations.

Request:
```json
{
  "prompt": "...",
  "max_tokens": 500,
  "temperature": 0.7
}
```

### POST /chat
Chat dengan AI untuk music discovery.

Request:
```json
{
  "system": "...",
  "messages": [
    { "role": "user", "content": "..." }
  ],
  "max_tokens": 300,
  "temperature": 0.8
}
```

## Cost Estimation
- Claude 3 Haiku: ~$0.00025 per 1K input tokens, ~$0.00125 per 1K output tokens
- Estimated cost per vibe analysis: ~$0.001-0.002
- Very cost-effective for production use

## Alternative: Use Existing API
Jika tidak ingin deploy sendiri, bisa gunakan:
1. AWS Bedrock via API Gateway (recommended)
2. Anthropic API langsung (perlu CORS proxy)
3. OpenAI API sebagai alternatif
