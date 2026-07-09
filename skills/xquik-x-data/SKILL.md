---
name: xquik-x-data
description: |
  Use this skill for Xquik-specific X data workflows: REST API integrations,
  remote MCP setup, webhook handling, source-backed request examples, or reviews
  of code that calls Xquik. Check Xquik public docs, OpenAPI, and MCP manifest
  before acting. Keep API keys in approved runtime secret paths and never expose
  credential values.
---

# Xquik X Data

This skill helps agents work with Xquik's public REST API, remote MCP surface,
and webhooks for X data workflows.

## Source Truth

- Xquik docs: https://docs.xquik.com/api-reference/overview
- OpenAPI: https://xquik.com/openapi.json
- MCP manifest: https://xquik.com/.well-known/mcp.json

Read the relevant source before writing examples, choosing endpoints, or
claiming support for a response field.

## Use For

- Building an Xquik REST API integration.
- Connecting an agent to Xquik remote MCP.
- Reviewing Xquik webhook handling.
- Writing source-backed request examples.
- Explaining supported Xquik X data workflows.

## Do Not Use For

- Generic web search.
- Non-Xquik X data providers.
- Credentials collection or secret storage.
- Claims not verified in public Xquik docs or manifests.

## Steps

1. Classify the task as REST API, remote MCP, or webhooks.
2. Check the matching Xquik source truth.
3. Use the smallest supported route or MCP surface.
4. Keep credentials in the user's configured runtime secret path.
5. Provide validation that does not reveal credential values.

## Safety Rules

- Do not ask the user to paste an API key into chat.
- Do not print, log, store, or commit secrets.
- Do not invent endpoints, limits, pricing, or response fields.
- Keep Xquik calls opt-in and user directed.
