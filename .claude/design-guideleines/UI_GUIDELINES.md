# UI Design Guidelines for Claude Code

Quick reference for building professional, modern UIs. Always follow these principles.

## Core Rules

1. **8px Grid Spacing** - Only use: 8, 16, 24, 32, 48, 64, 96px (never 15, 22, 35, etc)
2. **Neutral + One Accent** - Gray base (90%) + single accent color (10%)
3. **16px Minimum Text** - Never smaller for body content
4. **Complete States** - Every interactive element needs hover/active/focus/disabled
5. **Mobile First** - Start mobile, enhance for desktop with md: and lg:
6. **Subtle Shadows** - Use shadow-sm or shadow-md (never shadow-2xl)

## Spacing Scale (Tailwind)

```
8px   → p-2, space-y-2, gap-2, mb-2
16px  → p-4, space-y-4, gap-4, mb-4
24px  → p-6, space-y-6, gap-6, mb-6
32px  → p-8, space-y-8, gap-8, mb-8
48px  → p-12, space-y-12, mb-12
64px  → p-16, space-y-16, mb-16
96px  → py-24, space-y-24, mb-24
```

**Common patterns:**
- Button padding: `px-6 py-3` (24px/12px)
- Card padding: `p-6` (24px all sides)
- Section padding: `py-16 px-6` (64px vertical, 24px horizontal)
- Form field spacing: `space-y-2` (8px between label and input)
- Between sections: `mb-16` or `space-y-16` (64px)

## Color System

**Base (use for 90% of UI):**
```
bg-gray-50          Background
bg-white            Cards, surfaces
border-gray-200     Borders
text-gray-900       Primary text
text-gray-600       Secondary text
```

**Accent (choose ONE, use for 10%):**
```
bg-blue-600 hover:bg-blue-700       Professional (recommended)
bg-indigo-600 hover:bg-indigo-700   Modern tech
bg-teal-600 hover:bg-teal-700       Healthcare/finance
bg-orange-600 hover:bg-orange-700   Energetic
bg-emerald-600 hover:bg-emerald-700 Growth/eco
```

**Status (semantic only):**
```
bg-green-500   Success
bg-red-500     Error
bg-amber-500   Warning
bg-blue-500    Info
```

**NEVER use:**
- ❌ bg-gradient-to-r from-purple-500 to-blue-500 (generic AI aesthetic)
- ❌ Multiple accent colors (causes chaos)
- ❌ Rainbow gradients

## Typography Scale

```
text-5xl    48px   Hero headings
text-4xl    36px   Page titles
text-3xl    30px   Section headings
text-2xl    24px   Subsections
text-xl     20px   Large text
text-lg     18px   Card titles
text-base   16px   Body text (MINIMUM)
text-sm     14px   Labels, captions (use sparingly)
```

**Hierarchy example:**
```jsx
<h1 className="text-4xl font-bold text-gray-900 mb-4">Page Title</h1>
<p className="text-xl text-gray-600 mb-8">Subtitle</p>
<h2 className="text-2xl font-semibold text-gray-900 mb-4">Section</h2>
<p className="text-base text-gray-600 leading-relaxed">Body text</p>
```

## Component Templates

### Button (Primary)
```jsx
<button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
  Click Me
</button>
```

### Button (Secondary)
```jsx
<button className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors">
  Cancel
</button>
```

### Card
```jsx
<div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
  <h3 className="text-lg font-semibold text-gray-900 mb-2">Card Title</h3>
  <p className="text-gray-600">Description text goes here.</p>
</div>
```

### Input Field
```jsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">
    Email Address
  </label>
  <input 
    type="email"
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-shadow"
    placeholder="you@example.com"
  />
</div>
```

### Input Field (Error State)
```jsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">
    Email Address
  </label>
  <input 
    type="email"
    className="w-full px-4 py-3 border-2 border-red-500 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
  />
  <p className="text-sm text-red-600">Please enter a valid email address</p>
</div>
```

### Navigation
```jsx
<nav className="bg-white border-b border-gray-200">
  <div className="max-w-7xl mx-auto px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="text-xl font-bold text-gray-900">Logo</div>
      <div className="flex items-center gap-8">
        <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">
          Features
        </a>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          Sign Up
        </button>
      </div>
    </div>
  </div>
</nav>
```

### Section with Heading
```jsx
<section className="py-16 px-6">
  <div className="max-w-6xl mx-auto">
    <h2 className="text-3xl font-bold text-gray-900 mb-16">Section Title</h2>
    {/* Content */}
  </div>
</section>
```

### Card Grid
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Cards here */}
</div>
```

### Hero Section
```jsx
<section className="py-24 px-6">
  <div className="max-w-4xl mx-auto text-center">
    <h1 className="text-5xl font-bold text-gray-900 mb-6">
      Welcome to Our Product
    </h1>
    <p className="text-xl text-gray-600 mb-12 leading-relaxed">
      Build better products faster with our modern platform.
    </p>
    <div className="flex items-center justify-center gap-4">
      <button className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
        Get Started
      </button>
      <button className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors">
        Learn More
      </button>
    </div>
  </div>
