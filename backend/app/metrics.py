from typing import Tuple
from prometheus_client import Counter, Histogram, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST

# Dedicated registry so we can control exposure explicitly
registry = CollectorRegistry()

# Example metrics; can be extended per-router
REQUEST_COUNT = Counter(
    'app_requests_total',
    'Total HTTP requests',
    ['method', 'path', 'status'],
    registry=registry,
)

REQUEST_LATENCY = Histogram(
    'app_request_latency_seconds',
    'HTTP request latency in seconds',
    ['method', 'path'],
    registry=registry,
)


def export_prometheus() -> Tuple[bytes, str]:
    """Return Prometheus metrics payload and content-type."""
    return generate_latest(registry), CONTENT_TYPE_LATEST
