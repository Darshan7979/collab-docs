# Animation & Interaction Library Reference

## 🎬 Keyframe Animations

### `@keyframes ripple`
**Purpose**: Button click ripple effect emanating from click point
**Duration**: 0.6s  
**Easing**: ease-out
**Properties**: 
- Transform: scale 0 → 4
- Opacity: 0.5 → 0
**Applied to**: `.btn-new::before`, `.btn-icon-only::before`, `.doc-action::before`
```css
@keyframes ripple {
    to {
        transform: scale(4);
        opacity: 0;
    }
}
```

### `@keyframes slideInUp`
**Purpose**: Smooth entrance from below
**Duration**: 0.4s (entrance), 0.5s (search results)
**Easing**: ease-out
**Properties**:
- Opacity: 0 → 1
- Transform: translateY 12px → 0
**Applied to**: `.doc-row`, `.empty-state`, `.search-result-item`
```css
@keyframes slideInUp {
    from {
        opacity: 0;
        transform: translateY(12px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

### `@keyframes pulse`
**Purpose**: Subtle opacity pulse for loading states
**Duration**: 2s
**Easing**: cubic-bezier(0.4, 0, 0.6, 1)
**Properties**: Opacity 1 → 0.5 → 1
**Applied to**: `.skeleton-card`
```css
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
```

### `@keyframes shimmer`
**Purpose**: Left-to-right shimmer effect on skeleton cards
**Duration**: 2s infinite
**Properties**: Background position shift left → right
**Applied to**: `.skeleton-loader`
```css
@keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
}
```

### `@keyframes scaleIn`
**Purpose**: Zoom-in entrance
**Duration**: Varies (400ms for welcome-badge, 600ms for empty-icon)
**Easing**: cubic-bezier(0.34, 1.56, 0.64, 1)
**Properties**:
- Opacity: 0 → 1
- Transform: scale 0.95 → 1
**Applied to**: `.welcome-badge`, `.empty-icon`
```css
@keyframes scaleIn {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}
```

### `@keyframes slideDown`
**Purpose**: Dropdown menu entrance
**Duration**: 200ms
**Easing**: cubic-bezier(0.34, 1.56, 0.64, 1)
**Properties**:
- Opacity: 0 → 1
- Transform: translateY -8px → 0
**Applied to**: `.profile-dropdown`, `.sort-dropdown`, tooltips
```css
@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

### `@keyframes fadeIn`
**Purpose**: Modal backdrop fade in
**Duration**: 200ms
**Easing**: ease
**Properties**: Opacity 0 → 1
**Applied to**: `.backdrop`
```css
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
```

---

## 🎯 Interaction Classes & States

### `.doc-row` (Document Card)
**States**:
- Default: `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05)`
- Hover: `box-shadow: 0 12px 32px rgba(79, 70, 229, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08); transform: translateY(-2px)`
- Transition: `all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)`

**Animation**:
```css
/* Staggered entrance */
.doc-row:nth-child(1) { animation-delay: 0ms; }
.doc-row:nth-child(2) { animation-delay: 60ms; }
.doc-row:nth-child(3) { animation-delay: 120ms; }
.doc-row:nth-child(4) { animation-delay: 180ms; }
.doc-row:nth-child(5) { animation-delay: 240ms; }
.doc-row:nth-child(n+6) { animation-delay: 300ms; }
```

### `.btn-new` (Primary Button)
**States**:
- Default: `box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25)`
- Hover: `transform: translateY(-2px); box-shadow: 0 8px 20px rgba(79, 70, 229, 0.35)`
- Active: `transform: translateY(0px); box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25)`
- Ripple: `animation: ripple 0.6s ease-out` (on `:active::before`)
- Transition: `all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)`

### `.btn-icon-only` (Secondary Buttons)
**States**:
- Default: `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05)`
- Hover: `box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15); transform: scale(1.08)`
- Active: `transform: scale(0.92)`
- Focus: `outline: 2px solid var(--accent); outline-offset: 2px`
- Ripple: `animation: ripple 0.6s ease-out` (on `:active::before`)
- Transition: `all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)`

### `.toolbar-tab` (Filter Tabs)
**States**:
- Default: No underline
- Active: `::after` shows `transform: scaleX(1)`
- Inactive: `::after` shows `transform: scaleX(0)`
- Transition: `transform 200ms ease`

**Underline Design**:
```css
.toolbar-tab::after {
    position: absolute;
    bottom: -8px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent);
    border-radius: 2px;
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 200ms ease;
}
```

