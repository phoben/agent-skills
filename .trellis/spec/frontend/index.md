# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

## Pre-Development Checklist（开发前）

- 修改`packages/token-usage/ui/`时，先读[Tokens页面规范](./token-usage.md)与`docs/design/token-usage.md`。
- 修改 `packages/issue-hub/ui/` 时，先读 [Issue Hub 验证页与原型交接](./issue-hub.md)，正式界面以用户确认的 U1 原型为准。
- 使用已确认C版设计；下列通用模板尚未填充，不视为现有产品模式。

## Quality Check（质量检查）

执行模块测试与构建，验证两个桌面视口及真实查询路径；浏览器预览、MCP资源和桌面宿主验收分别记录。

This directory contains guidelines for frontend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | To fill |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | To fill |
| [State Management](./state-management.md) | Local state, global state, server state | To fill |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | To fill |
| [Type Safety](./type-safety.md) | Type patterns, validation | To fill |
| [Issue Hub](./issue-hub.md) | YG内A连读队列、投影、草稿、权限与会话 | YG0.3.0整合，原型保持 |

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
