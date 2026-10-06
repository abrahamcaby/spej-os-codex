import type { IndustrySource } from "./types";

export const spejIndustrySources: IndustrySource[] = [
  { id: "openai", name: "OpenAI", url: "https://openai.com/news/" },
  { id: "anthropic", name: "Anthropic", url: "https://www.anthropic.com/news" },
  { id: "deepmind", name: "Google DeepMind", url: "https://deepmind.google/discover/blog/" },
  { id: "google-ai", name: "Google AI", url: "https://blog.google/technology/ai/" },
  { id: "meta-ai", name: "Meta AI", url: "https://ai.meta.com/blog/" },
  { id: "microsoft-ai", name: "Microsoft AI", url: "https://blogs.microsoft.com/ai/" },
  { id: "nvidia-ai", name: "NVIDIA AI", url: "https://blogs.nvidia.com/blog/category/deep-learning/" },
  { id: "xai", name: "xAI", url: "https://x.ai/news" },
  { id: "mistral", name: "Mistral AI", url: "https://mistral.ai/news" },
  { id: "cohere", name: "Cohere", url: "https://cohere.com/blog" },
  { id: "hugging-face", name: "Hugging Face", url: "https://huggingface.co/blog" },
  { id: "stability-ai", name: "Stability AI", url: "https://stability.ai/news" },
  { id: "techcrunch-ai", name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/" },
  { id: "the-verge-ai", name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence" },
  { id: "venturebeat-ai", name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/" },
  { id: "mit-tech-review-ai", name: "MIT Technology Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/" },
  { id: "ars-ai", name: "Ars Technica AI", url: "https://arstechnica.com/ai/" },
  { id: "wired-ai", name: "WIRED AI", url: "https://www.wired.com/tag/artificial-intelligence/" },
  { id: "the-decoder", name: "The Decoder", url: "https://the-decoder.com/" },
  { id: "future-tools", name: "Future Tools", url: "https://www.futuretools.io/news" },
];

export const spejIndustryKeywords = [
  "artificial intelligence",
  "AI agents",
  "generative AI",
  "AI video",
  "AI audio",
  "creator tools",
  "media automation",
  "content strategy",
  "future of work",
];

export const spejIndustryDescription =
  "Prioritize practical AI advances that let creators and small teams do genuinely new things: major model releases, agentic workflows, media generation, creator tools, distribution shifts, and useful business applications. Favor primary announcements, concrete capabilities, and developments that could become strong Spej content. Deprioritize rumors, minor benchmark moves, generic funding news, and repetitive opinion pieces.";
