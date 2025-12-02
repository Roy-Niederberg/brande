# UI Design Skill - Quick Reference

## 🎨 Color System

```
BASE (90%):          ACCENT (10%):
Gray-50  #FAFAF9     Blue-600  #2563EB
Gray-200 #E7E5E4     Blue-700  #1D4ED8
Gray-600 #57534E     (or: indigo, teal, orange, emerald)
Gray-900 #1C1917
```

## 📏 Spacing Scale (8px Grid)

```
8px   → space-y-2, p-2, gap-2
16px  → space-y-4, p-4, gap-4
24px  → space-y-6, p-6, gap-6
32px  → space-y-8, p-8, gap-8
48px  → space-y-12, p-12
64px  → space-y-16, p-16
96px  → space-y-24, py-24
```

## 🔤 Typography Scale

```
Hero:     text-5xl (48px)
Heading:  text-3xl (30px)
Section:  text-2xl (24px)
Card:     text-lg  (18px)
Body:     text-base (16px) ← MINIMUM
Small:    text-sm  (14px)
```

## 🎯 Component Patterns

### Button
```jsx
<button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm">
```

### Card
```jsx
<div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
```

### Input
```jsx
<input className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
```

### Section
```jsx
<section className="py-16 px-6">
  <h2 className="text-3xl font-bold mb-16">
```

## ✅ Always Include

- [ ] 8px grid spacing
- [ ] 16px minimum body text
- [ ] Hover states
- [ ] Focus rings
- [ ] Mobile responsive
- [ ] One accent color

## ❌ Never Use

- [ ] Purple-blue gradients
- [ ] Rainbow colors
- [ ] Random spacing (15px, 22px)
- [ ] Text under 16px
- [ ] Heavy shadows (shadow-2xl)
- [ ] Missing states

## 📱 Responsive Pattern

```jsx
className="
  px-4 py-8         /* Mobile */
  md:px-6 md:py-12  /* Tablet */
  lg:px-8 lg:py-16  /* Desktop */
"
```

## 🎨 State Pattern

```jsx
className="
  bg-blue-600              /* Default */
  hover:bg-blue-700        /* Hover */
  active:bg-blue-800       /* Active */
  disabled:opacity-50      /* Disabled */
  focus:ring-2             /* Focus */
  transition-colors        /* Smooth */
"
```

## 📐 Layout Widths

```jsx
max-w-7xl  /* Full layout (1280px) */
max-w-4xl  /* Content (896px) */
max-w-2xl  /* Reading (672px) */
max-w-md   /* Forms (448px) */
```

## 🎯 Common Tasks

**Button with states:**
```jsx
className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
```

**Card grid:**
```jsx
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
```

**Form field:**
```jsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">Label</label>
  <input className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
</div>
```

**Section spacing:**
```jsx
<section className="py-24 px-6">
  <div className="max-w-6xl mx-auto">
    <h2 className="text-3xl font-bold mb-16">Title</h2>
```

## 🚀 Quick Wins

1. Replace `px-2 py-1` → `px-6 py-3`
2. Replace `text-xs` → `text-base`
3. Remove gradients → Use solid colors
4. Add `hover:` states to all buttons
5. Use `space-y-4` instead of individual margins
6. Replace `shadow-2xl` → `shadow-sm`
7. Use one accent color throughout

## 💡 Pro Tip

**Before asking:** "Make it look good"
**Instead ask:** "Apply the UI design skill principles"

This ensures:
- Consistent spacing
- Professional colors
- Complete states
- Mobile responsive
- Production ready

---

Keep this handy when building UI! 🎨
