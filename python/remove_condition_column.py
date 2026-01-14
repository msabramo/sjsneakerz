#!/usr/bin/env python3
"""
Remove the Condition column from an existing spreadsheet.

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
import sys
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_credentials():
    """Authenticate and return credentials for Google Sheets API."""
    creds = None
    
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('credentials.json'):
                print("\nError: credentials.json not found!")
                exit(1)
            
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    
    return creds

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

def remove_condition_column(service, spreadsheet_id):
    """Remove the Condition column from Inventory tab."""
    
    print("\n=== Steps ===\n")
    
    # Get sheet IDs
    sheet_ids = get_sheet_ids(service, spreadsheet_id)
    
    if 'Inventory' not in sheet_ids:
        print("✗ Error: Inventory tab not found!")
        return False
    
    inventory_sheet_id = sheet_ids['Inventory']
    
    # Step 1: Delete column I (index 8) - Condition
    print("1. Deleting Condition column (column I)...")
    
    delete_request = {
        'deleteDimension': {
            'range': {
                'sheetId': inventory_sheet_id,
                'dimension': 'COLUMNS',
                'startIndex': 8,  # Column I (Condition)
                'endIndex': 9
            }
        }
    }
    
    body = {'requests': [delete_request]}
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    # Step 2: Update Shipping Dashboard formula
    print("\n2. Updating Shipping Dashboard formula...")
    
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
    
    # Step 3: Update filter views to reference new Status column position
    print("\n3. Updating filter views...")
    
    # Need to delete old filter views and recreate them with correct column indices
    # Get existing filter views
    sheet_metadata = service.spreadsheets().get(
        spreadsheetId=spreadsheet_id,
        fields='sheets(properties,filterViews)'
    ).execute()
    
    requests = []
    
    # Delete existing inventory filter views
    for sheet in sheet_metadata.get('sheets', []):
        if sheet['properties']['title'] == 'Inventory':
            filter_views = sheet.get('filterViews', [])
            for fv in filter_views:
                if fv['title'] in ['In Stock', 'Sold', 'All Statuses']:
                    requests.append({
                        'deleteFilterView': {
                            'filterId': fv['filterViewId']
                        }
                    })
    
    # Execute deletions if any
    if requests:
        body = {'requests': requests}
        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body=body
        ).execute()
    
    # Recreate filter views with correct indices
    requests = []
    
    # Filter 1: "In Stock" - Status is now column I (index 8)
    requests.append({
        'addFilterView': {
            'filter': {
                'title': 'In Stock',
                'range': {
                    'sheetId': inventory_sheet_id,
                    'startRowIndex': 0,
                    'startColumnIndex': 0,
                    'endColumnIndex': 11  # A-K
                },
                'criteria': {
                    8: {  # Status column (I, index 8)
                        'hiddenValues': ['Sold']
                    }
                }
            }
        }
    })
    
    # Filter 2: "Sold"
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
                    8: {
                        'hiddenValues': ['In Stock']
                    }
                }
            }
        }
    })
    
    # Filter 3: "All Statuses"
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
    
    print("\n✓ Condition column removed successfully!")
    return True

def main():
    """Main function."""
    print("\n=== Remove Condition Column ===\n")
    print("This will:")
    print("  1. Delete the Condition column from Inventory")
    print("  2. Update Shipping Dashboard formulas")
    print("  3. Update filter views")
    print()
    
    # Get spreadsheet ID from command line or prompt
    if len(sys.argv) > 1:
        spreadsheet_id = sys.argv[1]
    else:
        print("Enter your Google Sheets URL or Spreadsheet ID:")
        user_input = input("URL or ID: ").strip()
        
        # Extract ID from URL if needed
        if 'docs.google.com/spreadsheets' in user_input:
            parts = user_input.split('/d/')
            if len(parts) > 1:
                spreadsheet_id = parts[1].split('/')[0]
            else:
                print("Error: Could not parse spreadsheet ID from URL")
                exit(1)
        else:
            spreadsheet_id = user_input
    
    print(f"\nSpreadsheet ID: {spreadsheet_id}")
    
    # Confirm
    confirm = input("\nProceed? (yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print("Cancelled.")
        return
    
    print("\nAuthenticating...")
    
    try:
        creds = get_credentials()
        service = build('sheets', 'v4', credentials=creds)
        
        if remove_condition_column(service, spreadsheet_id):
            print(f"\nView your updated sheet: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
            print("\nYour Inventory tab now has these columns:")
            print("  A: Item ID, B: UPC, C: Category, D: Brand, E: Size, F: Color")
            print("  G: Cost, H: Date Purchased, I: Status, J: Location, K: Notes")
    
    except HttpError as err:
        print(f"\nError: {err}")
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        raise

if __name__ == '__main__':
    main()


