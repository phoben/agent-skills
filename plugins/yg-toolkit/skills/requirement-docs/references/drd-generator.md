---
name: drd-generator
description: Generate Design Requirements Document (DRD) from Product Requirements Document (PRD). Use this skill when user wants to create frontend prototype design docs, extract design requirements from system specs, or mentions "DRD", "design requirements", "prototype document". Also trigger when user has a PRD and needs to prepare for frontend prototyping work.
---

# Design Requirements Document Generator

Generate structured DRD from PRD for frontend prototyping.

## Workflow

### Step 1: Check for PRD Document

Scan current context for existing PRD/document. If found, proceed to Step 3.

If NOT found, ask user:

> I need a Product Requirements Document (PRD) or system design document to extract design requirements from.
>
> Please provide one of the following:
> - Path to the PRD file
> - Paste the PRD content directly
> - Describe the product/system requirements

### Step 2: Read PRD Content

If user provides file path, read the file. If user pastes content, use it directly.

### Step 3: Collect Design Method

Ask user to select prototyping method:

> What prototyping method will you use?
>
> **Options:**
> 1. **Figma** - Design tool with interactive prototypes
> 2. **React** - Component-based frontend framework
> 3. **Vue** - Progressive frontend framework
> 4. **HTML/CSS** - Static markup and styling
> 5. **Other** - Specify your preferred method
>
> Please select a number or enter your custom method:

Wait for user response before proceeding.

### Step 4: Collect UI/UX Specifications

Ask the following questions ONE BY ONE, waiting for user response each time:

**Question 1 - Style Preference:**
> What visual style do you prefer?
>
> **Options:**
> 1. **Minimalist** - Clean, simple, lots of whitespace
> 2. **Corporate** - Professional, structured, business-focused
> 3. **Creative** - Bold, artistic, unique visual elements
> 4. **Material** - Google Material Design inspired
> 5. **Other** - Describe your preferred style
>
> Please select a number or describe your style:

**Question 2 - Industry/Purpose:**
> What industry or purpose is this product for?
>
> **Examples:** Finance, E-commerce, Enterprise internal tool, Healthcare, Education, Social media, etc.
>
> Please describe:

**Question 3 - Device Type:**
> What devices should the prototype support?
>
> **Options:**
> 1. **Desktop only** - Fixed width, mouse interactions
> 2. **Mobile only** - Touch interactions, mobile-first
> 3. **Responsive** - Adapts to desktop, tablet, and mobile
> 4. **Tablet only** - Touch interactions, medium screen
>
> Please select a number:

**Question 4 - Screen Dimensions:**
> What screen dimensions should we target?
>
> **Desktop options:** 1920x1080, 1440x900, 1366x768
> **Mobile options:** 375x667 (iPhone SE), 390x844 (iPhone 14), 360x800 (Android)
>
> Please specify dimensions or use defaults:
> - Desktop: 1440x900
> - Mobile: 390x844

**Question 5 - Color Scheme:**
> Do you have brand colors or a preferred color scheme?
>
> **Options:**
> 1. **Use default** - I'll generate an appropriate scheme based on industry
> 2. **Provide brand colors** - I'll enter primary/secondary colors
>
> If choosing option 2, please provide:
> - Primary color (hex code or name)
> - Secondary color (optional)
> - Accent color (optional)

**Question 6 - Existing Design System:**
> Do you have an existing design system or component library to follow?
>
> **Options:**
> 1. **No** - Start fresh
> 2. **Yes** - I'll specify the design system (e.g., Ant Design, Material UI, Tailwind UI)
>
> If yes, please specify:

### Step 5: Analyze PRD and Generate DRD

Based on the PRD content and collected specifications, generate a comprehensive DRD.

**Filtering Rules:**

| Keep | Discard |
|------|---------|
| UI layouts and page structures | Backend API implementation details |
| User interactions and flows | Database schema designs |
| Form fields and validation rules | Server-side logic |
| Data display requirements | Infrastructure/DevOps specs |
| Error states and feedback | Business metrics (unless shown in UI) |
| Navigation and routing | Internal algorithms |
| User roles visible in UI | Third-party service integrations (unless UI-related) |
| Component-level requirements | Data migration plans |
| Accessibility requirements | Security protocols (unless UI-visible) |

### Step 6: Output DRD Document

Generate the DRD in markdown format with this structure:

---

# Design Requirements Document (DRD)

## 1. Document Information

| Field | Value |
|-------|-------|
| Project Name | [From PRD] |
| Version | 1.0 |
| Created Date | [Current date] |
| Source PRD | [PRD filename/reference] |
| Prototyping Method | [User selected method] |

## 2. Design Method & Technical Stack

### 2.1 Prototyping Tool/Framework
[Selected method and relevant details]

### 2.2 Component Library / Design System
[Existing system or recommendations]

