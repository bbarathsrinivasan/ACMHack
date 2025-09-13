import json
import os
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Dict
from ics import Calendar, Event
from ics.grammar.parse import ContentLine
from datetime import datetime, timedelta

OUTPUT_FILE = "courses.json"
ICS_FILE = "courses_schedule.ics"

app = FastAPI()

def fetch_courses():
    with open(OUTPUT_FILE) as f:
        return json.load(f)

def get_sections_and_lectures(course):
    sections = [sec.get("name") for sec in course.get("sections", [])]
    lectures = [lec.get("name") for lec in course.get("lectures", [])]
    return {"sections": sections, "lectures": lectures}

def int_days_to_ical_days(days):
    mapping = {1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA", 7: "SU"}
    return [mapping[d] for d in days if d in mapping]

def get_course_meetings(courses, course_codes: List[str]):
    selected = []
    for entry in course_codes:
        parts = entry.strip().split()
        if len(parts) != 2:
            continue
        code, sec_or_lec = parts
        course = courses.get(code)
        if not course:
            continue
        found = False
        for sec in course.get("sections", []):
            if sec.get("name") == sec_or_lec:
                selected.append((code, course, sec, "Section"))
                found = True
                break
        if not found:
            for lec in course.get("lectures", []):
                if lec.get("name") == sec_or_lec:
                    selected.append((code, course, lec, "Lecture"))
                    found = True
                    break
    return selected

def create_events(selected_courses):
    events = []
    hours_per_class = {}
    semester_start = datetime(2025, 8, 25)
    semester_end = datetime(2025, 12, 5)
    for code, course, meeting_obj, meeting_type in selected_courses:
        name = f"{code} {course['name']} ({meeting_obj['name']} - {meeting_type})"
        for timeblock in meeting_obj.get("times", []):
            ical_days = int_days_to_ical_days(timeblock["days"])
            for day_int, day_ical in zip(timeblock["days"], ical_days):
                event_date = semester_start + timedelta(days=day_int-1)
                start_dt = datetime.strptime(timeblock["begin"], "%I:%M%p").replace(
                    year=event_date.year, month=event_date.month, day=event_date.day
                )
                end_dt = datetime.strptime(timeblock["end"], "%I:%M%p").replace(
                    year=event_date.year, month=event_date.month, day=event_date.day
                )
                event = Event(
                    name=name,
                    begin=start_dt,
                    end=end_dt,
                    location=f"{timeblock.get('building','')} {timeblock.get('room','')}",
                    description=course.get('desc', '')
                )
                rrule_str = f"FREQ=WEEKLY;BYDAY={day_ical};UNTIL={semester_end.strftime('%Y%m%dT%H%M%SZ')}"
                event.extra.append(ContentLine(name="RRULE", value=rrule_str))
                events.append(event)
                duration = (end_dt - start_dt).total_seconds() / 3600
                hours_per_class.setdefault(name, 0)
                hours_per_class[name] += duration
    return events, hours_per_class

@app.get("/sections/{course_code}")
def get_sections(course_code: str):
    courses = fetch_courses()
    course = courses.get(course_code)
    if not course:
        return JSONResponse({"error": "Course not found"}, status_code=404)
    return get_sections_and_lectures(course)

class ScheduleRequest(BaseModel):
    course_codes: List[str]

@app.post("/schedule")
def generate_schedule(req: ScheduleRequest):
    courses = fetch_courses()
    selected = get_course_meetings(courses, req.course_codes)
    events, hours_map = create_events(selected)
    cal = Calendar()
    for event in events:
        cal.events.add(event)
    with open(ICS_FILE, "w") as f:
        f.write(str(cal))
    return {
        "ics_file": ICS_FILE,
        "hours_per_class": hours_map
    }

@app.get("/ics")
def get_ics():
    if not os.path.exists(ICS_FILE):
        return JSONResponse({"error": "ICS file not found"}, status_code=404)
    return FileResponse(ICS_FILE, media_type="text/calendar")

@app.get("/workload/{course_code}")
def get_workload(course_code: str):
    courses = fetch_courses()
    course = courses.get(course_code)
    if not course:
        return JSONResponse({"error": "Course not found"}, status_code=404)
    # Estimate workload based on all sections/lectures
    total_hours = 0
    for sec in course.get("sections", []):
        for timeblock in sec.get("times", []):
            begin = datetime.strptime(timeblock["begin"], "%I:%M%p")
            end = datetime.strptime(timeblock["end"], "%I:%M%p")
            duration = (end - begin).total_seconds() / 3600
            total_hours += duration * len(timeblock["days"])
    for lec in course.get("lectures", []):
        for timeblock in lec.get("times", []):
            begin = datetime.strptime(timeblock["begin"], "%I:%M%p")
            end = datetime.strptime(timeblock["end"], "%I:%M%p")
            duration = (end - begin).total_seconds() / 3600
            total_hours += duration * len(timeblock["days"])
    workload_data = {"course_code": course_code, "expected_hours_per_week": total_hours}
    # Save to workload.json
    with open("workload.json", "w") as f:
        json.dump(workload_data, f, indent=2)
    return workload_data

if __name__ == "__main__":
    import requests

    BASE_URL = "http://localhost:8000"

    # Test: Get sections/lectures for a course
    course_code = "48-200"
    resp = requests.get(f"{BASE_URL}/sections/{course_code}")
    print("Sections and Lectures:", resp.json())

    # Test: Get workload for a course
    resp = requests.get(f"{BASE_URL}/workload/{course_code}")
    print("Workload:", resp.json())

    # Verify workload.json was created and print its contents
    if os.path.exists("workload.json"):
        with open("workload.json") as f:
            print("workload.json contents:", json.load(f))
    else:
        print("workload.json not found.")

    # Test: Generate schedule (ICS + workload)
    payload = {"course_codes": ["48-200 A", "48-200 Lec"]}
    resp = requests.post(f"{BASE_URL}/schedule", json=payload)
    print("Schedule Response:", resp.json())

    # Test: Download ICS file
    resp = requests.get(f"{BASE_URL}/ics")
    if resp.status_code == 200:
        with open("downloaded_schedule.ics", "wb") as f:
            f.write(resp.content)
        print("ICS file downloaded as downloaded_schedule.ics")
    else:
        print("ICS file not found:", resp.json())

# To run: uvicorn api_backend:app --reload