# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode for development
npm run test         # Run tests (node --test dist/*.test.js)
npm start            # Run the compiled server
```

## Architecture

This is an MCP (Model Context Protocol) server that provides AI image generation capabilities using Google's Gemini 3.0 models (Nano Banana Pro). The entire server is implemented in a single file: `src/index.ts`.

### Core Structure

- **GeminiImageMCP class**: Main server class that initializes the Gemini AI client and sets up MCP request handlers
- **Tool definitions**: Three tools exposed via MCP - `generate_image`, `edit_image`, `describe_image`
- **Transport**: Uses stdio transport for communication with MCP clients

### Gemini Models

- `gemini-3-pro-image-preview` (default) - Nano Banana Pro, best quality, supports up to 4K resolution
- `gemini-2.5-flash-preview-05-20` - Faster model for quick operations
- `gemini-2.0-flash-exp` - Legacy fallback

### Key Patterns

- Images are passed as base64-encoded data with MIME types
- Supports up to 14 reference images for style/content guidance
- `imageSize` parameter: "1K", "2K", or "4K" resolution (Nano Banana Pro feature)
- All tools accept optional `outputPath` to save images to disk
- Error handling returns `{ isError: true }` in MCP response format
- Gemini 3.0 uses `imageConfig` object with `aspectRatio` and `imageSize` properties
- The `responseModalities: ["IMAGE", "TEXT"]` config is required for image generation

## Environment

Requires `GEMINI_API_KEY` environment variable. Get a key from https://aistudio.google.com/apikey

Note: Gemini 3 Pro Image (Nano Banana Pro) requires billing enabled - no free tier.
