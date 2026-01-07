# Demo Mode Implementation

## Overview

Demo Mode provides an interactive experience for vendor dashboards where sliders drive both AI insight updates and visual chart responses with smooth animations.

## Features

### 🎛️ Interactive Controls
- **Engagement Lift**: -50% to +50% scaling for saves and tags
- **Save→Tag Rate**: 0-100% conversion rate override
- **Market Mix**: NYC, Miami, LA distribution sliders
- **Room Bias**: Kitchen, Bath, Outdoor preference sliders

### 📊 Live Chart Animations
- **Saves Over Time**: Line heights scale with engagement lift
- **Room×Phase Heatmap**: Cell percentages shift based on room bias
- **Compact Funnel**: Boards→Tags conversion adjusts with save tag rate

### 🎨 Premium UI
- Glass-morphism control panel with backdrop blur
- Smooth spring animations (Framer Motion)
- Real-time value indicators
- Demo mode indicator badge

## Usage

### Basic Setup
```tsx
import { useDemoStore } from "@/lib/demo/demoStore";
import { useDemoDerived } from "@/lib/demo/demoDerived";

function MyComponent() {
  const { demoMode, setDemoMode } = useDemoStore();
  const { liftScalar, saveTagTarget } = useDemoDerived();
  
  return (
    <div>
      {demoMode ? <DemoChart data={data} /> : <RegularChart data={data} />}
    </div>
  );
}
```

### Demo Charts
```tsx
import { SavesOverTimeDemo } from "@/components/vendor/charts/SavesOverTimeDemo";
import { RoomPhaseHeatmapDemo } from "@/components/vendor/charts/RoomPhaseHeatmapDemo";
import { CompactFunnelDemo } from "@/components/vendor/charts/CompactFunnelDemo";

// Use demo charts when demoMode is true
{demoMode ? (
  <SavesOverTimeDemo data={timelineData} />
) : (
  <SavesOverTime data={timelineData} />
)}
```

### Control Panel
```tsx
import { DemoControlPanel } from "@/components/vendor/demo/DemoControlPanel";

// Add to your dashboard
<DemoControlPanel />
```

## Architecture

### State Management
- **Zustand Store**: Centralized demo state
- **Derived Selectors**: Computed values and weights
- **Type Safety**: Full TypeScript support

### Animation System
- **Framer Motion**: Smooth spring transitions
- **Layout Animations**: Automatic chart updates
- **Performance**: Optimized re-renders

### Chart Adapters
- **Data Transformation**: Map demo state to chart data
- **Conditional Rendering**: Switch between demo/regular charts
- **Animation Integration**: Seamless transitions

## File Structure

```
src/
├── lib/demo/
│   ├── demoStore.ts          # Zustand store
│   ├── demoDerived.ts        # Computed selectors
│   └── anim.ts               # Animation helpers
├── components/vendor/
│   ├── demo/
│   │   ├── DemoControlPanel.tsx
│   │   └── DemoModeIndicator.tsx
│   └── charts/
│       ├── SavesOverTimeDemo.tsx
│       ├── RoomPhaseHeatmapDemo.tsx
│       └── CompactFunnelDemo.tsx
```

## Testing

Visit `/demo-test` to see the demo mode in action with a full vendor analytics dashboard.

## Acceptance Criteria

✅ **Toggling Demo Mode** immediately swaps charts to demo variants  
✅ **Moving sliders** animates chart data in real-time  
✅ **Smooth animations** with <400ms transitions  
✅ **No persistence** - refresh restores real data  
✅ **Premium feel** with glass controls and smooth motion  

## Future Enhancements

- **Pulse glow** for artificially boosted metrics
- **Demo tags** on changed metrics
- **Market mix** binding to geo charts
- **Export functionality** for demo scenarios





