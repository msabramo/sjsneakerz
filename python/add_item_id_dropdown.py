#!/usr/bin/env python3
"""
Add Item ID dropdown validation to an existing Google Sheet.

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

def add_item_id_validation(service, spreadsheet_id):
    """Add Item ID dropdown validation to Sales tab."""
    
    # Get sheet IDs
    sheet_ids = get_sheet_ids(service, spreadsheet_id)
    
    if 'Sales' not in sheet_ids:
        print("Error: 'Sales' tab not found in spreadsheet!")
        return False
    
    if 'Inventory' not in sheet_ids:
        print("Error: 'Inventory' tab not found in spreadsheet!")
        return False
    
    sales_sheet_id = sheet_ids['Sales']
    
    # Add Item ID validation
    request = {
        'setDataValidation': {
            'range': {
                'sheetId': sales_sheet_id,
                'startRowIndex': 1,  # Skip header row
                'endRowIndex': 1000,
                'startColumnIndex': 0,  # Column A (Item ID)
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
    }
    
    body = {'requests': [request]}
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return True

def main():
    """Main function."""
    print("\n=== Add Item ID Dropdown to Existing Sheet ===\n")
    
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
        
        print("Adding Item ID dropdown validation to Sales tab...")
        
        if add_item_id_validation(service, spreadsheet_id):
            print("\n✓ Successfully added Item ID dropdown!")
            print("\nThe Item ID column in the Sales tab now shows a dropdown")
            print("with all Item IDs from the Inventory tab.")
            print(f"\nView your sheet: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
        else:
            print("\n✗ Failed to add validation. Check error messages above.")
    
    except HttpError as err:
        print(f"\nError: {err}")
        if "404" in str(err):
            print("\nMake sure:")
            print("1. The spreadsheet ID is correct")
            print("2. You have access to the spreadsheet")
    except Exception as e:
        print(f"\nUnexpected error: {e}")

if __name__ == '__main__':
    main()


