from __future__ import annotations

from typing import Any, Tuple

from app.mcp.client import MCPClient, MCPError


class FilesDB:
    """File-backed JSON storage using an MCP files server.

    Operations are atomic and guarded by content-hash ETags managed by the MCP server.
    """

    def __init__(self, client: MCPClient):
        self.client = client

    async def read_json(self, path: str) -> Tuple[Any, str]:
        """Read JSON file at path.

        Returns (data, etag).
        """
        data, etag = await self.client.files_read_json(path)
        if etag is None:
            # Defensive: ensure callers always receive an etag
            raise MCPError(500, "Missing ETag from files.readJson")
        return data, etag

    async def write_json(self, path: str, data: Any, if_match_etag: str | None = None) -> str:
        """Write JSON atomically.

        If if_match_etag is provided and does not match current content-hash,
        the MCP server should reject with 409. Returns the new etag on success.
        """
        try:
            new_etag = await self.client.files_write_json(path, data, if_match_etag)
            if new_etag is None:
                raise MCPError(500, "Missing ETag from files.writeJson")
            return new_etag
        except MCPError as e:
            # Bubble up 409 to callers for concurrency control
            if e.status_code == 409:
                raise
            # Re-raise others unchanged
            raise
