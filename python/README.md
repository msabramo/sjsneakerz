# Clothing Resale Business - Google Sheets Setup

This Python script automatically creates a complete Google Sheets system for
managing a clothing resale business with inventory tracking, sales management,
and shipping dashboard.

## Features

- **Inventory Tab**: Single source of truth for all items with auto-generated Item
  IDs and auto-calculated status
- **Sales Tab**: Record all sales with buyer and shipping information
- **Shipping Dashboard**: Filtered view of items that need attention
- **Money Flow Tracking**: 💰 **NEW!** Automatically track money from sale to vault
  - Automatic transfer tracking for each payment method
  - Visual dashboard showing current balances and pending transfers
  - Complete history of all money movements
  - Clear action items for each person
  - See [MONEY_FLOW_SETUP.md](MONEY_FLOW_SETUP.md) for setup instructions
- **Google Forms**: Easy mobile data entry
  - **Add Inventory Form**: Add items with quantity support
  - **Record Sale Form**: Pick from in-stock items with descriptions

## Prerequisites

1. Python 3.7 or higher
2. [uv](https://github.com/astral-sh/uv) - Fast Python package installer
3. Google account
4. Google Cloud project with Sheets API enabled

## Setup Instructions

### 1. Enable Google Sheets API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Google Sheets API" and click "Enable"
5. Also enable "Google Drive API" (needed to create new sheets)

### 2. Create OAuth 2.0 Credentials

1. In Google Cloud Console, go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (for personal use)
   - Add your email as a test user
   - Scopes: No need to add any (we'll specify in code)
4. Select "Desktop app" as the application type
5. Name it (e.g., "Resale Business Sheet Creator")
6. Click "Create"
7. Download the credentials JSON file
8. Rename it to `credentials.json` and place it in this project directory

### 3. Install uv (if not already installed)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Or on macOS with Homebrew:

```bash
brew install uv
```

### 4. Run the Script

With `uv`, you don't need to manually create a virtual environment or install
dependencies. Just run:

```bash
uv run create_resale_sheet.py
```

`uv` will automatically:

- Read the inline script dependencies (PEP 723)
- Create an isolated environment
- Install all required dependencies
- Run the script

The script contains inline metadata that tells `uv` exactly what it needs!

#### Update an Existing Spreadsheet

If you already have a spreadsheet and want to add the Item ID dropdown feature:

```bash
uv run add_item_id_dropdown.py
```

The script will prompt you for your spreadsheet URL or ID, then add the
validation.

Alternatively, pass the spreadsheet ID directly:

```bash
uv run add_item_id_dropdown.py YOUR_SPREADSHEET_ID
```

On first run:

- Your browser will open for Google OAuth authentication
- Sign in with your Google account
- Grant the requested permissions
- The script will create a `token.json` file for future runs

The script will output the URL of your newly created spreadsheet!

## What Gets Created

### Tab 1: Inventory

Your single source of truth for all items - combines purchase info with
real-time status:

- Item ID (auto-generated from Category-Brand-Size-Color-Row)
- UPC
- Category (Hoodie, Jacket, Tee, etc.)
- Brand
- Size (dropdown: XS, S, M, L, XL, XXL)
- Color
- Cost
- Date Purchased
- **Status** (auto-calculated: "Sold" or "In Stock")
- **Location** (dropdown: Zach's garage, Adi's garage)
- Notes
- Built-in filter views:
  - **In Stock** (default): Shows only available items
  - **Sold**: Shows only sold items
  - **All Statuses**: Shows everything

### Tab 2: Sales

Track all sales with:

- Item ID (dropdown: auto-populated from Inventory tab to prevent typos)
- Sale Price
- Date Sold
- Sold By (dropdown: Zach, Adi)
- Buyer
- Platform (dropdown: Depop, eBay, local)
- Shipping Status (dropdown: needs to ship, shipped, delivered, local pickup)
- Tracking Number
- Notes

### Tab 3: Shipping Dashboard

Auto-filtered view of items needing attention:

- Shows only items that need to ship or are in transit
- Pre-configured filter view "Outstanding Shipments" hides delivered items
- Click the filter icon to access the "Outstanding Shipments" view
- All relevant shipping and product details

## Security Notes

- `credentials.json` and `token.json` contain sensitive authentication data
- These files are excluded from git via `.gitignore`
- Never share or commit these files to version control
- The script only requests access to Google Sheets (no other Google services)

## Troubleshooting

### The script can't access my Google account

- Delete `token.json` and run the script again to re-authenticate
- Make sure you granted all requested permissions

### API not enabled error

- Verify both Google Sheets API and Google Drive API are enabled in Google
  Cloud Console

### Access blocked during OAuth

- Add your email as a test user in the OAuth consent screen configuration

## Customization

You can modify the script to:

- Add more categories, sizes, or conditions
- Change dropdown values for Sold By, Platform, etc.
- Add additional location options
- Customize column widths and formatting

## Recording Sales - Multiple Options

### Option 1: React App with REST API (Recommended) 🚀

Build a custom React frontend with a Google Apps Script backend API:

**Features:**

- Full control over UI/UX
- Modern React components
- Host anywhere (Vercel, Netlify, etc.)
- No Google HTML limitations
- Professional user experience

**Setup:**

1. Deploy Apps Script API (see `API_DEPLOYMENT_GUIDE.md`)
2. Test with `api_test.html`
3. Build React app using examples in `react-example/`
4. See `API_DOCUMENTATION.md` for full API reference

**Files:**

- `sales_api.gs` - Apps Script API backend
- `API_DOCUMENTATION.md` - Complete API reference
- `API_DEPLOYMENT_GUIDE.md` - Deployment instructions
- `api_test.html` - Quick API testing tool
- `react-example/` - React component examples

### Option 2: Apps Script Web App

See `SALES_WEBAPP_SETUP.md` for Apps Script-hosted HTML interface:

- **Cascading filters**: Category → Brand → Size → Color
- **Real-time filtering**: Item dropdown updates as you filter
- **Smart validation**: Ensures items are in stock
- **Item preview**: See details before recording sale
- **Mobile-optimized**: Add to home screen like a native app
- **Note**: Google applies restrictions to HTML served by Apps Script

### Option 3: Google Forms (Basic)

See `SALES_FORM_SETUP.md` for traditional form approach:

- Dropdown shows only "In Stock" items with descriptions
- Auto-updates hourly (or on-demand)
- Automatically marks items as "Sold"
- Mobile-friendly for recording sales anywhere

### Add Inventory Form

See `FORM_SETUP_GUIDE.md` for step-by-step instructions to create a form for
adding inventory items. Features:

- Mobile-friendly data entry
- Auto-generates Item IDs
- Supports quantity (add multiple identical items at once)
- Tracks who added each item

## Money Flow Tracking 💰

Track every dollar from sale to vault with complete visibility and accountability.

### What It Does

The Money Flow Tracking system automatically creates transfer entries when you record a sale, tracking the money through each step until it reaches the final vault. No more wondering where money is or who needs to do what!

### Key Capabilities

- **Automatic Tracking**: When you record a sale with a payment method, the system creates all transfer entries automatically
- **Visual Dashboard**: See at a glance where money is and what transfers are pending
- **Current Balances**: Know exactly how much is in each location (Cash (Nicole), Wells Fargo, SoFi Checking, SoFi Savings, etc.)
- **Pending Transfers**: Clear list of what needs to be done, grouped by responsible party
- **Transfer History**: Complete audit trail of all money movements
- **One-Click Complete**: Mark transfers complete with a single button click

### Setup

See [MONEY_FLOW_SETUP.md](MONEY_FLOW_SETUP.md) for complete setup instructions.

**Quick Start:**

1. Run `initializeMoneyFlowSheets()` in Apps Script (creates necessary sheets)
2. Deploy the latest `sales_api.gs` code
3. Open the Next.js app and navigate to Money Dashboard
4. Record a sale with a payment method selected
5. Watch transfers appear automatically!

### Payment Flows

The system handles these payment methods:

- **Cash (Zach)**: Customer → Zach → Nicole → Wells Fargo → SoFi Savings → Vault
- **Cash (Adi)**: Customer → Adi → Nicole → Wells Fargo → SoFi Savings → Vault
- **Zelle (Zach's parents)**: Direct to SoFi Checking → SoFi Savings → Vault
- **Zelle (Zach's Wells Fargo)**: Zach's WF → SoFi Savings → Vault
- **Apple Cash (Nicole)**: Nicole's AC → SoFi Savings → Vault
- **Apple Cash (Zach)**: Zach's AC → Nicole's AC → SoFi Savings → Vault
- **Depop**: Depop Account → SoFi Savings → Vault

### Daily Usage

1. Record sales as usual, **making sure to select the payment method**
2. Check the Money Dashboard regularly
3. When you complete a real-world transfer (e.g., Zach sends Apple Cash to Nicole), click "Mark Complete" on that transfer
4. The balance automatically updates to show money at the new location
5. Continue until money reaches the vault

## Sales Report

Create a comprehensive dashboard to track your business performance:

### Quick Setup

1. Open your spreadsheet
2. **Extensions** > **Apps Script**
3. Create a new file, paste code from `create_sales_report.js`
4. Run `createSalesReport`

### What You Get

**Key Metrics:**

- Total Sales Amount ($)
- Number of Items Sold
- Average Sale Price

**Profit Analysis:**

- Total Cost (of sold items)
- Total Profit
- Average Profit per Item

**Sales Breakdowns:**

- By Platform (Depop, eBay, Local)
- By Person (Zach, Adi)

**Status Tracking:**

- Shipping Status (needs to ship, shipped, delivered)
- Inventory Status (in stock, sold, sell-through rate)

All metrics update automatically as you add sales and inventory!

## Visual Formatting

Make your inventory easier to scan with conditional formatting:

1. Open your spreadsheet
2. **Extensions** > **Apps Script**
3. Create a new file, paste code from `add_sold_formatting.js`
4. Run one of:
   - `addSoldItemFormatting` - Strikethrough + gray text for sold items
   - `addInStockHighlight` - Green for in stock, red + strikethrough for sold

Sold items will automatically update their appearance when status changes!

## License

This project is free to use and modify for your resale business needs.
