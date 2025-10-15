# Image Generation Setup

This document describes how to configure real AI image generation providers for the Designer Boards feature.

## Environment Variables

Add these to your `.env` file:

```bash
# Primary provider (default: openai)
IMAGE_GEN_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_IMAGE_MODEL=gpt-image-1

# Optional: Stability AI fallback
STABILITY_API_KEY=your-stability-api-key-here
STABILITY_ENGINE=stable-image-ultra

# Optional: Force fake provider for development
FAKE_PROVIDER=0

# Rate limiting
IMAGE_GEN_MAX_PER_HOUR=10
```

## Provider Options

### 1. OpenAI (Recommended)
- **Provider**: `openai`
- **Model**: `gpt-image-1` (latest)
- **Quality**: High-quality images with excellent text rendering
- **Supported Sizes**: 1024x1024, 1792x1024, 1024x1792, 1536x1024, 1024x1536, 512x512, 256x256
- **Cost**: Pay-per-generation
- **Setup**: Get API key from [OpenAI Platform](https://platform.openai.com)

### 2. Stability AI (Fallback)
- **Provider**: `stability`
- **Engine**: `stable-image-ultra` (recommended)
- **Quality**: Good diffusion-style images
- **Supported Sizes**: Any dimensions
- **Cost**: Pay-per-generation
- **Setup**: Get API key from [Stability AI](https://platform.stability.ai)

### 3. Fake Provider (Development)
- **Provider**: `fake` or set `FAKE_PROVIDER=1`
- **Quality**: Placeholder images for testing
- **Use Case**: Development and testing without API costs

## Usage

1. **Set up environment variables** in your `.env` file
2. **Restart the development server** to load new environment variables
3. **Navigate to Designer Boards** in any project
4. **Select a room** from the dropdown
5. **Click "Generate Images"** to open the generation dialog
6. **Configure your prompt** and settings
7. **Click "Generate"** to create images

## Features

- **Context-aware prompts**: Automatically includes room selections in the base prompt
- **Custom modifiers**: Add style, lighting, and mood instructions
- **Multiple sizes**: Choose from preset dimensions
- **Rate limiting**: Built-in protection against API abuse
- **Provider badges**: Visual indicators showing which AI generated each image
- **Error handling**: Graceful fallbacks and user-friendly error messages

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY missing"**
   - Ensure your API key is correctly set in `.env`
   - Restart the development server after adding the key

2. **"Generation returned no images"**
   - Check your API key has sufficient credits
   - Verify the prompt isn't blocked by content filters
   - Try a simpler prompt

3. **Rate limit errors**
   - Wait before generating more images
   - Consider increasing `IMAGE_GEN_MAX_PER_HOUR` if needed

4. **Provider fallback**
   - If OpenAI fails, the system will fall back to fake provider
   - Check server logs for specific error messages

### Testing

To test without API costs:
```bash
FAKE_PROVIDER=1 npm run dev
```

This will use placeholder images instead of calling real AI providers.