### `.stat-card` (Summary Statistics)
**States**:
- Default: Normal shadow
- Hover: `transform: translateY(-4px); box-shadow: 0 16px 40px rgba(79, 70, 229, 0.15)`
- Transition: `all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)`

### `.doc-action` (Document Action Buttons)
**States**:
- Default: Icon visible
- Hover: `svg { transform: scale(1.2) }`
- Active: Ripple effect
- SVG Transition: `200ms cubic-bezier(0.34, 1.56, 0.64, 1)`

### `.search-result-item` (Search Results)
**Animation**:
```css
/* Cascading entrance */
.search-result-item { animation: slideInUp 0.3s ease-out backwards; }
.search-result-item:nth-child(1) { animation-delay: 0ms; }
.search-result-item:nth-child(2) { animation-delay: 50ms; }
.search-result-item:nth-child(3) { animation-delay: 100ms; }
.search-result-item:nth-child(4) { animation-delay: 150ms; }
.search-result-item:nth-child(n+5) { animation-delay: 200ms; }
```

---

## 🎨 Activity Feed Component

### `.activity-feed` Container
```css
display: flex;
flex-direction: column;
gap: 12px;
padding: 16px;
border-radius: 20px;
background: rgba(255, 255, 255, 0.9);
border: 1px solid rgba(226, 232, 240, 0.95);
max-height: 400px;
overflow-y: auto;
```

### `.activity-item` Card
**States**:
- Default: `border-left: 3px solid var(--accent)`
- Hover: `background: rgba(79, 70, 229, 0.06); transform: translateX(4px)`
- Transition: `all 200ms ease`

**Layout**:
```css
display: flex;
gap: 12px;
padding: 10px;
border-radius: 12px;
```

### `.activity-icon` Badge
```css
width: 32px;
height: 32px;
display: flex;
align-items: center;
justify-content: center;
border-radius: 8px;
background: var(--accent-light);
color: var(--accent);
flex-shrink: 0;
```

---

## 🎨 Tooltip System

### Data Attribute Selector: `[data-tooltip]`
**Show Trigger**: `:hover` and `:focus`

**Positioning**:
```css
::before {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 12px;
    background: rgba(15, 23, 42, 0.96);
    color: #f8fafc;
    border-radius: 8px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10000;
    border: 1px solid rgba(51, 65, 85, 0.95);
    animation: slideDown 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}
```

**Pointer Triangle**:
```css
::after {
    content: "";
    position: absolute;
    bottom: calc(100% + 2px);
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid rgba(15, 23, 42, 0.96);
    pointer-events: none;
    z-index: 10000;
}
```

---

## 🔌 CSS Variables Used

```css
--accent           /* Primary color: #4f46e5 */
--ink              /* Primary text: #0f172a */
--ink-muted        /* Secondary text: #64748b */
--accent-light     /* Light variant (auto-calculated) */
--danger           /* Error color: #dc2626 */
--teal             /* Accent: #14b8a6 */
--amber            /* Accent: #f59e0b */
--blue             /* Accent: #3b82f6 */
```

---

## 📊 Performance Notes

### GPU Acceleration
All animations use properties that trigger GPU acceleration:
- `transform` (used for all positioning/scaling)
- `opacity` (used for visibility changes)
- `border` colors (for accent animations)

### Smooth Animation Checklist
- ✅ No layout thrashing
- ✅ No repaints during transforms
- ✅ CSS transitions preferred over JS
- ✅ `will-change` could be added for heavy animations
- ✅ 60fps target on all modern devices

---

## 🎯 Implementation Examples

### Add Animation to New Element
```css
.my-element {
    animation: slideInUp 0.4s ease-out;
    animation-delay: 200ms;
}
```

### Add Hover Effect
```css
.my-element:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(79, 70, 229, 0.12);
    transition: all 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Add Ripple Effect
```css
.my-element {
    position: relative;
    overflow: hidden;
}

.my-element::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    transform: translate(-50%, -50%);
    pointer-events: none;
}

.my-element:active::before {
    animation: ripple 0.6s ease-out;
}
```

### Add Tooltip
```html
<button data-tooltip="Click to save">Save</button>
```

---

## 🧪 Testing Animations

### Check 60fps in Chrome DevTools
1. Open DevTools → Performance tab
2. Record animation
3. Check FPS meter (should be solid green)

### Check Animation Easing
1. Open DevTools → Animations panel
2. Watch animation timing
3. Verify smooth curve

### Test Dark Mode
1. Toggle dark mode
2. Verify all animations still work
3. Check color contrast

---

**Reference for all dashboard animations and interactions!**
