import { defineConfig } from "vitepress";

export default defineConfig({
  title: "agentmemory Design",
  description:
    "agentmemory — AI 编码代理的持久化记忆系统。iii-engine / 50+ functions / 53 MCP tools / 128 REST endpoints / 12 hooks / 4 skills。",
  base: "/agentmemory-design/",
  head: [
    ["link", { rel: "icon", href: "/favicon.svg" }],
    ["meta", { name: "theme-color", content: "#0a0a0a" }],
  ],
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Architecture", link: "/architecture" },
      { text: "Tech Stack", link: "/tech-stack" },
      { text: "Core", link: "/backend" },
      { text: "MCP", link: "/mcp" },
      { text: "Functions", link: "/functions" },
      { text: "Hooks", link: "/hooks" },
      { text: "Deployment", link: "/deployment" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Home", link: "/" },
          { text: "Architecture", link: "/architecture" },
          { text: "Tech Stack", link: "/tech-stack" },
        ],
      },
      {
        text: "Core",
        items: [
          { text: "Overview", link: "/backend" },
          { text: "iii-engine Primitives", link: "/iii-engine" },
          { text: "Data Models", link: "/data-models" },
        ],
      },
      {
        text: "Functions",
        items: [
          { text: "All 50+ Functions", link: "/functions" },
          { text: "Remember / Search", link: "/remember-search" },
          { text: "Crystallize", link: "/crystallize" },
          { text: "Knowledge Graph", link: "/graph" },
        ],
      },
      {
        text: "MCP",
        items: [
          { text: "MCP Tools", link: "/mcp" },
          { text: "MCP Resources", link: "/mcp-resources" },
        ],
      },
      {
        text: "Hooks & Skills",
        items: [
          { text: "Hooks (12)", link: "/hooks" },
          { text: "Plugin Skills (4)", link: "/skills" },
        ],
      },
      {
        text: "Integration",
        items: [
          { text: "Platforms", link: "/platforms" },
          { text: "REST API", link: "/rest-api" },
        ],
      },
      {
        text: "Build & Ship",
        items: [
          { text: "Deployment", link: "/deployment" },
          { text: "Versioning", link: "/versioning" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/rohitg00/agentmemory" },
    ],
  },
  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
  },
  lastUpdated: true,
});
