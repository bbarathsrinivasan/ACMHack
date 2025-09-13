import asyncio
from typing import Any, Dict, Tuple

import pytest

from app.mcp.client import MCPClient, MCPError
from app.services.files_db import FilesDB


class FakeFilesMCP(MCPClient):
    """In-memory fake implementing read/write with content-hash ETags."""

    def __init__(self):
        self.store: Dict[str, Tuple[Any, str]] = {}

    @staticmethod
    def _hash(data: Any) -> str:
        # Simple deterministic etag from repr; in real impl use sha256(orjson.dumps)
        return f"etag-{hash(repr(data)) & 0xFFFFFFFF}"

    async def call_tool(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        if name == "files.readJson":
            path = args["path"]
            if path not in self.store:
                # Treat missing as empty file with fixed etag
                data: Any = None
                etag = self._hash(data)
                self.store[path] = (data, etag)
            data, etag = self.store[path]
            return {"data": data, "etag": etag}
        elif name == "files.writeJson":
            path = args["path"]
            data = args["data"]
            if_match = args.get("ifMatch")
            # current etag
            cur = self.store.get(path)
            current_etag = cur[1] if cur else self._hash(None)
            if if_match is not None and if_match != current_etag:
                raise MCPError(409, "ETag mismatch")
            new_etag = self._hash(data)
            self.store[path] = (data, new_etag)
            return {"etag": new_etag}
        else:
            raise MCPError(400, f"unknown tool {name}")


@pytest.mark.asyncio
async def test_round_trip_read_write():
    client = FakeFilesMCP()
    db = FilesDB(client)

    # initial read initializes empty
    data, etag = await db.read_json("/data/test.json")
    assert data is None
    assert etag.startswith("etag-")

    # write new content
    new_data = {"hello": "world"}
    new_etag = await db.write_json("/data/test.json", new_data, if_match_etag=etag)
    assert new_etag != etag

    # read back
    read_back, etag2 = await db.read_json("/data/test.json")
    assert read_back == new_data
    assert etag2 == new_etag


@pytest.mark.asyncio
async def test_stale_etag_conflict():
    client = FakeFilesMCP()
    db = FilesDB(client)

    # Initialize and write once
    _, etag = await db.read_json("/data/thing.json")
    etag = await db.write_json("/data/thing.json", {"v": 1}, if_match_etag=etag)

    # External change (simulate) by writing with current etag
    latest = await db.write_json("/data/thing.json", {"v": 2}, if_match_etag=etag)
    assert latest != etag

    # Now attempt with stale etag
    with pytest.raises(MCPError) as exc:
        await db.write_json("/data/thing.json", {"v": 3}, if_match_etag=etag)
    assert exc.value.status_code == 409
