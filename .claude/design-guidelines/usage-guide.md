# How to Use the UI Design Skill

## Installation

1. Download the `ui-design.skill` file
2. In Claude.ai, go to Settings → Skills
3. Click "Add Skill" and upload the .skill file
4. The skill will now be available in all your conversations!

## When It Triggers

The UI Design skill automatically activates when you:

- Build web interfaces (HTML, React, Vue, etc.)
- Create UI components
- Design landing pages or websites
- Build forms or interactive elements
- Work on any frontend design task

## What It Provides

### Core Guidelines (SKILL.md)
- 8 core design principles (clean/minimal, colors, spacing, typography, etc.)
- Component patterns with code examples
- Layout guidelines
- Quality checklist
- Common scenarios

### Color Palettes (references/color-palettes.md)
- Recommended neutral color schemes
- Accent color options
- Status colors for feedback
- Usage guidelines and examples
- Tailwind color reference

### Spacing System (references/spacing-system.md)
- Complete 8px grid system
- Component spacing patterns
- Layout spacing patterns
- Responsive spacing
- Quick reference guide

### Component Examples (references/component-examples.md)
- Good vs bad examples for:
  - Buttons (primary, secondary, states)
  - Cards (shadow vs border styles)
  - Forms (inputs, labels, errors)
  - Layouts (containers, grids)
  - Typography hierarchy
  - Color usage
  - Interactive states
  - Mobile considerations

## Example Usage

### Simple Request
**You:** "Create a signup form"

**Claude will:**
1. Load the UI Design skill
2. Reference component-examples.md for form patterns
3. Apply 8px spacing system
4. Use neutral colors with one accent
5. Include proper labels, focus states, and responsive design
6. Generate clean, professional code

### Complex Request
**You:** "Build a landing page for a SaaS product"

**Claude will:**
1. Load the UI Design skill
2. Reference multiple reference files
3. Choose appropriate color palette
4. Apply consistent spacing throughout
5. Create clear typography hierarchy
6. Include responsive navigation, hero, features, and CTA sections
7. Ensure all interactive elements have proper states
8. Generate production-ready code

## Tips for Best Results

1. **Be specific about your needs:**
   - "Create a button" → Simple component
   - "Create a dashboard with stats cards" → More complex layout

2. **Mention preferences if you have them:**
   - "Use teal as the accent color"
   - "Make it extra minimal"
   - "Include a dark mode version"

3. **Ask for variations:**
   - "Show me both border and shadow versions of this card"
   - "Create primary, secondary, and danger button styles"

4. **Request the reference files:**
   - "Show me the color palette options"
   - "What spacing should I use for sections?"

## What Makes This Different

Traditional approach (without skill):
```jsx
// Generic AI output
<button className="bg-gradient-to-r from-purple-500 to-blue-500 px-2 py-1">
  Click
</button>
```

With UI Design skill:
```jsx
// Professional, production-ready output
<button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm">
  Click
</button>
```

## Quality Standards

Every UI component will include:

✅ 8px grid spacing (no random values)
✅ Minimum 16px body text
✅ Neutral color base + one accent
✅ Hover/active/focus/disabled states
✅ Mobile-responsive design
✅ Subtle shadows (never heavy)
✅ Clear typography hierarchy
✅ Accessible contrast ratios

❌ No purple/blue gradients
❌ No rainbow colors
❌ No cramped spacing
❌ No tiny text
❌ No missing interactive states

## Common Workflows

### Building a New App
1. "Create a navigation bar" (neutral + accent)
2. "Create a hero section" (large spacing, clear hierarchy)
3. "Create feature cards" (grid layout, consistent spacing)
4. "Create a contact form" (proper labels, focus states)
5. All components will share the same design system!

### Improving Existing UI
1. Share your current code
2. "Apply the UI design skill principles to this"
3. Get improved version with:
   - Consistent spacing
   - Better colors
   - Proper interactive states
   - Professional polish

### Creating a Design System
1. "Create button components following the UI design skill"
2. "Create card components"
3. "Create form components"
4. Build a library of consistent, reusable components

## Customization

While the skill has strong opinions (for good reason!), you can still customize:

- **Accent color:** "Use emerald instead of blue"
- **Spacing scale:** "Use tighter spacing for this dashboard"
- **Typography:** "Use a serif font for headings"
- **Rounding:** "Use sharper corners for a more corporate feel"

The skill will adapt while maintaining the core quality principles.

## Troubleshooting

**"The design looks too plain"**
- That's intentional! Clean and minimal beats cluttered
- Use the accent color strategically for visual interest
- Add subtle hover effects and transitions

**"I need more color"**
- Use the accent color more liberally for CTAs
- Add colored backgrounds to specific sections
- Consider using semantic colors (green for success, etc.)

**"The spacing seems too large"**
- Generous spacing is a feature, not a bug
- It improves readability and visual hierarchy
- Try it on mobile - you'll appreciate the breathing room

**"Can I break the rules?"**
- Yes! The skill provides best practices, not rigid requirements
- Just specify what you want to change
- Example: "Use 12px spacing instead of 16px here"

## Getting Help

If you want to learn more about specific aspects:

- "Show me examples of good button design"
- "What color palettes are available?"
- "How should I space sections on a landing page?"
- "Show me the spacing system reference"

The skill has extensive documentation in the reference files!

## Real-World Impact

Before the skill:
- Inconsistent spacing across components
- Generic purple gradients everywhere
- Missing hover states
- Tiny, unreadable text
- Cramped layouts

After the skill:
- Professional, cohesive design
- Consistent visual language
- Complete interactive states
- Excellent readability
- Generous, harmonious spacing

The skill transforms generic AI output into production-ready, professional UI.
