#!/usr/bin/env python3
"""
Add Essentials Hoodie XL Light Oatmeal to inventory with UPC 460035734583
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    import json
except ImportError:
    print("ERROR: Required packages not installed.")
    print("Run: pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")
    sys.exit(1)

# Configuration
SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'  # Get this from your spreadsheet URL
SHEET_NAME = 'Consolidated Inventory'

# Item details
item = {
    'Item ID': 'ESS-HOODIE-XL-OATMEAL-001',  # You can customize this
    'UPC': '460035734583',
    'Category': 'Hoodie',
    'Brand': 'Essentials',
    'Size': 'XL',
    'Color': 'Light Oatmeal',
    'Cost': '65.00',  # Update with actual cost
    'Date Purchased': '',  # Add if you know it
    'Status': 'In Stock',
    'Location': 'Inventory',  # Update with actual location
    'Notes': 'Added via script for barcode scanning'
}

def get_sheets_service():
    """Create Google Sheets API service"""
    try:
        creds = service_account.Credentials.from_service_account_file(
            'credentials.json',
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        return build('sheets', 'v4', credentials=creds)
    except FileNotFoundError:
        print("ERROR: credentials.json not found")
        print("You need to set up Google Sheets API credentials")
        sys.exit(1)

def main():
    print("=" * 70)
    print("ADD ESSENTIALS HOODIE TO INVENTORY")
    print("=" * 70)
    print(f"\nItem Details:")
    for key, value in item.items():
        print(f"  {key}: {value}")
    print("\n" + "=" * 70)
    
    # Manual instructions (safer than running the script)
    print("\n📋 MANUAL STEPS TO ADD THIS ITEM:\n")
    print("1. Open your Google Sheets 'Consolidated Inventory'")
    print("2. Find the next empty row")
    print("3. Add a new row with these values:\n")
    
    columns = [
        "Item ID", "UPC", "Category", "Brand", "Size", "Color", 
        "Cost", "Date Purchased", "Status", "Location", "Notes"
    ]
    
    for col in columns:
        print(f"   {col}: {item.get(col, '')}")
    
    print("\n4. IMPORTANT: Make sure the UPC is exactly: 460035734583")
    print("   - No spaces, dashes, or extra characters")
    print("   - Format the cell as 'Plain text' (not number) to preserve leading zeros")
    
    print("\n5. Save the sheet")
    print("6. Refresh your sales app (reload the page)")
    print("7. Try scanning again!")
    
    print("\n" + "=" * 70)
    print("\n💡 TIPS:")
    print("  • Make sure the UPC column is formatted as TEXT, not NUMBER")
    print("  • Double-check there are no extra spaces before/after the UPC")
    print("  • The Status must be 'In Stock' for the item to appear")
    print("  • If you have multiple items with the same details, each needs a unique Item ID")
    print("\n" + "=" * 70)

if __name__ == "__main__":
    main()

