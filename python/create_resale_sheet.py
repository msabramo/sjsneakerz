#!/usr/bin/env python3
"""
Create a Google Sheet for clothing resale business with automated tracking.

/// script
requires-python = ">=3.7"
dependencies = [
    "google-auth>=2.27.0",
    "google-auth-oauthlib>=1.2.0",
    "google-auth-httplib2>=0.2.0",
    "google-api-python-client>=2.116.0",
]
///
"""

import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 
          'https://www.googleapis.com/auth/drive.file']

def get_credentials():
    """Authenticate and return credentials for Google Sheets API."""
    creds = None
    
    # The file token.json stores the user's access and refresh tokens
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # If there are no (valid) credentials available, let the user log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('credentials.json'):
                print("\nError: credentials.json not found!")
                print("Please follow the setup instructions in README.md")
                print("to create OAuth credentials and download them as credentials.json")
                exit(1)
            
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save the credentials for the next run
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    
    return creds

def create_spreadsheet(service):
    """Create a new spreadsheet with 3 sheets."""
    spreadsheet = {
        'properties': {
            'title': 'Clothing Resale Business'
        },
        'sheets': [
            {'properties': {'title': 'Inventory', 'gridProperties': {'frozenRowCount': 1}}},
            {'properties': {'title': 'Sales', 'gridProperties': {'frozenRowCount': 1}}},
            {'properties': {'title': 'Shipping Dashboard', 'gridProperties': {'frozenRowCount': 1}}}
        ]
    }
    
    spreadsheet = service.spreadsheets().create(body=spreadsheet).execute()
    spreadsheet_id = spreadsheet['spreadsheetId']
    
    print(f"Created spreadsheet: {spreadsheet['properties']['title']}")
    print(f"Spreadsheet ID: {spreadsheet_id}")
    
    return spreadsheet_id

def setup_inventory_tab(service, spreadsheet_id):
    """Set up the Inventory tab with headers and formulas."""
    
    # Define headers - consolidated from old Purchases + Inventory
    headers = [
        ['Item ID', 'UPC', 'Category', 'Brand', 'Size', 'Color', 
         'Cost', 'Date Purchased', 'Status', 'Location', 'Notes']
    ]
    
    # Write headers
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Inventory!A1:K1',
        valueInputOption='RAW',
        body={'values': headers}
    ).execute()
    
    # Add formula for Item ID generation in A2
    formula_a2 = '=IF(AND(C2<>"", D2<>"", E2<>"", F2<>""), CONCATENATE(C2,"-",D2,"-",E2,"-",F2,"-",ROW()), "")'
    
    # Add formula for Status in I2 (checks if Item ID exists in Sales tab)
    formula_i2 = '=IF(A2="", "", IF(COUNTIF(Sales!$A:$A, A2) > 0, "Sold", "In Stock"))'
    
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Inventory!A2',
        valueInputOption='USER_ENTERED',
        body={'values': [[formula_a2]]}
    ).execute()
    
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Inventory!I2',
        valueInputOption='USER_ENTERED',
        body={'values': [[formula_i2]]}
    ).execute()
    
    print("✓ Inventory tab configured")

def setup_sales_tab(service, spreadsheet_id):
    """Set up the Sales tab with headers."""
    
    # Define headers
    headers = [
        ['Item ID', 'Sale Price', 'Date Sold', 'Sold By', 'Buyer', 
         'Platform', 'Shipping Status', 'Tracking Number', 'Notes']
    ]
    
    # Write headers
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Sales!A1:I1',
        valueInputOption='RAW',
        body={'values': headers}
    ).execute()
    
    print("✓ Sales tab configured")


