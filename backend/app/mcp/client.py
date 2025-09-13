from __future__ import annotations

from typing import Any, Dict, Tuple


class MCPError(Exception):
    def __init__(self, status_code: int, message: str = ""):
        super().__init__(message or f"MCP error {status_code}")
        self.status_code = status_code


class MCPClient:
    """Very small facade for invoking MCP tools.

    In production this would communicate over stdio/websocket to the MCP server.
    Here, we just define the interface needed by FilesDB and tests.
    """

    async def call_tool(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Invoke an MCP tool by name with args and return a JSON-like result.

        Expected return for files.readJson:
            {"data": Any, "etag": str}
        Expected return for files.writeJson:
            {"etag": str}
        Errors should raise MCPError(status_code, message)
        """
        raise NotImplementedError

    # Convenience wrappers
    async def files_read_json(self, path: str) -> Tuple[Any, str]:
        res = await self.call_tool("files.readJson", {"path": path})
        return res.get("data"), res.get("etag")

    async def files_write_json(self, path: str, data: Any, if_match: str | None) -> str:
        res = await self.call_tool(
            "files.writeJson",
            {"path": path, "data": data, "ifMatch": if_match},
        )
        return res.get("etag")
