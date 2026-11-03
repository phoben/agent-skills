# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

## Pre-Development Checklist（开发前）

- 修改`packages/token-usage/src/`、MCP或插件清单时，先读[Tokens服务规范](./token-usage.md)。
- 跨层改动同时读取任务PRD、设计与接口契约。下列通用模板尚未填充，不视为已验证的项目约定。

## Quality Check（质量检查）

执行用量模块的`test`、`build`、`verify:stdio`；真实账号验证单独使用`verify:live`，不将其输出作为公开样例。

This directory contains guidelines for backend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Database Guidelines](./database-guidelines.md) | ORM patterns, queries, migrations | To fill |
| [Error Handling](./error-handling.md) | Error types, handling strategies | To fill |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | To fill |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging, log levels | To fill |

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

语言遵循根AGENTS：新增注释、描述和文档使用中文。