def setup_shipping_dashboard(service, spreadsheet_id):
    """Set up the Shipping Dashboard with headers and query formula."""
    
    # Define headers
    headers = [
        ['Item ID', 'Category', 'Brand', 'Size', 'Color', 'Buyer', 
         'Platform', 'Sale Price', 'Shipping Status', 'Tracking Number']
    ]
    
    # Write headers
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Shipping Dashboard!A1:J1',
        valueInputOption='RAW',
        body={'values': headers}
    ).execute()
    
    # Create a QUERY formula that joins Sales with Inventory data
    # This pulls all sales and looks up the product details from Inventory
    query_formula = '''=QUERY(
  ARRAYFORMULA(
    IF(Sales!A2:A<>"",
      {
        Sales!A2:A,
        IFERROR(VLOOKUP(Sales!A2:A, Inventory!A:K, 3, FALSE), ""),
        IFERROR(VLOOKUP(Sales!A2:A, Inventory!A:K, 4, FALSE), ""),
        IFERROR(VLOOKUP(Sales!A2:A, Inventory!A:K, 5, FALSE), ""),
        IFERROR(VLOOKUP(Sales!A2:A, Inventory!A:K, 6, FALSE), ""),
        Sales!E2:E,
        Sales!F2:F,
        Sales!B2:B,
        Sales!G2:G,
        Sales!H2:H
      },
    )
  ),
  "WHERE Col1 IS NOT NULL"
)'''
    
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Shipping Dashboard!A2',
        valueInputOption='USER_ENTERED',
        body={'values': [[query_formula]]}
    ).execute()
    
    print("✓ Shipping Dashboard configured")

def apply_data_validations(service, spreadsheet_id, sheet_ids):
    """Apply dropdown data validations to appropriate columns."""
    
    requests = []
    
    # Inventory sheet validations
    inventory_sheet_id = sheet_ids['Inventory']
    
    # Size validation (Column E - index 4) - XS, S, M, L, XL, XXL
    requests.append({
        'setDataValidation': {
            'range': {
                'sheetId': inventory_sheet_id,
                'startRowIndex': 1,
                'endRowIndex': 1000,
                'startColumnIndex': 4,
                'endColumnIndex': 5
            },
            'rule': {
                'condition': {
                    'type': 'ONE_OF_LIST',
                    'values': [
                        {'userEnteredValue': 'XS'},
                        {'userEnteredValue': 'S'},
                        {'userEnteredValue': 'M'},
                        {'userEnteredValue': 'L'},
                        {'userEnteredValue': 'XL'},
                        {'userEnteredValue': 'XXL'}
                    ]
                },
                'showCustomUi': True
            }
        }
    })
    
    # Location validation (Column J - index 9) - Zach's garage, Adi's garage
    requests.append({
        'setDataValidation': {
            'range': {
                'sheetId': inventory_sheet_id,
                'startRowIndex': 1,
                'endRowIndex': 1000,
                'startColumnIndex': 9,
                'endColumnIndex': 10
            },
            'rule': {
                'condition': {
                    'type': 'ONE_OF_LIST',
                    'values': [
                        {'userEnteredValue': "Zach's garage"},
                        {'userEnteredValue': "Adi's garage"}
                    ]
                },
                'showCustomUi': True
            }
        }
    })
    
    # Sales sheet validations
    sales_sheet_id = sheet_ids['Sales']
    
    # Item ID validation (Column A - index 0) - Reference Inventory Item IDs
    requests.append({
        'setDataValidation': {
            'range': {
                'sheetId': sales_sheet_id,
                'startRowIndex': 1,
                'endRowIndex': 1000,
                'startColumnIndex': 0,
                'endColumnIndex': 1
            },
            'rule': {
                'condition': {
                    'type': 'ONE_OF_RANGE',
                    'values': [
                        {'userEnteredValue': '=Inventory!$A$2:$A$1000'}
                    ]
                },
                'showCustomUi': True,
                'strict': True
            }
        }
    })
    
    # Sold By validation (Column D - index 3) - Zach, Adi
    requests.append({
        'setDataValidation': {
            'range': {
                'sheetId': sales_sheet_id,
                'startRowIndex': 1,
                'endRowIndex': 1000,
                'startColumnIndex': 3,
                'endColumnIndex': 4
            },
            'rule': {
                'condition': {
                    'type': 'ONE_OF_LIST',
                    'values': [
                        {'userEnteredValue': 'Zach'},
                        {'userEnteredValue': 'Adi'}
                    ]
                },
                'showCustomUi': True
            }
        }
    })
    
    # Platform validation (Column F - index 5) - Depop, eBay, local
    requests.append({
        'setDataValidation': {
            'range': {
                'sheetId': sales_sheet_id,
                'startRowIndex': 1,
                'endRowIndex': 1000,
                'startColumnIndex': 5,
                'endColumnIndex': 6
            },
            'rule': {
                'condition': {
                    'type': 'ONE_OF_LIST',
                    'values': [
                        {'userEnteredValue': 'Depop'},
                        {'userEnteredValue': 'eBay'},
                        {'userEnteredValue': 'local'}
                    ]
                },
                'showCustomUi': True
            }
        }
    })
    
    # Shipping Status validation (Column G - index 6)
    requests.append({
        'setDataValidation': {
            'range': {
                'sheetId': sales_sheet_id,
                'startRowIndex': 1,
                'endRowIndex': 1000,
                'startColumnIndex': 6,
                'endColumnIndex': 7
            },
            'rule': {
                'condition': {
                    'type': 'ONE_OF_LIST',
                    'values': [
                        {'userEnteredValue': 'needs to ship'},
                        {'userEnteredValue': 'shipped'},
                        {'userEnteredValue': 'delivered'},
                        {'userEnteredValue': 'local pickup (no shipping)'}
                    ]
                },
                'showCustomUi': True
            }
        }
    })
    
    # Execute all validation requests
    body = {'requests': requests}
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    print("✓ Data validations applied")

