import json
import base64
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Scope for read-only Gmail access
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

def gmail_service():
    """Authenticate and return Gmail API service"""
    flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
    creds = flow.run_local_server(port=0)
    service = build("gmail", "v1", credentials=creds)
    return service

def parse_email(msg):
    """Extract useful fields from a Gmail message"""
    headers = msg["payload"]["headers"]
    subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
    sender = next((h["value"] for h in headers if h["name"] == "From"), "")
    date = next((h["value"] for h in headers if h["name"] == "Date"), "")
    snippet = msg.get("snippet", "")

    # Decode body (preferring plain text > html)
    body = ""
    if "data" in msg["payload"]["body"]:
        try:
            body = base64.urlsafe_b64decode(msg["payload"]["body"]["data"]).decode("utf-8")
        except Exception:
            body = ""
    elif "parts" in msg["payload"]:
        for part in msg["payload"]["parts"]:
            if part["mimeType"] == "text/plain" and "data" in part["body"]:
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8")
                break
            elif part["mimeType"] == "text/html" and "data" in part["body"]:
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8")
                break

    return {
        "id": msg["id"],
        "from": sender,
        "subject": subject,
        "date": date,
        "snippet": snippet,
        "body": body.strip()
    }

def get_emails(service, max_results=10, label="INBOX"):
    """Fetch emails from Gmail and parse them"""
    results = service.users().messages().list(
        userId="me", labelIds=[label], maxResults=max_results
    ).execute()
    messages = results.get("messages", [])

    emails = []
    for m in messages:
        msg = service.users().messages().get(userId="me", id=m["id"]).execute()
        emails.append(parse_email(msg))
    return emails

if __name__ == "__main__":
    service = gmail_service()
    emails = get_emails(service, max_results=10, label="INBOX")

    # Save to JSON file
    with open("emails.json", "w", encoding="utf-8") as f:
        json.dump(emails, f, indent=4, ensure_ascii=False)

    print("✅ Saved first 10 emails (with subject, from, date, snippet, body) to emails.json")