</section>
```

## Responsive Patterns

**Container widths:**
```jsx
max-w-7xl   /* Full layouts (1280px) */
max-w-6xl   /* Content sections (1152px) */
max-w-4xl   /* Centered content (896px) */
max-w-2xl   /* Reading content (672px) */
max-w-md    /* Forms (448px) */
```

**Responsive spacing:**
```jsx
className="
  px-4 py-8           // Mobile (16px/32px)
  md:px-6 md:py-12    // Tablet (24px/48px)
  lg:px-8 lg:py-16    // Desktop (32px/64px)
"
```

**Responsive grids:**
```jsx
className="
  grid 
  grid-cols-1         // Mobile: 1 column
  md:grid-cols-2      // Tablet: 2 columns
  lg:grid-cols-3      // Desktop: 3 columns
  gap-4 md:gap-6      // Responsive gaps
"
```

**Responsive text:**
```jsx
className="
  text-3xl            // Mobile
  md:text-4xl         // Tablet
  lg:text-5xl         // Desktop
"
```

## Interactive States

**Always include all four states:**
```jsx
className="
  bg-blue-600                    // Default
  hover:bg-blue-700              // Hover
  active:bg-blue-800             // Active/pressed
  disabled:opacity-50            // Disabled
  disabled:cursor-not-allowed    // Disabled cursor
  focus:ring-2 focus:ring-blue-600  // Focus (keyboard)
  transition-colors              // Smooth transitions
"
```

## Layout Containers

**Full-width section:**
```jsx
<section className="py-24 bg-white">
  <div className="max-w-7xl mx-auto px-6">
    {/* Content */}
  </div>
</section>
```

**Alternating backgrounds:**
```jsx
<section className="py-16 bg-white">...</section>
<section className="py-16 bg-gray-50">...</section>
<section className="py-16 bg-white">...</section>
```

## Quality Checklist

Before shipping, verify:
- [ ] All spacing uses 8px grid (no 15px, 22px, etc)
- [ ] Body text is 16px minimum
- [ ] Using ONE accent color consistently
- [ ] All buttons have hover/active/focus/disabled states
- [ ] Mobile responsive (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- [ ] Touch targets 48px minimum on mobile
- [ ] Focus rings visible (focus:ring-2)
- [ ] Shadows are subtle (shadow-sm or shadow-md only)
- [ ] No purple/blue gradients or rainbow colors
- [ ] Text contrast meets WCAG AA (gray-600+ on white)

## Common Mistakes to Avoid

❌ **DON'T:**
```jsx
// Random spacing off the grid
<div className="mb-5 p-3">

// Tiny text
<p className="text-xs">Important content</p>

// Missing states
<button className="bg-blue-500">Click</button>

// Rainbow gradients
<div className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500">

// Desktop-only layout
<div className="grid grid-cols-4 gap-2">

// Heavy shadows
<div className="shadow-2xl">

// Border AND shadow
<div className="border-4 shadow-xl">
```

✅ **DO:**
```jsx
// Grid-based spacing
<div className="mb-8 p-6">

// Readable text
<p className="text-base">Important content</p>

// Complete states
<button className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors">

// Solid accent color
<div className="bg-blue-600">

// Mobile-first layout
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

// Subtle shadows
<div className="shadow-sm">

// Shadow OR border, not both
<div className="shadow-sm">
// or
<div className="border border-gray-200">
```

## Quick Wins

Transform generic AI output to professional design:

1. `px-2 py-1` → `px-6 py-3`
2. `text-xs` → `text-base`
3. `bg-gradient-to-r from-purple-500 to-blue-500` → `bg-blue-600`
4. `shadow-2xl` → `shadow-sm`
5. Add `hover:bg-blue-700 active:bg-blue-800 transition-colors`
6. Add `focus:ring-2 focus:ring-blue-600 outline-none`
7. `grid-cols-3` → `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

## Usage in Claude Code

**Good prompts:**
```bash
"Create a landing page following UI_GUIDELINES.md"
"Build a signup form using the component templates in UI_GUIDELINES.md"
"Design a dashboard with the 8px grid spacing system"
"Make this component follow the button template with all states"
```

**Include specific requirements:**
```bash
"Create a pricing page with:
- 8px grid spacing
- Gray base + teal accent
- Cards with shadow-sm and p-6
- Mobile-first responsive grid
- All buttons with complete states"
```

## Pro Tips

1. **Copy-paste templates** - Use the component templates exactly as shown
2. **One accent color** - Stick to one throughout entire app
3. **Space generously** - When in doubt, use more space (py-16 not py-4)
4. **Mobile first** - Always start with grid-cols-1, add md: and lg:
5. **Consistent rounding** - Use rounded-lg for everything (buttons, cards, inputs)
6. **Trust the grid** - 8px increments create natural harmony

---

**Remember:** Professional UI isn't about flashy gradients. It's about:
- Consistent spacing
- Clear hierarchy  
- Subtle interactions
- Generous white space
- Neutral foundation

Follow these guidelines and every component will look production-ready! 🎨
