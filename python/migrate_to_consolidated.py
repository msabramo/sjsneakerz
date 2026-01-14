#!/usr/bin/env python3
"""
Migrate existing spreadsheet to consolidated structure (3 tabs instead of 4).
Merges Purchases + Inventory into a single Inventory tab.

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

def migrate_spreadsheet(service, spreadsheet_id):
    """Migrate the spreadsheet to consolidated structure."""
    
    print("\n=== Migration Steps ===\n")
    
    # Get sheet IDs
    sheet_ids = get_sheet_ids(service, spreadsheet_id)
    
    if 'Purchases' not in sheet_ids:
        print("✓ No Purchases tab found - already migrated or doesn't exist")
        return False
    
    if 'Inventory' not in sheet_ids:
        print("✗ Error: Inventory tab not found!")
        return False
    
    purchases_sheet_id = sheet_ids['Purchases']
    inventory_sheet_id = sheet_ids['Inventory']
    
    # Step 1: Read existing Purchases data
    print("1. Reading data from Purchases tab...")
    purchases_data = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range='Purchases!A2:J1000'
    ).execute()
    
    purchases_rows = purchases_data.get('values', [])
    print(f"   Found {len(purchases_rows)} items in Purchases")
    
    # Step 2: Update Inventory tab structure
    print("\n2. Updating Inventory tab with new structure...")
    
    # New headers
    new_headers = [
        ['Item ID', 'UPC', 'Category', 'Brand', 'Size', 'Color', 
         'Cost', 'Date Purchased', 'Condition', 'Status', 'Location', 'Notes']
    ]
    
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Inventory!A1:L1',
        valueInputOption='RAW',
        body={'values': new_headers}
    ).execute()
    
    # Step 3: Copy data from Purchases to Inventory (if there's data)
    if purchases_rows:
        print("\n3. Migrating data from Purchases to Inventory...")
        
        # Transform data: Purchases cols A-J become Inventory cols A-I, then J (Status), K (Location), L (Notes)
        migrated_rows = []
        for row in purchases_rows:
            # Pad row to have at least 10 columns
            while len(row) < 10:
                row.append('')
            
            # Rearrange: A-I from Purchases (A-I), then Status (empty), Location (empty), Notes (J from Purchases)
            migrated_row = row[0:9] + ['', '', row[9] if len(row) > 9 else '']
            migrated_rows.append(migrated_row)
        
        # Write migrated data
        service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range='Inventory!A2',
            valueInputOption='RAW',
            body={'values': migrated_rows}
        ).execute()
        
        print(f"   Migrated {len(migrated_rows)} items to new Inventory structure")
    else:
        print("\n3. No data to migrate (Purchases tab is empty)")
    
    # Step 4: Add formulas
    print("\n4. Adding formulas to Inventory...")
    
    # Item ID formula in A2
    formula_a2 = '=IF(AND(C2<>"", D2<>"", E2<>"", F2<>""), CONCATENATE(C2,"-",D2,"-",E2,"-",F2,"-",ROW()), "")'
    
    # Status formula in J2
    formula_j2 = '=IF(A2="", "", IF(COUNTIF(Sales!$A:$A, A2) > 0, "Sold", "In Stock"))'
    
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Inventory!A2',
        valueInputOption='USER_ENTERED',
        body={'values': [[formula_a2]]}
    ).execute()
    
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Inventory!J2',
        valueInputOption='USER_ENTERED',
        body={'values': [[formula_j2]]}
    ).execute()
    
    # Step 5: Update Shipping Dashboard formula to reference Inventory instead of Purchases
    print("\n5. Updating Shipping Dashboard to reference Inventory...")
    
    query_formula = '''=QUERY(
  ARRAYFORMULA(
    IF(Sales!A2:A<>"",
      {
        Sales!A2:A,
        IFERROR(VLOOKUP(Sales!A2:A, Inventory!A:L, 3, FALSE), ""),
        IFERROR(VLOOKUP(Sales!A2:A, Inventory!A:L, 4, FALSE), ""),
        IFERROR(VLOOKUP(Sales!A2:A, Inventory!A:L, 5, FALSE), ""),
        IFERROR(VLOOKUP(Sales!A2:A, Inventory!A:L, 6, FALSE), ""),
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
    
    # Step 6: Add validations to Inventory
    print("\n6. Adding data validations to Inventory...")
    
    requests = []
    
    # Size validation (Column E)
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
    
    # Condition validation (Column I)
    requests.append({
        'setDataValidation': {
            'range': {
                'sheetId': inventory_sheet_id,
                'startRowIndex': 1,
                'endRowIndex': 1000,
                'startColumnIndex': 8,
                'endColumnIndex': 9
            },
            'rule': {
                'condition': {
                    'type': 'ONE_OF_LIST',
                    'values': [
                        {'userEnteredValue': 'New'},
                        {'userEnteredValue': 'Like New'},
                        {'userEnteredValue': 'Good'},
                        {'userEnteredValue': 'Fair'}
                    ]
                },
                'showCustomUi': True
            }
        }
    })
    
    # Location validation (Column K)
    requests.append({
        'setDataValidation': {
            'range': {
                'sheetId': inventory_sheet_id,
                'startRowIndex': 1,
                'endRowIndex': 1000,
                'startColumnIndex': 10,
                'endColumnIndex': 11
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
    
    body = {'requests': requests}
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    # Step 7: Delete Purchases tab
    print("\n7. Deleting old Purchases tab...")
    
    delete_request = {
        'deleteSheet': {
            'sheetId': purchases_sheet_id
        }
    }
    
    body = {'requests': [delete_request]}
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    print("\n✓ Migration complete!")
    return True

def main():
    """Main function."""
    print("\n=== Migrate to Consolidated Structure ===\n")
    print("This will:")
    print("  1. Merge Purchases tab into Inventory tab")
    print("  2. Add Status and Location columns to Inventory")
    print("  3. Update Shipping Dashboard formulas")
    print("  4. Delete the old Purchases tab")
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
    confirm = input("\nProceed with migration? (yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print("Migration cancelled.")
        return
    
    print("\nAuthenticating...")
    
    try:
        creds = get_credentials()
        service = build('sheets', 'v4', credentials=creds)
        
        print("Starting migration...")
        
        if migrate_spreadsheet(service, spreadsheet_id):
            print(f"\nView your updated sheet: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
            print("\nYour spreadsheet now has 3 tabs:")
            print("  1. Inventory - Single source of truth for all items")
            print("  2. Sales - Record sales")
            print("  3. Shipping Dashboard - Monitor shipments")
        else:
            print("\n✗ Migration not needed or failed. Check messages above.")
    
    except HttpError as err:
        print(f"\nError: {err}")
        if "404" in str(err):
            print("\nMake sure:")
            print("1. The spreadsheet ID is correct")
            print("2. You have access to the spreadsheet")
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        raise

if __name__ == '__main__':
    main()


