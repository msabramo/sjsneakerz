# Clothing Resale App

A mobile-friendly clothing resale application that uses Google Sheets for
data persistence, powered by Google Apps Script backend APIs and a React
frontend.

## Architecture Overview

This application consists of three main components:

### 1. **Python Tools** (`python/` directory)

Scripts that create and configure the Google Sheets infrastructure used for
data persistence. These tools set up the spreadsheet structure, forms, and
initial configuration needed for the resale business.

**Key Features:**

- Creates Google Sheets with inventory, sales, and shipping dashboards
- Sets up Google Forms for mobile data entry
- Configures money flow tracking
- See [`python/README.md`](python/README.md) for detailed setup instructions

### 2. **Google Apps Script Backend** (`clasp/` directory)

The backend API that powers the application. This code runs in Google Apps
Script and provides REST API endpoints that interact with the Google Sheet.

**Key Features:**

- REST API for inventory and sales operations
- Money flow tracking and vault balance management
- Form management and validation
- See [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) for API
  details

### 3. **React Frontend** (`react/` directory)

A mobile-friendly React/Next.js application that users interact with. The
frontend communicates with the Google Apps Script backend API to read and
write data stored in Google Sheets.

**Key Features:**

- Mobile-optimized interface
- Inventory management
- Sales recording
- Barcode scanning
- Money dashboard
- See [`react/README.md`](react/README.md) for setup instructions

## How It Works

```text
┌─────────────────┐
│  React App      │  ← Users interact here (mobile-friendly)
│  (Frontend)     │
└────────┬────────┘
         │ HTTP Requests
         ▼
┌─────────────────┐
│  Apps Script     │  ← Backend API (Google Apps Script)
│  (Backend API)   │
└────────┬────────┘
         │ Reads/Writes
         ▼
┌─────────────────┐
│  Google Sheets  │  ← Data persistence
│  (Database)     │
└─────────────────┘
```

1. **Setup**: Use Python tools to create and configure the Google Sheet
2. **Backend**: Deploy Google Apps Script code to provide API endpoints
3. **Frontend**: Run the React app that communicates with the backend API
4. **Data Flow**: All data is stored in Google Sheets, accessed through the
   Apps Script API

## Getting Started

1. **Create the Google Sheet**: Follow instructions in
   [`python/README.md`](python/README.md)
2. **Deploy the Backend API**: See
   [`docs/API_DEPLOYMENT_GUIDE.md`](docs/API_DEPLOYMENT_GUIDE.md)
3. **Set up the React App**: Follow instructions in
   [`react/README.md`](react/README.md)

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- [`GETTING_STARTED.md`](docs/GETTING_STARTED.md) - Initial setup guide
- [`API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) - Complete API
  reference
- [`API_DEPLOYMENT_GUIDE.md`](docs/API_DEPLOYMENT_GUIDE.md) - Backend
  deployment instructions
- [`MONEY_FLOW_SETUP.md`](docs/MONEY_FLOW_SETUP.md) - Money tracking setup
- And more...

## Directory Structure

- **`python/`** - Python scripts for Google Sheets setup and configuration
- **`clasp/`** - Google Apps Script code (backend API)
- **`react/`** - React/Next.js frontend application
- **`docs/`** - Project documentation
- **`old/`** - Legacy code and examples

## License

This project is free to use and modify for your resale business needs.