### 2.3 Technical Constraints
- Browser compatibility: [if specified]
- Performance requirements: [if specified]
- Accessibility standards: [WCAG level if specified]

## 3. Design Specifications

### 3.1 Visual Specifications

#### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| --color-primary | [hex] | Primary actions, key elements |
| --color-secondary | [hex] | Secondary elements |
| --color-accent | [hex] | Highlights, notifications |
| --color-background | [hex] | Page backgrounds |
| --color-surface | [hex] | Cards, containers |
| --color-text-primary | [hex] | Main text |
| --color-text-secondary | [hex] | Secondary text, captions |
| --color-border | [hex] | Borders, dividers |
| --color-success | [hex] | Success states |
| --color-warning | [hex] | Warning states |
| --color-error | [hex] | Error states |

#### Typography
| Element | Font Family | Size | Weight | Line Height |
|---------|-------------|------|--------|-------------|
| Heading 1 | [font] | [size] | [weight] | [height] |
| Heading 2 | [font] | [size] | [weight] | [height] |
| Heading 3 | [font] | [size] | [weight] | [height] |
| Body | [font] | [size] | [weight] | [height] |
| Caption | [font] | [size] | [weight] | [height] |

#### Spacing Scale
| Token | Value | Usage |
|-------|-------|-------|
| --space-xs | 4px | Tight spacing |
| --space-sm | 8px | Default compact |
| --space-md | 16px | Standard spacing |
| --space-lg | 24px | Section spacing |
| --space-xl | 32px | Large gaps |

### 3.2 Interaction Specifications

#### Animation & Transitions
| Element | Duration | Easing | Trigger |
|---------|----------|--------|---------|
| Button hover | 150ms | ease-out | Mouse enter |
| Modal open | 200ms | ease-in-out | Click trigger |
| Page transition | 300ms | ease-in-out | Navigation |
| Dropdown | 150ms | ease-out | Click/toggle |

#### Feedback States
- **Hover**: [Visual change description]
- **Active/Pressed**: [Visual change description]
- **Focus**: [Focus ring specification]
- **Disabled**: [Opacity/color change]
- **Loading**: [Spinner/skeleton specification]

### 3.3 Responsive Rules

| Breakpoint | Width | Target Device |
|------------|-------|---------------|
| xs | < 576px | Mobile phones |
| sm | ≥ 576px | Large phones |
| md | ≥ 768px | Tablets |
| lg | ≥ 992px | Small desktops |
| xl | ≥ 1200px | Large desktops |
| xxl | ≥ 1400px | Extra large screens |

#### Layout Adaptation Rules
[How layout changes at each breakpoint]

### 3.4 Design Tokens Summary
[Consolidated CSS variables or design token definitions]

## 4. Page Structure

### 4.1 Page Inventory

| Page ID | Page Name | Description | Priority |
|---------|-----------|-------------|----------|
| P001 | [Name] | [Brief description] | High/Medium/Low |
| P002 | [Name] | [Brief description] | High/Medium/Low |
| ... | ... | ... | ... |

### 4.2 Navigation Structure

```
[ASCII or text representation of navigation hierarchy]

Example:
Home
├── Dashboard
│   ├── Overview
│   └── Analytics
├── Users
│   ├── User List
│   └── User Detail
└── Settings
    ├── Profile
    └── Preferences
```

### 4.3 Page Entry Points
[How users navigate to each page]

## 5. User Roles & Permissions

### 5.1 Role Definitions

| Role ID | Role Name | Description |
|---------|-----------|-------------|
| R001 | Admin | Full system access |
| R002 | Manager | Department-level access |
| R003 | User | Standard access |

### 5.2 Permission Matrix

| Feature | Admin | Manager | User |
|---------|-------|---------|------|
| View Dashboard | ✓ | ✓ | ✓ |
| Edit Users | ✓ | ✓ | ✗ |
| Delete Records | ✓ | ✗ | ✗ |
| ... | ... | ... | ... |

### 5.3 UI Variations by Role
[Description of how UI differs for each role]

## 6. Functional Requirements

### 6.1 [Page/Module Name]

#### Overview
[Brief description of the page/module]

#### Features

| Feature ID | Name | Description | Priority |
|------------|------|-------------|----------|
| F001 | [Name] | [Description] | High |
| F002 | [Name] | [Description] | Medium |
| ... | ... | ... | ... |

#### UI Elements
[List of UI elements on this page with their behaviors]

#### Interactions
[Specific interaction patterns for this page]

### 6.2 [Next Page/Module]
[Repeat structure above]

## 7. Data Display Specifications

### 7.1 Data Tables / Lists

#### [Table Name]
| Column | Data Type | Sortable | Filterable | Width |
|--------|-----------|----------|------------|-------|
| [Column 1] | string | Yes | Yes | 20% |
| [Column 2] | number | Yes | No | 15% |
| ... | ... | ... | ... | ... |

