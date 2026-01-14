#!/usr/bin/env python3
"""
Create a Google Form for adding items to the Inventory tab.

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

# Need both Forms and Sheets scopes
SCOPES = [
    'https://www.googleapis.com/auth/forms.body',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
]

def get_credentials():
    """Authenticate and return credentials for Google APIs."""
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

def create_form_for_inventory(forms_service, spreadsheet_id):
    """Create a Google Form linked to the Inventory spreadsheet."""
    
    print("\n=== Creating Form ===\n")
    
    # Step 1: Create the form
    print("1. Creating form...")
    form = {
        "info": {
            "title": "Add Inventory Item",
            "documentTitle": "Clothing Resale - Add Inventory"
        }
    }
    
    result = forms_service.forms().create(body=form).execute()
    form_id = result['formId']
    form_url = f"https://docs.google.com/forms/d/{form_id}/edit"
    response_url = f"https://docs.google.com/forms/d/{form_id}/viewform"
    
    print(f"   Form ID: {form_id}")
    
    # Step 2: Add form description
    print("\n2. Adding form description...")
    
    requests = []
    
    # Update form info with description
    requests.append({
        'updateFormInfo': {
            'info': {
                'description': 'Add new items to your clothing resale inventory. Item ID and Status will be automatically generated.'
            },
            'updateMask': 'description'
        }
    })
    
    # Step 3: Add all form fields
    print("\n3. Adding form fields...")
    
    # Field 1: UPC (optional text)
    requests.append({
        'createItem': {
            'item': {
                'title': 'UPC',
                'description': 'Barcode number (optional)',
                'questionItem': {
                    'question': {
                        'required': False,
                        'textQuestion': {
                            'paragraph': False
                        }
                    }
                }
            },
            'location': {'index': 0}
        }
    })
    
    # Field 2: Category (required text)
    requests.append({
        'createItem': {
            'item': {
                'title': 'Category',
                'description': 'e.g., Hoodie, Jacket, Tee, Pants, Shoes',
                'questionItem': {
                    'question': {
                        'required': True,
                        'textQuestion': {
                            'paragraph': False
                        }
                    }
                }
            },
            'location': {'index': 1}
        }
    })
    
    # Field 3: Brand (required text)
    requests.append({
        'createItem': {
            'item': {
                'title': 'Brand',
                'description': 'Brand name',
                'questionItem': {
                    'question': {
                        'required': True,
                        'textQuestion': {
                            'paragraph': False
                        }
                    }
                }
            },
            'location': {'index': 2}
        }
    })
    
    # Field 4: Size (required dropdown)
    requests.append({
        'createItem': {
            'item': {
                'title': 'Size',
                'questionItem': {
                    'question': {
                        'required': True,
                        'choiceQuestion': {
                            'type': 'DROP_DOWN',
                            'options': [
                                {'value': 'XS'},
                                {'value': 'S'},
                                {'value': 'M'},
                                {'value': 'L'},
                                {'value': 'XL'},
                                {'value': 'XXL'}
                            ]
                        }
                    }
                }
            },
            'location': {'index': 3}
        }
    })
    
    # Field 5: Color (required text)
    requests.append({
        'createItem': {
            'item': {
                'title': 'Color',
                'description': 'Primary color',
                'questionItem': {
                    'question': {
                        'required': True,
                        'textQuestion': {
                            'paragraph': False
                        }
                    }
                }
            },
            'location': {'index': 4}
        }
    })
    
    # Field 6: Cost (required text - could validate as number)
    requests.append({
        'createItem': {
            'item': {
                'title': 'Cost',
                'description': 'Purchase price (numbers only)',
                'questionItem': {
                    'question': {
                        'required': True,
                        'textQuestion': {
                            'paragraph': False
                        }
                    }
                }
            },
            'location': {'index': 5}
        }
    })
    
    # Field 7: Date Purchased (date field)
    requests.append({
        'createItem': {
            'item': {
                'title': 'Date Purchased',
                'questionItem': {
                    'question': {
                        'required': True,
                        'dateQuestion': {
                            'includeTime': False,
                            'includeYear': True
                        }
                    }
                }
            },
            'location': {'index': 6}
        }
    })
    
    # Field 8: Location (dropdown)
    requests.append({
        'createItem': {
            'item': {
                'title': 'Location',
                'description': 'Where is this item stored?',
                'questionItem': {
                    'question': {
                        'required': False,
                        'choiceQuestion': {
                            'type': 'DROP_DOWN',
                            'options': [
                                {'value': "Zach's garage"},
                                {'value': "Adi's garage"}
                            ]
                        }
                    }
                }
            },
            'location': {'index': 7}
        }
    })
    
    # Field 9: Notes (optional paragraph)
    requests.append({
        'createItem': {
            'item': {
                'title': 'Notes',
                'description': 'Any additional details (optional)',
                'questionItem': {
                    'question': {
                        'required': False,
                        'textQuestion': {
                            'paragraph': True
                        }
                    }
                }
            },
            'location': {'index': 8}
        }
    })
    
    # Execute all requests
    forms_service.forms().batchUpdate(
        formId=form_id,
        body={'requests': requests}
    ).execute()
    
    print("   ✓ All fields added")
    
    # Step 4: Link form to spreadsheet
    print("\n4. Linking form to spreadsheet...")
    
    # Note: Google Forms API doesn't directly support linking responses to an existing sheet
    # We need to use the Drive API to set this up
    print("   Note: You'll need to manually link the form responses:")
    print("   1. Open the form in edit mode")
    print("   2. Click 'Responses' tab")
    print("   3. Click the three dots (...) and select 'Select response destination'")
    print("   4. Choose 'Select existing spreadsheet'")
    print(f"   5. Select your spreadsheet and choose the 'Inventory' tab")
    
    # Alternative: We can add a note about using Apps Script for automation
    print("\n5. Setting up automation...")
    print("   After linking, you'll need to add an Apps Script to:")
    print("   - Auto-generate Item IDs")
    print("   - Format the date properly")
    print("   - Move data to correct columns")
    
    return form_id, response_url, form_url

def create_apps_script_instructions(spreadsheet_id):
    """Provide instructions for the Apps Script automation."""
    
    script = '''
function onFormSubmit(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory");
  
  // Get the last row (the newly added form response)
  var lastRow = sheet.getLastRow();
  
  // Get the values from the form submission
  var category = sheet.getRange(lastRow, 3).getValue();  // Column C
  var brand = sheet.getRange(lastRow, 4).getValue();     // Column D
  var size = sheet.getRange(lastRow, 5).getValue();      // Column E
  var color = sheet.getRange(lastRow, 6).getValue();     // Column F
  
  // Generate Item ID: Category-Brand-Size-Color-Row
  var itemId = category + "-" + brand + "-" + size + "-" + color + "-" + lastRow;
  
  // Set the Item ID in column A
  sheet.getRange(lastRow, 1).setValue(itemId);
  
  // Format date in column H if needed
  var dateCell = sheet.getRange(lastRow, 8);
  var dateValue = dateCell.getValue();
  if (dateValue) {
    dateCell.setNumberFormat("MM/dd/yyyy");
  }
  
  // Status formula will auto-calculate via the formula in column I
  // Location is in column J from the form
  // Notes is in column K from the form
}
'''
    
    print("\n" + "="*60)
    print("APPS SCRIPT SETUP")
    print("="*60)
    print("\nAfter linking the form, add this Apps Script:")
    print(f"\n1. Open your spreadsheet: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
    print("2. Click Extensions > Apps Script")
    print("3. Delete any existing code")
    print("4. Paste this code:\n")
    print(script)
    print("\n5. Click the clock icon (Triggers)")
    print("6. Add trigger:")
    print("   - Function: onFormSubmit")
    print("   - Event source: From spreadsheet")
    print("   - Event type: On form submit")
    print("7. Save")

def main():
    """Main function."""
    print("\n=== Create Inventory Form ===\n")
    
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
    print("\nAuthenticating...")
    
    try:
        creds = get_credentials()
        forms_service = build('forms', 'v1', credentials=creds)
        
        form_id, response_url, form_url = create_form_for_inventory(forms_service, spreadsheet_id)
        
        print("\n" + "="*60)
        print("SUCCESS! Form created!")
        print("="*60)
        print(f"\nForm URL (to fill out):\n{response_url}")
        print(f"\nForm Edit URL:\n{form_url}")
        print("\nNext steps:")
        print("1. Open the form edit URL above")
        print("2. Link it to your spreadsheet (see instructions above)")
        print("3. Set up the Apps Script for auto-generation (see below)")
        
        create_apps_script_instructions(spreadsheet_id)
        
    except HttpError as err:
        print(f"\nError: {err}")
        if "403" in str(err):
            print("\nMake sure:")
            print("1. Google Forms API is enabled in Google Cloud Console")
            print("2. You've authorized the necessary scopes")
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        raise

if __name__ == '__main__':
    main()


