# 🖼️ Smart Image Search & Auto-Population

## Overview

The Smart Image Search feature automatically finds and populates relevant images for events, vendors, and products when users don't provide their own images. This creates a much better user experience by eliminating blank image placeholders.

## Features

- **Intelligent Context-Aware Search**: Analyzes event/vendor/product details to find relevant images
- **Multi-Source Search**: Searches Unsplash, Pexels, and Google Images for the best results
- **Quality Filtering**: Automatically filters out low-quality or inappropriate images
- **Auto-Population**: Seamlessly fills in missing banner, thumbnail, and logo images
- **Smart Categorization**: Automatically categorizes images as logos, banners, or thumbnails

## Setup

### 1. Environment Variables

Add these API keys to your `.env` file:

```env
# Unsplash API (Free tier: 50 requests/hour)
UNSPLASH_ACCESS_KEY=your_unsplash_access_key

# Pexels API (Free tier: 200 requests/hour)  
PEXELS_API_KEY=your_pexels_api_key

# Google Custom Search API (Free tier: 100 requests/day)
GOOGLE_CUSTOM_SEARCH_API_KEY=your_google_api_key
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id
```

### 2. API Key Setup

#### Unsplash
1. Go to https://unsplash.com/developers
2. Create a new application
3. Copy your Access Key

#### Pexels
1. Go to https://www.pexels.com/api/
2. Sign up and get your API key

#### Google Custom Search
1. Go to https://developers.google.com/custom-search
2. Create a new search engine
3. Enable image search
4. Get your API key and Search Engine ID

## Usage

### Automatic Integration

The smart image search is automatically integrated into:

- **Event Creation** (`/api/admin/events`)
- **Vendor Creation** (`/api/admin/vendors`)
- **Product Creation** (when implemented)

When creating events or vendors without images, the system automatically searches for and populates relevant images.

### Manual API Usage

```javascript
// Search for images
const response = await fetch('/api/smart-images', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'event',
    name: 'Balthazar Restaurant Dinner',
    description: 'An intimate dinner with design legend Kelly Wearstler',
    location: 'SoHo, New York'
  })
});

const { images } = await response.json();
```

### React Component

```jsx
import SmartImageSelector from '@/components/SmartImageSelector';

<SmartImageSelector
  type="event"
  name="Balthazar Restaurant Dinner"
  description="An intimate dinner with design legend Kelly Wearstler"
  location="SoHo, New York"
  onImageSelect={(imageUrl, imageType) => {
    // Handle image selection
    console.log(`Selected ${imageType}: ${imageUrl}`);
  }}
/>
```

## How It Works

### 1. Context Analysis
The system analyzes the entity details to build intelligent search queries:

- **Events**: Combines title, location, and description with event-specific keywords
- **Vendors**: Searches for brand logos and company imagery
- **Products**: Looks for product photography with brand context

### 2. Multi-Source Search
Searches multiple image APIs simultaneously:
- **Unsplash**: High-quality stock photos
- **Pexels**: Free stock photos
- **Google Images**: Web-sourced images (when available)

### 3. Quality Filtering
Automatically filters results based on:
- Minimum resolution requirements
- Aspect ratio appropriateness
- Source reliability
- Image quality scores

### 4. Smart Categorization
Automatically categorizes images:
- **Logos**: Square images or images with "logo" in title
- **Banners**: Wide images (1200px+) for headers
- **Thumbnails**: Smaller images for previews

## Example Queries

### Event: "Balthazar Restaurant Dinner"
**Generated Query**: "Balthazar Restaurant Dinner SoHo, New York An intimate dinner with design legend Kelly Wearstler restaurant interior design"

### Vendor: "Benjamin Moore"
**Generated Query**: "Benjamin Moore Benjamin Moore logo brand design"

### Product: "Eames Lounge Chair"
**Generated Query**: "Eames Lounge Chair Herman Miller furniture product photography"

## Error Handling

The system gracefully handles:
- Missing API keys (falls back to available sources)
- API rate limits (continues with available results)
- Network failures (continues event/vendor creation)
- No results found (returns empty array)

## Performance

- **Search Time**: 2-5 seconds for multi-source search
- **Cache**: Results can be cached for repeated searches
- **Rate Limits**: Respects API rate limits with fallbacks
- **Quality**: Returns top 5 results ranked by relevance and quality

## Future Enhancements

- **Image Caching**: Cache frequently searched images
- **AI Image Analysis**: Use AI to verify image relevance
- **Custom Image Sources**: Add more image APIs
- **Batch Processing**: Search multiple entities at once
- **Image Optimization**: Automatically optimize selected images

## Testing

Run the test script to verify functionality:

```bash
node scripts/test-smart-images.js
```

This will test searches for events, vendors, products, and locations, and demonstrate auto-population functionality.

## Troubleshooting

### Common Issues

1. **No images found**: Check API keys and rate limits
2. **Poor quality results**: Adjust search query building logic
3. **Slow performance**: Consider caching or reducing search sources
4. **API errors**: Verify API keys and quotas

### Debug Mode

Enable debug logging by setting:
```env
DEBUG_SMART_IMAGES=true
```

This will log search queries and results for debugging. 