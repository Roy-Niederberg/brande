# UI Guidelines for Claude Code - Quick Start

## 📦 Installation

**Option 1: Quick Setup (Recommended)**
```bash
# Copy files to your project
cp UI_GUIDELINES.md /path/to/your/project/
cd /path/to/your/project/

# Optional: Run setup script
bash setup-ui-guidelines.sh
```

**Option 2: Manual**
```bash
# Just copy the guidelines file
cp UI_GUIDELINES.md ~/your-project/
```

## 🚀 Usage Examples

### Basic Usage
```bash
# Simple component
claude-code "Create a signup button following UI_GUIDELINES.md"

# Full page
claude-code "Build a landing page following UI_GUIDELINES.md"

# With specifics
claude-code "Create a pricing page following UI_GUIDELINES.md with teal accent"
```

### Advanced Usage

**Specify guidelines inline:**
```bash
claude-code "Create a dashboard with:
- Components from UI_GUIDELINES.md
- Use emerald as accent color
- Card grid with stats
- Mobile responsive"
```

**Reference specific sections:**
```bash
claude-code "Build a form using the Input Field template from UI_GUIDELINES.md"

claude-code "Create navigation following the Navigation template in UI_GUIDELINES.md"
```

**Fix existing code:**
```bash
claude-code "Update Button.jsx to follow the button guidelines in UI_GUIDELINES.md"

claude-code "Refactor this component to use the 8px spacing grid from UI_GUIDELINES.md"
```

## 📝 Prompt Templates

Copy-paste these prompts for instant results:

### Landing Page
```bash
claude-code "Create a modern landing page following UI_GUIDELINES.md with:
- Hero section with CTA buttons
- Feature cards in responsive grid
- Contact form
- Use blue accent color"
```

### Dashboard
```bash
claude-code "Build a dashboard following UI_GUIDELINES.md with:
- Navigation bar
- Stat cards showing metrics
- Data table
- Use indigo accent"
```

### Form
```bash
claude-code "Create a multi-step form following UI_GUIDELINES.md with:
- Input fields with labels
- Error state handling
- Progress indicator
- Submit button with all states"
```

### Component Library
```bash
claude-code "Create a Button component following UI_GUIDELINES.md with:
- Primary, secondary, and danger variants
- All interactive states
- TypeScript types
- Storybook stories"
```

## 🎯 Common Tasks

### Start New Project
```bash
# 1. Setup guidelines
cp UI_GUIDELINES.md ./

# 2. Create components
claude-code "Create src/components/Button.jsx following UI_GUIDELINES.md"
claude-code "Create src/components/Card.jsx following UI_GUIDELINES.md"
claude-code "Create src/components/Input.jsx following UI_GUIDELINES.md"

# 3. Build pages
claude-code "Create src/pages/Home.jsx landing page following UI_GUIDELINES.md"
```

### Improve Existing Code
```bash
# Analyze current code
claude-code "Review src/components/Button.jsx against UI_GUIDELINES.md and suggest improvements"

# Apply fixes
claude-code "Update src/components/Button.jsx to follow UI_GUIDELINES.md spacing and state requirements"

# Batch update
claude-code "Update all components in src/components/ to follow UI_GUIDELINES.md"
```

### Create Design System
```bash
claude-code "Create a design system in src/design-system/ following UI_GUIDELINES.md with:
- Button variants
- Card styles
- Input components
- Typography scale
- Color tokens
- Spacing utilities"
```

## 💡 Pro Tips

### 1. Be Specific About Accent Color
```bash
# Good
claude-code "Build a healthcare app dashboard following UI_GUIDELINES.md with teal accent"

# Even better
claude-code "Build a healthcare app following UI_GUIDELINES.md using:
- Teal accent (teal-600)
- Warm gray base
- Extra spacing for readability"
```

### 2. Reference Specific Templates
```bash
# Instead of generic request
claude-code "Create a button"

# Reference the template
claude-code "Create a button using the Primary Button template from UI_GUIDELINES.md"
```