**Pagination**: [Enabled/Disabled, items per page]
**Row Actions**: [Edit, Delete, View details, etc.]
**Bulk Actions**: [Select all, batch operations]

### 7.2 Form Fields & Validation

#### [Form Name]

| Field | Type | Required | Validation | Placeholder |
|-------|------|----------|------------|-------------|
| [Field 1] | text | Yes | Min 3 chars | "Enter name" |
| [Field 2] | email | Yes | Valid email | "email@example.com" |
| [Field 3] | select | No | - | "Select option" |
| ... | ... | ... | ... | ... |

**Submit Behavior**: [Validation, loading state, success/error feedback]

### 7.3 State Displays

#### Empty State
- **Trigger**: [When this state appears]
- **Visual**: [Image/icon description]
- **Copy**: [Headline and subtext]
- **Action**: [CTA button if any]

#### Loading State
- **Trigger**: [When loading occurs]
- **Visual**: [Skeleton/spinner description]
- **Duration**: [Expected load time if known]

#### Error State
- **Trigger**: [Error scenarios]
- **Visual**: [Icon/image description]
- **Copy**: [Error message]
- **Recovery**: [Retry button, helpful links]

#### Success State
- **Trigger**: [Success scenarios]
- **Visual**: [Checkmark/confetti/etc.]
- **Copy**: [Success message]
- **Next Action**: [What happens next]

## 8. Interaction Flows

### 8.1 [Flow Name: e.g., User Registration]

```
[Flow diagram using ASCII or text steps]

Example: User Registration Flow

Start → Landing Page
    │
    ▼
Click "Sign Up" Button
    │
    ▼
Registration Form
    ├── Fill email → Validate format
    ├── Fill password → Validate strength
    └── Click "Submit"
        │
        ▼
    Loading State
        │
        ├── Success → Verification Page
        │               │
        │               ▼
        │           Check Email
        │               │
        │               ▼
        │           Verify Account
        │               │
        │               ▼
        │           Dashboard (Logged In)
        │
        └── Error → Show Error Message
                    │
                    ▼
                Return to Form
```

### 8.2 [Next Flow]
[Repeat structure above]

### 8.3 Error Handling Flows
[How errors are handled across the application]

## 9. Component Inventory

### 9.1 Common Components

| Component | Description | Variants | Used In |
|-----------|-------------|----------|---------|
| Button | Primary action trigger | Primary, Secondary, Ghost, Danger | All pages |
| Input | Text input field | Text, Password, Search, Number | Forms |
| Card | Content container | Default, Elevated, Bordered | Dashboard, Lists |
| Modal | Overlay dialog | Small, Medium, Large | Confirmations, Forms |
| ... | ... | ... | ... |

### 9.2 Business Components

| Component | Description | Dependencies | Used In |
|-----------|-------------|--------------|---------|
| [Name] | [Description] | [Child components] | [Pages] |
| ... | ... | ... | ... |

### 9.3 Third-Party Components

| Component | Library | Purpose | License |
|-----------|---------|---------|---------|
| [Name] | [Library name] | [Purpose] | [MIT/etc.] |
| ... | ... | ... | ... |

## 10. Prototype Scope

### 10.1 Implementation Scope

| Category | Included | Excluded |
|----------|----------|----------|
| Pages | [List pages to prototype] | [Pages to skip] |
| Interactions | [Click, hover, form submit] | [Complex animations, gestures] |
| Data | [Mock data structure] | [Real API integration] |
| States | [Default, hover, loading, error] | [All edge cases] |

### 10.2 Mock Data Guidelines

- Use realistic sample data
- Include edge cases (long text, empty values)
- Represent all user roles
- Cover error scenarios

### 10.3 Fidelity Level

| Aspect | Fidelity | Notes |
|--------|----------|-------|
| Visual Design | High/Medium/Low | [Details] |
| Interactions | High/Medium/Low | [Details] |
| Content | High/Medium/Low | [Details] |
| Data | High/Medium/Low | [Details] |

---

## Appendix

### A. Source PRD Summary
[Brief summary of the original PRD for reference]

### B. Glossary
[Key terms and definitions]

### C. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [Date] | [Author] | Initial DRD creation |

---

### Step 7: Save DRD File

Save the generated DRD as a markdown file:
- **Location**: Same directory as the PRD file
- **Filename**: `DRD_[ProjectName]_[Date].md` or `[PRD-filename]_DRD.md`

Inform user of the output location.

---

## Notes

- Be thorough but focused on frontend-visible requirements
- Adapt technical details based on selected prototyping method
- For Figma: emphasize design tokens, spacing, typography
- For React/Vue: include component props and state considerations
- For HTML/CSS: focus on markup structure and CSS specifications
- Always ask clarifying questions if PRD is ambiguous