def apply_formatting(service, spreadsheet_id, sheet_ids):
    """Apply formatting to all sheets."""
    
    requests = []
    
    # Format headers for all sheets
    for sheet_name, sheet_id in sheet_ids.items():
        # Bold headers
        requests.append({
            'repeatCell': {
                'range': {
                    'sheetId': sheet_id,
                    'startRowIndex': 0,
                    'endRowIndex': 1
                },
                'cell': {
                    'userEnteredFormat': {
                        'backgroundColor': {'red': 0.2, 'green': 0.2, 'blue': 0.2},
                        'textFormat': {
                            'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
                            'fontSize': 10,
                            'bold': True
                        },
                        'horizontalAlignment': 'CENTER'
                    }
                },
                'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
        })
        
        # Add alternating row colors
        requests.append({
            'addConditionalFormatRule': {
                'rule': {
                    'ranges': [{
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'endRowIndex': 1000
                    }],
                    'booleanRule': {
                        'condition': {
                            'type': 'CUSTOM_FORMULA',
                            'values': [{'userEnteredValue': '=ISEVEN(ROW())'}]
                        },
                        'format': {
                            'backgroundColor': {'red': 0.95, 'green': 0.95, 'blue': 0.95}
                        }
                    }
                },
                'index': 0
            }
        })
    
    # Set column widths for better readability
    # Inventory sheet
    requests.extend([
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Inventory'], 'dimension': 'COLUMNS', 'startIndex': 0, 'endIndex': 1}, 'properties': {'pixelSize': 150}, 'fields': 'pixelSize'}},  # Item ID
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Inventory'], 'dimension': 'COLUMNS', 'startIndex': 1, 'endIndex': 2}, 'properties': {'pixelSize': 120}, 'fields': 'pixelSize'}},  # UPC
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Inventory'], 'dimension': 'COLUMNS', 'startIndex': 2, 'endIndex': 7}, 'properties': {'pixelSize': 100}, 'fields': 'pixelSize'}},  # Category-Color
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Inventory'], 'dimension': 'COLUMNS', 'startIndex': 7, 'endIndex': 8}, 'properties': {'pixelSize': 120}, 'fields': 'pixelSize'}},  # Date Purchased
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Inventory'], 'dimension': 'COLUMNS', 'startIndex': 8, 'endIndex': 9}, 'properties': {'pixelSize': 100}, 'fields': 'pixelSize'}},  # Status
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Inventory'], 'dimension': 'COLUMNS', 'startIndex': 9, 'endIndex': 10}, 'properties': {'pixelSize': 150}, 'fields': 'pixelSize'}},  # Location
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Inventory'], 'dimension': 'COLUMNS', 'startIndex': 10, 'endIndex': 11}, 'properties': {'pixelSize': 200}, 'fields': 'pixelSize'}},  # Notes
    ])
    
    # Sales sheet
    requests.extend([
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Sales'], 'dimension': 'COLUMNS', 'startIndex': 0, 'endIndex': 1}, 'properties': {'pixelSize': 150}, 'fields': 'pixelSize'}},  # Item ID
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Sales'], 'dimension': 'COLUMNS', 'startIndex': 1, 'endIndex': 3}, 'properties': {'pixelSize': 100}, 'fields': 'pixelSize'}},  # Sale Price, Date Sold
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Sales'], 'dimension': 'COLUMNS', 'startIndex': 3, 'endIndex': 7}, 'properties': {'pixelSize': 120}, 'fields': 'pixelSize'}},  # Sold By-Shipping Status
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Sales'], 'dimension': 'COLUMNS', 'startIndex': 7, 'endIndex': 8}, 'properties': {'pixelSize': 150}, 'fields': 'pixelSize'}},  # Tracking Number
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Sales'], 'dimension': 'COLUMNS', 'startIndex': 8, 'endIndex': 9}, 'properties': {'pixelSize': 200}, 'fields': 'pixelSize'}},  # Notes
    ])
    
    # Shipping Dashboard
    requests.extend([
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Shipping Dashboard'], 'dimension': 'COLUMNS', 'startIndex': 0, 'endIndex': 1}, 'properties': {'pixelSize': 150}, 'fields': 'pixelSize'}},  # Item ID
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Shipping Dashboard'], 'dimension': 'COLUMNS', 'startIndex': 1, 'endIndex': 8}, 'properties': {'pixelSize': 100}, 'fields': 'pixelSize'}},  # Rest
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Shipping Dashboard'], 'dimension': 'COLUMNS', 'startIndex': 8, 'endIndex': 9}, 'properties': {'pixelSize': 130}, 'fields': 'pixelSize'}},  # Shipping Status
        {'updateDimensionProperties': {'range': {'sheetId': sheet_ids['Shipping Dashboard'], 'dimension': 'COLUMNS', 'startIndex': 9, 'endIndex': 10}, 'properties': {'pixelSize': 150}, 'fields': 'pixelSize'}},  # Tracking Number
    ])
    
    # Execute all formatting requests
    body = {'requests': requests}
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    print("✓ Formatting applied")

def create_inventory_filters(service, spreadsheet_id, sheet_ids):
    """Create filter views on Inventory tab."""
    
    inventory_sheet_id = sheet_ids['Inventory']
    
    # Status column is I (index 8)
    requests = []
    
    # Filter 1: "In Stock" (default) - hide "Sold"
    requests.append({
        'addFilterView': {
            'filter': {
                'title': 'In Stock',
                'range': {
                    'sheetId': inventory_sheet_id,
                    'startRowIndex': 0,
                    'startColumnIndex': 0,
                    'endColumnIndex': 11  # All columns A-K
                },
                'criteria': {
                    8: {  # Status column (I, index 8)
                        'hiddenValues': ['Sold']
                    }
                }
            }
        }
    })
    
    # Filter 2: "Sold" - hide "In Stock"
    requests.append({
        'addFilterView': {
            'filter': {
                'title': 'Sold',
                'range': {
                    'sheetId': inventory_sheet_id,
                    'startRowIndex': 0,
                    'startColumnIndex': 0,
                    'endColumnIndex': 11
                },
                'criteria': {
                    8: {  # Status column (I, index 8)
                        'hiddenValues': ['In Stock']
                    }
                }
            }
        }
    })
    
    # Filter 3: "All Statuses" - no hidden values
    requests.append({
        'addFilterView': {
            'filter': {
                'title': 'All Statuses',
                'range': {
                    'sheetId': inventory_sheet_id,
                    'startRowIndex': 0,
                    'startColumnIndex': 0,
                    'endColumnIndex': 11
                }
            }
        }
    })
    
    body = {'requests': requests}
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    print("✓ Inventory filters created (In Stock, Sold, All Statuses)")

def create_shipping_filter(service, spreadsheet_id, sheet_ids):
    """Create a filter view on Shipping Dashboard for outstanding shipments."""
    
    shipping_sheet_id = sheet_ids['Shipping Dashboard']
    
    # Create filter view
    # Filter criteria: Shipping Status (column I, index 8) = "needs to ship" OR "shipped"
    # Note: Filter views don't support ONE_OF_LIST, so we hide the values we don't want
    request = {
        'addFilterView': {
            'filter': {
                'title': 'Outstanding Shipments',
                'range': {
                    'sheetId': shipping_sheet_id,
                    'startRowIndex': 0,
                    'startColumnIndex': 0,
                    'endColumnIndex': 10
                },
                'criteria': {
                    8: {  # Shipping Status column (index 8)
                        'hiddenValues': [
                            'delivered',
                            'local pickup (no shipping)'
                        ]
                    }
                }
            }
        }
    }
    
    body = {'requests': [request]}
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    print("✓ Shipping filter created (Outstanding Shipments)")

def get_sheet_ids(service, spreadsheet_id):
    """Get the sheet IDs for all sheets in the spreadsheet."""
    sheet_metadata = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheets = sheet_metadata.get('sheets', [])
    
    sheet_ids = {}
    for sheet in sheets:
        title = sheet['properties']['title']
        sheet_id = sheet['properties']['sheetId']
        sheet_ids[title] = sheet_id
    
    return sheet_ids

def main():
    """Main function to create and configure the spreadsheet."""
    print("\n=== Clothing Resale Business - Google Sheet Creator ===\n")
    
    try:
        # Authenticate
        print("Authenticating with Google Sheets API...")
        creds = get_credentials()
        service = build('sheets', 'v4', credentials=creds)
        
        # Create spreadsheet
        print("\nCreating spreadsheet...")
        spreadsheet_id = create_spreadsheet(service)
        
        # Get sheet IDs
        sheet_ids = get_sheet_ids(service, spreadsheet_id)
        
        # Set up each tab
        print("\nConfiguring tabs...")
        setup_inventory_tab(service, spreadsheet_id)
        setup_sales_tab(service, spreadsheet_id)
        setup_shipping_dashboard(service, spreadsheet_id)
        
        # Apply data validations
        print("\nApplying data validations...")
        apply_data_validations(service, spreadsheet_id, sheet_ids)
        
        # Apply formatting
        print("\nApplying formatting...")
        apply_formatting(service, spreadsheet_id, sheet_ids)
        
        # Create filter views
        print("\nCreating filter views...")
        create_inventory_filters(service, spreadsheet_id, sheet_ids)
        create_shipping_filter(service, spreadsheet_id, sheet_ids)
        
        # Success!
        spreadsheet_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
        print("\n" + "="*60)
        print("SUCCESS! Your spreadsheet is ready!")
        print("="*60)
        print(f"\nSpreadsheet URL:\n{spreadsheet_url}")
        print("\nYou can now:")
        print("1. Add items to Inventory tab (auto-generates Item IDs)")
        print("2. Record sales in Sales tab (Item ID dropdown)")
        print("3. Use Inventory filters: 'In Stock', 'Sold', 'All Statuses'")
        print("4. Monitor shipments in Shipping Dashboard tab")
        print("5. Status auto-updates when items are sold")
        print("\n")
        
    except HttpError as err:
        print(f"\nError: {err}")
        if "credentials.json" in str(err):
            print("\nMake sure you've created credentials.json following the README instructions.")
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        raise

if __name__ == '__main__':
    main()

