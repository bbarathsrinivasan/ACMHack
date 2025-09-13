import requests
from bs4 import BeautifulSoup
import re
#from urllib.parse import urljoin
import json
from urllib.parse import urljoin, parse_qs, urlparse
import icalendar
from datetime import datetime
from icalendar import Calendar, Event

BASE_URL = "https://www.cs.cmu.edu/~mgormley/courses/10601/"

# ------------------------
# 1. Scrape Schedule Page
# ------------------------
def scrape_schedule():
    url = urljoin(BASE_URL, "schedule.html")
    html = requests.get(url).text
    soup = BeautifulSoup(html, "html.parser")

    events = {}

    rows = soup.find_all("tr")
    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 3:
            continue

        date_text = cols[0].get_text(" ", strip=True)

        # --- Clean Event title (Lecture/Recitation/Exam) ---
        raw_event_title = cols[1].get_text(" ", strip=True)
        raw_event_title = re.sub(r"\s+", " ", raw_event_title)  # remove \n, tabs, extra spaces
        event_title = re.sub(r"\[.*?\]", "", raw_event_title).strip()  # remove [slides], [handout]

        # Guess event type
        if "recitation" in event_title.lower():
            event_type = "Recitation"
        elif any(x in event_title.lower() for x in ["exam", "midterm", "final"]):
            event_type = "Exam"
        elif "lecture" in event_title.lower():
            event_type = "Lecture"
        else:
            event_type = "Other"

        # --- Announcements ---
        ann_text = cols[-1].get_text(" ", strip=True).lower()

        # detect HW mentions like "HW2 out", "HW1 due"
        hw_matches = re.findall(r"(hw\d+)\s*(out|due)", ann_text)

        if not hw_matches:
            events.setdefault(date_text, []).append({
                "hw_id": None,
                "title": {},
                "event_type": event_type,
                "text": event_title,
                "status": ""
            })

        for hw, status in hw_matches:
            hw_upper = hw.upper()
            status = status.capitalize()  # Out / Due

            events.setdefault(date_text, []).append({
                "hw_id": hw_upper,
                "title": {},  # will be filled from coursework
                "event_type": event_type,
                "text": event_title,
                "status": status
            })

    return events


# ------------------------
# 2. Scrape Coursework Page
# ------------------------
def scrape_coursework():
    url = urljoin(BASE_URL, "coursework.html")
    html = requests.get(url).text
    soup = BeautifulSoup(html, "html.parser")

    hw_titles = {}
    text_blocks = soup.find_all(['p', 'li'])

    for block in text_blocks:
        text = block.get_text(" ", strip=True)
        text = re.sub(r"\s+", " ", text)  # clean \n and extra spaces

        match = re.match(r"(Homework\s*\d+):\s*(.+)", text, re.IGNORECASE)
        if match:
            hw_id = match.group(1).replace(" ", "").upper()
            title_text = match.group(2).strip()

            # --- Title link (first <a>) ---
            link = ""
            a = block.find("a")
            if a:
                link = urljoin(url, a["href"])

            # normalize to HW1, HW2 ...
            norm_key = re.sub(r"HOMEWORK(\d+)", r"HW\1", hw_id)
            hw_titles[norm_key] = {
                "text": title_text,
                "url": link
            }

    return hw_titles


# ------------------------
# 3. Merge Schedule + Coursework
# ------------------------
def build_events():
    schedule = scrape_schedule()
    coursework = scrape_coursework()

    for date, items in schedule.items():
        for item in items:
            hw_id = item["hw_id"]
            if hw_id and hw_id in coursework:
                item["title"] = coursework[hw_id]

    return schedule

# ------------------------
# 4. Create Calendar event
# ------------------------
def create_event(event,dtstart,dtend,summary,cal):

    event.add("summary",summary)
    event.add("dtstart", dtstart)
    event.add("dtend", dtend)  # same end for single-point events
    #event.add("description", details["desc"])'''
    cal.add_component(event)
    with open("events.ics", "wb") as f:
         f.write(cal.to_ical())



if __name__ == 'main':
    s = build_events()
    output_file = 'homework.json'
    with open(output_file, "w") as f:
        json.dump(s, f, indent=4)
    print(f" Homework data written to {output_file}")


    cal = Calendar()
    for date,val in list(s.items())[:-1]:
        event = Event()
        Year = '2025'
        if val[0]['hw_id']:
            if val[0]['status'] == 'Due':
                dtstart = datetime.strptime(date + f"-{Year}  00:00:00", "%a, %d-%b-%Y %H:%M:%S")
                dtend = datetime.strptime(date + f"-{Year}  23:59:59", "%a, %d-%b-%Y %H:%M:%S")
                summary = f'ML {val[0]['hw_id']} {val[0]['status']}'
                
            elif val[0]['status'] == 'Out':
                dtstart = datetime.strptime(date + f"-{Year}  00:00:00", "%a, %d-%b-%Y %H:%M:%S")
                dtend = datetime.strptime(date + f"-{Year}  23:59:59", "%a, %d-%b-%Y %H:%M:%S")
                summary = f'ML {val[0]['hw_id']} {val[0]['status']}'
            create_event(event,dtstart,dtend,summary,cal)










