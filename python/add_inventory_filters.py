#!/usr/bin/env python3
"""
Add filter views to the Inventory tab of an existing Google Sheet.

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

def add_inventory_filters(service, spreadsheet_id):
    """Add filter views to Inventory tab."""
    
    # Get sheet IDs
    sheet_ids = get_sheet_ids(service, spreadsheet_id)
    
    if 'Inventory' not in sheet_ids:
        print("Error: 'Inventory' tab not found in spreadsheet!")
        return False
    
    inventory_sheet_id = sheet_ids['Inventory']
    
    # Status column is H (index 7)
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
                    'endColumnIndex': 9  # All columns A-I
                },
                'criteria': {
                    7: {  # Status column (H, index 7)
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
                    'endColumnIndex': 9
                },
                'criteria': {
                    7: {  # Status column (H, index 7)
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
                    'endColumnIndex': 9
                }
            }
        }
    })
    
    body = {'requests': requests}
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return True

def main():
    """Main function."""
    print("\n=== Add Inventory Filters to Existing Sheet ===\n")
    
    # Get spreadsheet ID from command line or prompt
    if len(sys.argv) > 1:
        spreadsheet_id = sys.argv[1]
    else:
        print("Enter your Google Sheets URL or Spreadsheet ID:")
        print("Example URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit")
        print("Or just the ID: SPREADSHEET_ID")
        print()
        user_input = input("URL or ID: ").strip()
        
        # Extract ID from URL if needed
        if 'docs.google.com/spreadsheets' in user_input:
            # Extract ID from URL
            parts = user_input.split('/d/')
            if len(parts) > 1:
                spreadsheet_id = parts[1].split('/')[0]
            else:
                print("Error: Could not parse spreadsheet ID from URL")
                exit(1)
        else:
            spreadsheet_id = user_input
    
    print(f"\nSpreadsheet ID: {spreadsheet_id}")
    print("Authenticating...")
    
    try:
        creds = get_credentials()
        service = build('sheets', 'v4', credentials=creds)
        
        print("Adding filter views to Inventory tab...")
        
        if add_inventory_filters(service, spreadsheet_id):
            print("\n✓ Successfully added 3 filter views to Inventory tab!")
            print("\nCreated filters:")
            print("  1. In Stock - Shows only items in stock (hides Sold)")
            print("  2. Sold - Shows only sold items (hides In Stock)")
            print("  3. All Statuses - Shows all items")
            print("\nTo access filters: Click the filter icon in the Inventory tab")
            print(f"\nView your sheet: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
        else:
            print("\n✗ Failed to add filters. Check error messages above.")
    
    except HttpError as err:
        print(f"\nError: {err}")
        if "404" in str(err):
            print("\nMake sure:")
            print("1. The spreadsheet ID is correct")
            print("2. You have access to the spreadsheet")
        elif "already exists" in str(err).lower():
            print("\nThe filter views may already exist in this spreadsheet.")
    except Exception as e:
        print(f"\nUnexpected error: {e}")

if __name__ == '__main__':
    main()


