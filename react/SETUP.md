# Sales App Setup Guide

This Next.js app provides a beautiful interface for recording sales using your Sales Management API.

## Prerequisites

1. **Deploy the API** - Follow `../API_DEPLOYMENT_GUIDE.md` to deploy your Apps Script API
2. **Get your API URL** - Copy the deployment URL from Apps Script

## Setup Steps

### 1. Install Dependencies

```bash
cd my-sales-app
npm install
```

### 2. Configure API URL

Create a `.env.local` file in the root of `my-sales-app`:

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Replace `YOUR_DEPLOYMENT_ID` with your actual Apps Script deployment ID.

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

### Home Page (`/`)
- Clean landing page with quick access to record sales
- Feature overview cards
- Modern, responsive design

### Record Sale Page (`/record-sale`)
- Select from in-stock inventory
- View item details (cost, location, notes)
- Real-time profit calculation
- Conditional fields (tracking number when shipped)
- Form validation
- Success/error notifications
- Auto-refresh inventory after sale

## Project Structure

```
my-sales-app/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home page
│   │   ├── record-sale/
│   │   │   └── page.tsx          # Record sale page
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css           # Global styles
│   └── lib/
│       └── SalesAPI.ts           # TypeScript API client
├── .env.local                    # API configuration (create this)
└── package.json
```

## Technology Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **React Hooks** - State management

## API Client (`src/lib/SalesAPI.ts`)

The TypeScript API client provides type-safe methods:

```typescript
import SalesAPI from '@/lib/SalesAPI';

// Get all in-stock items
const items = await SalesAPI.getInStockItems();

// Get specific item
const item = await SalesAPI.getItem('SJ-001');

// Record sale
const result = await SalesAPI.recordSale({
  itemId: 'SJ-001',
  salePrice: 150.00,
  dateSold: '2025-12-31',
  soldBy: 'John Doe',
  platform: 'In Person',
  shippingStatus: 'Picked Up'
});

// Get statistics
const stats = await SalesAPI.getSummaryStats();
```

## Customization

### Styling
- Edit `src/app/globals.css` for global styles
- Tailwind classes are used throughout components
- Dark mode is supported automatically

### Add New Pages
1. Create folder in `src/app/`
2. Add `page.tsx` file
3. Export default component

Example:
```typescript
// src/app/inventory/page.tsx
export default function Inventory() {
  return <div>Inventory Page</div>;
}
```

### Modify Form Fields
Edit `src/app/record-sale/page.tsx`:
- Add new fields to `formData` state
- Add form inputs in the JSX
- Update the API call with new fields

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variable:
   - Key: `NEXT_PUBLIC_API_BASE_URL`
   - Value: Your Apps Script URL
5. Deploy!

### Deploy to Netlify

1. Push your code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Import your repository
4. Build command: `npm run build`
5. Publish directory: `.next`
6. Add environment variable in Site Settings
7. Deploy!

## Troubleshooting

### "Failed to load items"
- Check that your API URL is correct in `.env.local`
- Verify the API is deployed and accessible
- Check browser console for error details

### CORS Errors
- Shouldn't happen with Apps Script, but if you see them:
- Make sure you're using the `/exec` URL, not `/dev`
- Try the API URL directly in your browser first

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Check TypeScript errors with `npm run build`
- Clear `.next` folder and rebuild

## Next Steps

1. **Add Dashboard** - Create a stats/dashboard page
2. **Add Inventory View** - Show all items with filtering
3. **Add Sales History** - View past sales
4. **Add Bulk Sale** - Record multiple items at once
5. **Add Authentication** - Protect routes if needed

## Environment Variables

Required:
- `NEXT_PUBLIC_API_BASE_URL` - Your Apps Script API URL

Optional (for future features):
- `NEXT_PUBLIC_GA_ID` - Google Analytics ID
- `NEXT_PUBLIC_SENTRY_DSN` - Error tracking

## Support

- See main documentation: `../API_DOCUMENTATION.md`
- Test your API: Open `../api_test.html` in browser
- Check API logs: Apps Script > Executions tab

## Tips

- Use dark mode toggle in your OS - the app supports it automatically
- The form remembers your name ("Sold By") between sales
- Profit calculation happens in real-time as you type the price
- Success messages auto-dismiss after 3 seconds


