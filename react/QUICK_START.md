# 🚀 Quick Start - Sales App

Get your sales recording app running in 3 minutes!

## Step 1: Configure API

Create `.env.local` file:

```bash
echo "NEXT_PUBLIC_API_BASE_URL=YOUR_API_URL_HERE" > .env.local
```

Replace `YOUR_API_URL_HERE` with your Apps Script deployment URL.

## Step 2: Install & Run

```bash
npm install
npm run dev
```

## Step 3: Open Browser

Visit: [http://localhost:3000](http://localhost:3000)

## What You Get

### Home Page (`/`)
- Beautiful landing page
- "Record Sale" button
- Feature showcase

### Record Sale Page (`/record-sale`)
- Dropdown of in-stock items
- Item details preview
- Real-time profit calculation
- Form validation
- Success/error notifications

## Features

✅ **TypeScript** - Full type safety
✅ **Responsive** - Works on mobile & desktop  
✅ **Dark Mode** - Automatic theme switching
✅ **Real-time** - Live profit calculations
✅ **Smart Forms** - Conditional fields & validation
✅ **Error Handling** - Clear error messages

## Testing Without API

The app will show errors if API isn't configured, but you can:
1. View the UI/layout
2. Test form interactions
3. See validation messages

Once API is configured, everything works automatically!

## Common Issues

**Can't load items?**
- Check `.env.local` exists
- Verify API URL is correct
- Test API with `api_test.html` first

**Build errors?**
- Run `npm install` again
- Delete `.next` folder
- Try `npm run build`

## Next Steps

1. ✅ Basic recording works
2. Add dashboard page
3. Add sales history
4. Add bulk recording
5. Deploy to Vercel

See `SETUP.md` for detailed documentation.

---

**Need help?** Check the main API documentation in `../API_DOCUMENTATION.md`


