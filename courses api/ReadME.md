# CMU Course Schedule & Workload API

This FastAPI backend provides endpoints to generate course schedules (ICS calendar files), fetch course sections/lectures, and estimate weekly workload for CMU courses. It is designed to be easily integrated with other modules.

## Features

- **/sections/{course_code}**: Get available sections and lectures for a course.
- **/schedule**: Generate an ICS calendar and workload summary for selected courses/sections.
- **/ics**: Download the generated ICS calendar file.
- **/workload/{course_code}**: Get and save expected weekly workload for a course.

## Setup

1. **Clone this repository and navigate to the project folder.**

2. **Install dependencies:**
   ```bash
   pip install fastapi uvicorn ics pydantic
   ```

3. **Ensure you have a valid `courses.json` file in the project directory.**

4. **Run the FastAPI server:**
   ```bash
   uvicorn api_backend:app --reload
   ```

5. **Test endpoints using Swagger UI:**
   - Visit [http://localhost:8000/docs](http://localhost:8000/docs) in your browser.

## Example Usage

- **Get sections/lectures:**
  ```
  GET /sections/48-200
  ```

- **Get workload:**
  ```
  GET /workload/48-200
  ```

- **Generate schedule:**
  ```
  POST /schedule
  Body: {"course_codes": ["48-200 A", "48-200 Lec"]}
  ```

- **Download ICS file:**
  ```
  GET /ics
  ```

## Integration with Other Modules

- **API endpoints** are RESTful and return JSON, making it easy to connect from other Python scripts, web frontends, or microservices.
- **Schedule generation** and **workload calculation** can be triggered by other modules via HTTP requests.
- **ICS file** can be downloaded and imported into calendar apps or sent to users.

## Testing

A sample test block is included at the end of `api_backend.py` to demonstrate endpoint usage.  
Make sure the server is running before executing the test block.

## Notes

- Update `courses.json` as needed for your semester.
- All generated workload data is saved to `workload.json`.
- For deployment, consider using a production ASGI server (e.g., Gunicorn).

---

**Contact:**  
For questions or integration help, reach out to the project maintainers.