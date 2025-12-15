# Gemini Image MCP

A Model Context Protocol (MCP) server for AI image generation using Google's Gemini 3.0 models (Nano Banana Pro).

## Features

- **generate_image** - Create images from text prompts with up to 4K resolution
- **edit_image** - Modify existing images with instructions, style transfer, multi-image mixing
- **describe_image** - Analyze and describe images
- **Reference Images** - Support for up to 14 reference images for style/content guidance

## Installation

```bash
npm install
npm run build
```

## Configuration

### Claude Code CLI

```bash
claude mcp add gemini-image --env GEMINI_API_KEY=your_key -- node /path/to/dist/index.js
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gemini-image": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Zed Editor

<details>
<summary>Click to expand installation prompt for Zed</summary>

Copy and paste this prompt to your Zed AI assistant:

```
Install the gemini-image MCP server for me. Here's what you need to do:

1. Clone the repo and build it:
   git clone https://github.com/dfeirstein/gemini-image-mcp.git ~/.config/zed/mcp-servers/gemini-image-mcp
   cd ~/.config/zed/mcp-servers/gemini-image-mcp
   npm install
   npm run build

2. Add this to my Zed settings.json under "context_servers":
   {
     "context_servers": {
       "gemini-image": {
         "command": {
           "path": "node",
           "args": ["~/.config/zed/mcp-servers/gemini-image-mcp/dist/index.js"],
           "env": {
             "GEMINI_API_KEY": "YOUR_API_KEY_HERE"
           }
         }
       }
     }
   }

3. Remind me to replace YOUR_API_KEY_HERE with my actual Gemini API key from https://aistudio.google.com/apikey

The MCP provides three tools: generate_image, edit_image, and describe_image using Google's Gemini 3.0 (Nano Banana Pro) models.
```

</details>

## Get API Key

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

**Note:** Gemini 3 Pro Image (Nano Banana Pro) requires billing enabled - no free tier.

## Usage Examples

### Generate Image
```
Generate a cyberpunk cityscape at night with neon lights
```

With high resolution:
```
Generate a detailed landscape at 4K resolution
```

### Edit Image
```
Add sunglasses to this photo
Remove the background
Apply a watercolor style
```

### Describe Image
```
What objects are in this image?
Describe the mood and composition
```

## Models

| Model | ID | Description |
|-------|-----|-------------|
| Nano Banana Pro | `gemini-3-pro-image-preview` | Best quality, up to 4K resolution (default) |
| Flash | `gemini-2.5-flash-preview-05-20` | Faster, good for descriptions |
| Legacy | `gemini-2.0-flash-exp` | Fallback option |

## Parameters

### Image Size (Nano Banana Pro)
- `1K` - Standard resolution (default)
- `2K` - High resolution
- `4K` - Ultra high resolution

### Aspect Ratio
- `1:1` - Square (default)
- `3:4` - Portrait
- `4:3` - Landscape
- `9:16` - Tall portrait
- `16:9` - Widescreen

## License

MIT
