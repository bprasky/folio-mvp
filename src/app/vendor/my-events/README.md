# Vendor Event Analytics Dashboard

This directory contains the Folio Vendor "My Events" Analytics Dashboard implementation.

## Structure

### Pages
- `/vendor/my-events` - Lists all vendor events with basic metrics
- `/vendor/my-events/[eventId]` - Detailed analytics dashboard for a specific event

### Components
All components are located in `src/components/vendor/events/`:

- **EventHeader.tsx** - Event title, dates, location, and action buttons
- **EventFilters.tsx** - Event switcher, date range, and city filters
- **KpiStrip.tsx** - Key performance indicators (RSVPs, attendance, products saved, project value)
- **ChartCard.tsx** - Generic wrapper for chart components with title and subtitle
- **ProductsSavedByRoom.tsx** - Bar chart showing saves by room type
- **SavesOverTime.tsx** - Line chart showing engagement over time
- **ProjectPhasesPie.tsx** - Pie chart showing project phase breakdown
- **GeoHeatSimplified.tsx** - City list with intensity bars
- **TopDesignersTable.tsx** - Table of top designers by influence
- **TopProductsTable.tsx** - Table of top products with save counts
- **TrendMaterials.tsx** - Trending materials with delta percentages
- **RecommendedInvites.tsx** - List of recommended designer invites
- **LoadingSkeleton.tsx** - Loading state with skeleton UI

### Data & Utilities
- **src/lib/mock/eventAnalytics.ts** - Mock data and TypeScript types
- **src/lib/format.ts** - Formatting utilities for currency, percentages, dates, etc.

## Styling

The dashboard follows the Folio brand guidelines:
- **Background**: `#F7F4F1` (warm neutral)
- **Text Primary**: `#2B2B2B`
- **Accents**: `#8C8278` (stone), `#3A332E` (deep neutral)
- **Borders**: `#DAD2CA` (subtle borders)

## Features

- **Responsive Design**: Works on mobile, tablet, and desktop
- **Loading States**: Skeleton loading for better UX
- **Interactive Charts**: Built with Recharts library
- **Data Export**: CSV export functionality (ready for implementation)
- **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation

## Mock Data

The implementation uses mock data that can be easily swapped with real API endpoints. The `getEventAnalytics(eventId)` function provides realistic sample data for demonstration.

## Future Enhancements

- Connect to real analytics API endpoints
- Add real-time data updates
- Implement CSV export functionality
- Add advanced filtering options
- Include more chart types and insights









