#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

// Types
interface GenerateImageParams {
  prompt: string;
  model?: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  imageSize?: "1K" | "2K" | "4K";
  outputPath?: string;
  referenceImages?: Array<{ data: string; mimeType: string }>;
}

interface EditImageParams {
  prompt: string;
  images: Array<{ data: string; mimeType: string }>;
  model?: string;
  imageSize?: "1K" | "2K" | "4K";
  outputPath?: string;
}

interface DescribeImageParams {
  images: Array<{ data: string; mimeType: string }>;
  prompt?: string;
  model?: string;
}

// Available models - Gemini 3.0 with Nano Banana Pro
const MODELS = {
  PRO: "gemini-3-pro-image-preview", // Nano Banana Pro - best quality, up to 4K
  FLASH: "gemini-2.5-flash-preview-05-20", // Fast model for descriptions
  LEGACY: "gemini-2.0-flash-exp", // Legacy fallback
} as const;

const DEFAULT_MODEL = MODELS.PRO;

// Tool definitions
const tools: Tool[] = [
  {
    name: "generate_image",
    description:
      "Generate an image using Google Gemini 3.0 (Nano Banana Pro). Supports up to 4K resolution and up to 14 reference images for style/content guidance.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Detailed description of the image to generate",
        },
        model: {
          type: "string",
          description: `Model to use: "${MODELS.PRO}" (default, Nano Banana Pro - best quality up to 4K), "${MODELS.FLASH}" (faster), or "${MODELS.LEGACY}" (legacy)`,
          enum: Object.values(MODELS),
          default: MODELS.PRO,
        },
        aspectRatio: {
          type: "string",
          description: "Aspect ratio of the generated image",
          enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
          default: "1:1",
        },
        imageSize: {
          type: "string",
          description:
            "Resolution of the generated image (Nano Banana Pro supports up to 4K)",
          enum: ["1K", "2K", "4K"],
          default: "1K",
        },
        outputPath: {
          type: "string",
          description:
            "Optional file path to save the image (e.g., ./output/image.png)",
        },
        referenceImages: {
          type: "array",
          description:
            "Optional reference images to guide generation (up to 14 images for style, object, or layout references)",
          items: {
            type: "object",
            properties: {
              data: {
                type: "string",
                description: "Base64 encoded image data",
              },
              mimeType: {
                type: "string",
                description: "MIME type (e.g., image/png)",
              },
            },
            required: ["data", "mimeType"],
          },
          maxItems: 14,
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "edit_image",
    description:
      "Edit one or more images using Google Gemini 3.0 (Nano Banana Pro). Supports style transfer, object manipulation, and multi-image mixing.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Instructions for how to edit the image(s)",
        },
        images: {
          type: "array",
          description: "Images to edit (up to 14 images)",
          items: {
            type: "object",
            properties: {
              data: {
                type: "string",
                description: "Base64 encoded image data",
              },
              mimeType: {
                type: "string",
                description: "MIME type (e.g., image/png)",
              },
            },
            required: ["data", "mimeType"],
          },
          minItems: 1,
          maxItems: 14,
        },
        model: {
          type: "string",
          description: "Model to use",
          enum: Object.values(MODELS),
          default: MODELS.PRO,
        },
        imageSize: {
          type: "string",
          description: "Resolution of the output image",
          enum: ["1K", "2K", "4K"],
          default: "1K",
        },
        outputPath: {
          type: "string",
          description: "Optional file path to save the edited image",
        },
      },
      required: ["prompt", "images"],
    },
  },
  {
    name: "describe_image",
    description:
      "Analyze and describe one or more images using Google Gemini. Returns text description only.",
    inputSchema: {
      type: "object",
      properties: {
        images: {
          type: "array",
          description: "Images to analyze",
          items: {
            type: "object",
            properties: {
              data: {
                type: "string",
                description: "Base64 encoded image data",
              },
              mimeType: {
                type: "string",
                description: "MIME type (e.g., image/png)",
              },
            },
            required: ["data", "mimeType"],
          },
          minItems: 1,
        },
        prompt: {
          type: "string",
          description: "Custom analysis prompt (default: general description)",
        },
        model: {
          type: "string",
          description: "Model to use",
          enum: Object.values(MODELS),
          default: MODELS.PRO,
        },
      },
      required: ["images"],
    },
  },
];