### 3. Combine with Project Context
```bash
# If you have a .claude/ directory
claude-code "Build user profile page following:
- UI_GUIDELINES.md for design
- .claude/api-schema.md for data structure"
```

### 4. Iterative Refinement
```bash
# Start simple
claude-code "Create pricing page following UI_GUIDELINES.md"

# Then refine
claude-code "Add testimonials section to pricing page following card grid pattern from UI_GUIDELINES.md"

# Polish
claude-code "Update pricing page to use emerald accent instead of blue, keep all other UI_GUIDELINES.md standards"
```

## ⚙️ Configuration Options

### Custom Accent Color
Edit UI_GUIDELINES.md line 28 to set your default:
```markdown
bg-emerald-600 hover:bg-emerald-700   ← Set as default
```

### Adjust Spacing Scale
If you need tighter spacing for data-dense UIs:
```markdown
## Spacing Scale (6px Grid)  ← Change from 8px
6px   → p-1.5, space-y-1.5
12px  → p-3, space-y-3
...
```

### Project-Specific Rules
Add a section at the bottom:
```markdown
## Project Overrides

- Use rounded-xl for all cards (not rounded-lg)
- Minimum button width: 120px
- Always include icons in buttons
```

## 🔍 Troubleshooting

**Issue: Claude Code not following guidelines**
```bash
# Be more explicit
claude-code "Read UI_GUIDELINES.md first, then create a signup form that strictly follows all component templates and spacing rules"
```

**Issue: Output doesn't match templates**
```bash
# Reference specific line numbers or sections
claude-code "Create button exactly matching line 65-71 of UI_GUIDELINES.md"
```

**Issue: Need to enforce specific rules**
```bash
# List critical requirements
claude-code "Create dashboard following UI_GUIDELINES.md. Critical requirements:
- MUST use 8px grid spacing
- MUST include all button states (hover/active/focus/disabled)
- MUST be mobile responsive"
```

## 📊 Workflow Examples

### Solo Developer
```bash
# Morning: Setup
cp UI_GUIDELINES.md ./
claude-code "Create project structure following UI_GUIDELINES.md"

# Development: Build features
claude-code "Create user authentication flow following UI_GUIDELINES.md"
claude-code "Create dashboard following UI_GUIDELINES.md"

# Review: Check consistency
claude-code "Review all components for UI_GUIDELINES.md compliance"
```

### Team Project
```bash
# Setup: Add to repo
git add UI_GUIDELINES.md
git commit -m "Add UI design guidelines"

# Development: Consistent output
claude-code "Create navbar following UI_GUIDELINES.md with blue accent"
# Another developer:
claude-code "Create footer following UI_GUIDELINES.md with blue accent"
# → Both match perfectly

# Code review:
claude-code "Check if PR #123 components follow UI_GUIDELINES.md"
```

## 🎨 Style Variations

### Minimal Style
```bash
claude-code "Create app following UI_GUIDELINES.md with minimal aesthetic:
- Extra white space
- Borders instead of shadows
- Single column layouts"
```

### Data-Dense Style
```bash
claude-code "Create analytics dashboard following UI_GUIDELINES.md adapted for data density:
- Tighter spacing (use p-4 instead of p-6)
- Compact text hierarchy
- More grid columns"
```

### Marketing Style
```bash
claude-code "Create marketing site following UI_GUIDELINES.md with bold style:
- Larger hero (py-32)
- Bigger headings (text-6xl)
- More generous spacing"
```

## 📚 Learn More

- **Full documentation**: See UI_GUIDELINES.md
- **Component examples**: Lines 80-210
- **Responsive patterns**: Lines 215-270
- **Quality checklist**: Lines 330-345

## 🎉 Success Criteria

Your UI is ready to ship when:
- ✅ All spacing uses 8px grid
- ✅ All text is 16px minimum
- ✅ One consistent accent color
- ✅ Every button has 4 states
- ✅ Mobile responsive
- ✅ Subtle shadows only
- ✅ No gradients

---

**Remember**: The guidelines are there to help you ship faster with better quality. Reference them in every prompt for consistent, professional results! 🚀
