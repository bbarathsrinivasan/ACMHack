import logging
import sys
from logging.config import dictConfig

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, PlainTextResponse
from pythonjsonlogger import jsonlogger

from .metrics import REQUEST_COUNT, REQUEST_LATENCY, export_prometheus
from .routers import health as health_router


# Configure JSON logging
class StackdriverJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        if not log_record.get('severity'):
            log_record['severity'] = record.levelname
        log_record['logger'] = record.name


def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    formatter = StackdriverJsonFormatter('%(asctime)s %(levelname)s %(name)s %(message)s')
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers = [handler]


setup_logging()
logger = logging.getLogger("app")

app = FastAPI(default_response_class=ORJSONResponse)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# Basic request metrics middleware
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    method = request.method
    path = request.url.path
    with REQUEST_LATENCY.labels(method=method, path=path).time():
        response: Response = await call_next(request)
    REQUEST_COUNT.labels(method=method, path=path, status=response.status_code).inc()
    return response


@app.get("/metrics")
def metrics():
    payload, content_type = export_prometheus()
    return Response(content=payload, media_type=content_type)


# Mount routers
app.include_router(health_router.router)


@app.get("/")
def root():
    return {"service": "acmhack-backend", "status": "ok"}