class GeminiImageMCP {
  private server: Server;
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.server = new Server(
      { name: "gemini-image-mcp", version: "2.0.0" },
      { capabilities: { tools: {} } },
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools,
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "generate_image":
            return await this.generateImage(
              args as unknown as GenerateImageParams,
            );
          case "edit_image":
            return await this.editImage(args as unknown as EditImageParams);
          case "describe_image":
            return await this.describeImage(
              args as unknown as DescribeImageParams,
            );
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  private async generateImage(params: GenerateImageParams) {
    const {
      prompt,
      model = DEFAULT_MODEL,
      aspectRatio = "1:1",
      imageSize = "1K",
      outputPath,
      referenceImages,
    } = params;

    // Build generation config with Gemini 3.0 imageConfig
    const generationConfig: any = {
      responseModalities: ["IMAGE", "TEXT"],
    };

    // Add imageConfig for Gemini 3.0 models
    if (model === MODELS.PRO) {
      generationConfig.imageConfig = {
        aspectRatio,
        imageSize,
      };
    } else {
      // Legacy config for older models
      generationConfig.aspectRatio = aspectRatio;
    }

    const genModel = this.genAI.getGenerativeModel({
      model,
      generationConfig,
    });

    // Build content parts
    const parts: any[] = [];

    // Add reference images if provided (Gemini 3.0 supports up to 14)
    if (referenceImages && referenceImages.length > 0) {
      for (const img of referenceImages) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data,
          },
        });
      }
    }

    parts.push({ text: prompt });

    const result = await genModel.generateContent(parts);
    const response = result.response;

    // Extract image from response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No response generated");
    }

    const content = candidates[0].content;
    if (!content || !content.parts) {
      throw new Error("No content in response");
    }

    // Find the image part
    let imageData: string | null = null;
    let mimeType = "image/png";
    let textResponse = "";

    for (const part of content.parts) {
      if (part.inlineData) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      }
      if (part.text) {
        textResponse += part.text;
      }
    }

    if (!imageData) {
      throw new Error("No image generated. Model response: " + textResponse);
    }

    // Save to file if path provided
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, Buffer.from(imageData, "base64"));
    }

    return {
      content: [
        {
          type: "image",
          data: imageData,
          mimeType,
        },
        {
          type: "text",
          text: outputPath
            ? `Image generated (${imageSize}) and saved to: ${outputPath}`
            : `Image generated successfully (${imageSize})`,
        },
      ],
    };
  }

  private async editImage(params: EditImageParams) {
    const {
      prompt,
      images,
      model = DEFAULT_MODEL,
      imageSize = "1K",
      outputPath,
    } = params;

    // Build generation config with Gemini 3.0 imageConfig
    const generationConfig: any = {
      responseModalities: ["IMAGE", "TEXT"],
    };

    // Add imageConfig for Gemini 3.0 models
    if (model === MODELS.PRO) {
      generationConfig.imageConfig = {
        imageSize,
      };
    }

    const genModel = this.genAI.getGenerativeModel({
      model,
      generationConfig,
    });

    // Build content with images first, then instruction
    const parts: any[] = images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    }));
    parts.push({ text: prompt });

    const result = await genModel.generateContent(parts);
    const response = result.response;

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No response generated");
    }

    const content = candidates[0].content;
    if (!content || !content.parts) {
      throw new Error("No content in response");
    }

    let imageData: string | null = null;
    let mimeType = "image/png";

    for (const part of content.parts) {
      if (part.inlineData) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      }
    }

    if (!imageData) {
      throw new Error("No edited image generated");
    }

    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, Buffer.from(imageData, "base64"));
    }

    return {
      content: [
        {
          type: "image",
          data: imageData,
          mimeType,
        },
        {
          type: "text",
          text: outputPath
            ? `Image edited (${imageSize}) and saved to: ${outputPath}`
            : `Image edited successfully (${imageSize})`,
        },
      ],
    };
  }

  private async describeImage(params: DescribeImageParams) {
    const {
      images,
      prompt = "Describe this image in detail.",
      model = MODELS.PRO,
    } = params;

    const genModel = this.genAI.getGenerativeModel({ model });

    const parts: any[] = images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    }));
    parts.push({ text: prompt });

    const result = await genModel.generateContent(parts);
    const response = result.response;
    const text = response.text();

    return {
      content: [{ type: "text", text }],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Gemini Image MCP server (Nano Banana Pro) running on stdio");
  }
}

// Start the server
const server = new GeminiImageMCP();
server.run().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
