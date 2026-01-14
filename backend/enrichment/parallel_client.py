"""
Parallel API Client for AI-powered data enrichment.

Uses the Parallel Task API for web research-based enrichment.
Supports both individual tasks and batch processing via task groups.

API Documentation: https://docs.parallel.ai
"""

import os
import json
import httpx
import logging
from typing import Optional, Dict, Any, List, AsyncGenerator, Union
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)

# Parallel API configuration
PARALLEL_API_KEY = os.getenv("PARALLEL_API_KEY", "zTZQakT4R_l-6_a5j_5PnT_-mHgVj-2LWg0Tqual")
PARALLEL_BASE_URL = "https://api.parallel.ai"

# Processor tiers (in order of capability/cost)
PROCESSOR_TIERS = ["lite", "base", "core", "pro", "ultra"]


@dataclass
class TaskResult:
    """Result from a single Parallel API task."""
    run_id: str
    status: str  # pending, running, completed, failed
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class TaskGroupResult:
    """Result from a task group operation."""
    taskgroup_id: str
    total_runs: int = 0
    completed_runs: int = 0
    status: str = "pending"  # pending, running, completed, failed


class ParallelAPIError(Exception):
    """Custom exception for Parallel API errors."""
    def __init__(self, message: str, status_code: int = None, response: dict = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(message)


class ParallelClient:
    """
    Client for Parallel AI Task API.

    Provides methods for:
    - Creating individual enrichment tasks
    - Batch processing via task groups
    - Streaming results via SSE
    """

    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or PARALLEL_API_KEY
        self.base_url = base_url or PARALLEL_BASE_URL
        self.headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def create_task_run(
        self,
        input_data: Dict[str, Any],
        prompt: str,
        processor: str = "base",
        wait_for_result: bool = False,
    ) -> TaskResult:
        """
        Create a single task run for enrichment.

        Args:
            input_data: Data to process (e.g., fund information)
            prompt: Question or instruction for the AI
            processor: Processor tier (lite, base, core, pro, ultra)
            wait_for_result: If True, blocks until result is ready

        Returns:
            TaskResult with run_id and status
        """
        if processor not in PROCESSOR_TIERS:
            raise ValueError(f"Invalid processor: {processor}. Must be one of {PROCESSOR_TIERS}")

        payload = {
            "input": input_data,
            "task_spec": {
                "output_schema": prompt,
            },
            "processor": processor,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/v1/tasks/runs",
                    headers=self.headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

                run_id = data.get("run_id") or data.get("id")
                if not run_id:
                    raise ParallelAPIError("No run_id in response", response=data)

                result = TaskResult(
                    run_id=run_id,
                    status=data.get("status", "pending"),
                )

                if wait_for_result:
                    result = await self.get_task_result(run_id)

                return result

            except httpx.HTTPStatusError as e:
                error_body = e.response.json() if e.response.content else {}
                raise ParallelAPIError(
                    f"API request failed: {e.response.status_code}",
                    status_code=e.response.status_code,
                    response=error_body,
                )
            except Exception as e:
                logger.error(f"Parallel API error: {e}")
                raise ParallelAPIError(str(e))

    async def get_task_result(self, run_id: str, timeout: int = 300) -> TaskResult:
        """
        Get the result of a task run. Blocks until complete or timeout.

        Args:
            run_id: The task run ID
            timeout: Maximum seconds to wait

        Returns:
            TaskResult with result data
        """
        async with httpx.AsyncClient(timeout=float(timeout)) as client:
            try:
                # The /result endpoint blocks until the task is complete
                response = await client.get(
                    f"{self.base_url}/v1/tasks/runs/{run_id}/result",
                    headers=self.headers,
                )
                response.raise_for_status()
                data = response.json()

                return TaskResult(
                    run_id=run_id,
                    status="completed",
                    result=data.get("result") or data.get("output") or data,
                )

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 408:  # Timeout
                    return TaskResult(run_id=run_id, status="running")
                error_body = e.response.json() if e.response.content else {}
                return TaskResult(
                    run_id=run_id,
                    status="failed",
                    error=error_body.get("error") or str(e),
                )
            except Exception as e:
                return TaskResult(run_id=run_id, status="failed", error=str(e))

    async def create_task_group(self) -> str:
        """
        Create a new task group for batch processing.

        Returns:
            taskgroup_id for the new group
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/v1beta/tasks/groups",
                    headers=self.headers,
                    json={},
                )
                response.raise_for_status()
                data = response.json()

                taskgroup_id = data.get("taskgroup_id") or data.get("id")
                if not taskgroup_id:
                    raise ParallelAPIError("No taskgroup_id in response", response=data)

                logger.info(f"Created task group: {taskgroup_id}")
                return taskgroup_id

            except httpx.HTTPStatusError as e:
                error_body = e.response.json() if e.response.content else {}
                raise ParallelAPIError(
                    f"Failed to create task group: {e.response.status_code}",
                    status_code=e.response.status_code,
                    response=error_body,
                )

    async def add_runs_to_group(
        self,
        taskgroup_id: str,
        rows: List[Dict[str, Any]],
        prompt: str,
        processor: str = "base",
        row_id_field: str = "_id",
    ) -> int:
        """
        Add multiple task runs to a task group.

        Args:
            taskgroup_id: The task group ID
            rows: List of row data to process
            prompt: Question/instruction for enrichment
            processor: Processor tier
            row_id_field: Field to use as row identifier

        Returns:
            Number of runs added
        """
        if processor not in PROCESSOR_TIERS:
            raise ValueError(f"Invalid processor: {processor}")

        # Prepare runs
        runs = []
        for row in rows:
            run_input = {
                "row_id": row.get(row_id_field, str(len(runs))),
                "data": row,
            }
            runs.append({
                "input": run_input,
                "task_spec": {"output_schema": prompt},
                "processor": processor,
            })

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/v1beta/tasks/groups/{taskgroup_id}/runs",
                    headers=self.headers,
                    json={"runs": runs},
                )
                response.raise_for_status()
                data = response.json()

                added_count = data.get("added", len(runs))
                logger.info(f"Added {added_count} runs to group {taskgroup_id}")
                return added_count

            except httpx.HTTPStatusError as e:
                error_body = e.response.json() if e.response.content else {}
                raise ParallelAPIError(
                    f"Failed to add runs: {e.response.status_code}",
                    status_code=e.response.status_code,
                    response=error_body,
                )

    async def stream_group_results(
        self,
        taskgroup_id: str,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream results from a task group via SSE.

        Yields results as they complete.

        Args:
            taskgroup_id: The task group ID

        Yields:
            Dict with row_id, result, and status for each completed task
        """
        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream(
                    "GET",
                    f"{self.base_url}/v1beta/tasks/groups/{taskgroup_id}/events",
                    headers={**self.headers, "Accept": "text/event-stream"},
                ) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line:
                            continue

                        # Parse SSE format
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            if data_str:
                                try:
                                    event_data = json.loads(data_str)

                                    # Extract row result
                                    row_id = event_data.get("input", {}).get("row_id")
                                    result = event_data.get("result") or event_data.get("output")
                                    status = event_data.get("status", "completed")

                                    yield {
                                        "row_id": row_id,
                                        "result": result,
                                        "status": status,
                                        "run_id": event_data.get("run_id"),
                                    }

                                except json.JSONDecodeError:
                                    logger.warning(f"Failed to parse SSE data: {data_str}")

            except httpx.HTTPStatusError as e:
                logger.error(f"SSE stream error: {e}")
                raise ParallelAPIError(
                    f"Stream failed: {e.response.status_code}",
                    status_code=e.response.status_code,
                )

    async def get_group_status(self, taskgroup_id: str) -> TaskGroupResult:
        """
        Get the current status of a task group.

        Args:
            taskgroup_id: The task group ID

        Returns:
            TaskGroupResult with status and counts
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/v1beta/tasks/groups/{taskgroup_id}",
                    headers=self.headers,
                )
                response.raise_for_status()
                data = response.json()

                return TaskGroupResult(
                    taskgroup_id=taskgroup_id,
                    total_runs=data.get("total_runs", 0),
                    completed_runs=data.get("completed_runs", 0),
                    status=data.get("status", "running"),
                )

            except httpx.HTTPStatusError as e:
                return TaskGroupResult(
                    taskgroup_id=taskgroup_id,
                    status="error",
                )


# Helper function to build enrichment prompt
def build_enrichment_prompt(question: str, include_reasoning: bool = True) -> str:
    """
    Build a structured prompt for enrichment.

    Args:
        question: The user's question about the data
        include_reasoning: Whether to request reasoning in the response

    Returns:
        Formatted prompt string
    """
    base_prompt = f"""Based on the provided data and your web research capabilities, answer the following question:

{question}

The input contains data about a fund, company, or investor. Use web search to find additional information if needed.
Provide a concise, factual answer. If you cannot find the information, respond with "Unknown" or "Not available".
"""

    if include_reasoning:
        base_prompt += "\nBriefly explain your reasoning or cite your sources."

    return base_prompt


def build_enrichment_prompt_with_citations(question: str) -> str:
    """
    Build a structured prompt that requests JSON output with citations.

    This prompt instructs the AI to return structured JSON with:
    - answer: The main response
    - citations: List of source references with URLs

    Args:
        question: The user's question about the data

    Returns:
        Formatted prompt string requesting JSON output
    """
    return f"""Based on the provided data and your web research capabilities, answer the following question:

{question}

The input contains data about a fund, company, or investor. Use web search to find current and accurate information.

IMPORTANT: Return your response in the following JSON format:
{{
    "answer": "Your concise, factual answer here",
    "citations": [
        {{"url": "https://example.com/source", "title": "Source Title", "snippet": "Relevant excerpt from the source"}}
    ]
}}

Guidelines:
- Always include at least one citation for factual claims when available
- Each citation should have a url, title, and optional snippet
- Keep the answer concise and focused on the question
- If information cannot be verified, still provide your best answer with available citations
- If no information found, return: {{"answer": "No information available", "citations": []}}
"""


def parse_enrichment_result(raw_result: Any) -> Dict[str, Any]:
    """
    Parse the raw result from Parallel API into structured format.

    Handles both JSON responses and plain text responses.
    Also handles Parallel API's native format with 'basis' containing citations.

    Args:
        raw_result: Raw result from API (could be dict, string, or other)

    Returns:
        Dict with 'answer' and 'citations' keys
    """
    parsed = {
        "answer": None,
        "citations": [],
        "confidence": None
    }

    if raw_result is None:
        return parsed

    # Already a dict with expected structure
    if isinstance(raw_result, dict):
        # Check for Parallel API's native format with 'basis' containing citations
        # Format: {"basis": [{"field": "output", "citations": [...]}]}
        if "basis" in raw_result and isinstance(raw_result.get("basis"), list):
            basis_list = raw_result["basis"]
            all_citations = []

            for basis_item in basis_list:
                if isinstance(basis_item, dict):
                    item_citations = basis_item.get("citations", [])
                    for cit in item_citations:
                        # Normalize citation format
                        normalized = {
                            "url": cit.get("url", ""),
                            "title": cit.get("title", ""),
                            "snippet": ""
                        }
                        # Try to get snippet from excerpts
                        excerpts = cit.get("excerpts", [])
                        if excerpts and len(excerpts) > 0:
                            normalized["snippet"] = excerpts[0] if isinstance(excerpts[0], str) else ""
                        all_citations.append(normalized)

            parsed["citations"] = all_citations

            # For answer, try to get output/answer/result/content field
            parsed["answer"] = (
                raw_result.get("output") or
                raw_result.get("answer") or
                raw_result.get("result") or
                raw_result.get("content")  # Parallel API uses "content" field
            )
            if parsed["answer"] is None:
                # Extract text content, removing metadata fields
                answer_parts = []
                for key, value in raw_result.items():
                    if key not in ("basis", "citations", "confidence", "type"):  # Exclude "type" metadata
                        if isinstance(value, str):
                            answer_parts.append(value)
                parsed["answer"] = " ".join(answer_parts) if answer_parts else str(raw_result)

            return parsed

        # Standard format with answer/output and citations at top level
        parsed["answer"] = raw_result.get("answer") or raw_result.get("output") or raw_result.get("result")
        parsed["citations"] = raw_result.get("citations", [])
        parsed["confidence"] = raw_result.get("confidence")

        # If answer is still None, use the whole dict as string
        if parsed["answer"] is None:
            parsed["answer"] = str(raw_result)

        return parsed

    # String result - try to parse as JSON
    if isinstance(raw_result, str):
        # Try to extract JSON from the string
        try:
            # Look for JSON object in the string
            import re
            json_match = re.search(r'\{[\s\S]*\}', raw_result)
            if json_match:
                json_str = json_match.group()
                parsed_json = json.loads(json_str)

                # Recursively parse the JSON using our logic
                return parse_enrichment_result(parsed_json)
        except (json.JSONDecodeError, AttributeError):
            pass

        # Fall back to plain text
        parsed["answer"] = raw_result
        return parsed

    # Other types - convert to string
    parsed["answer"] = str(raw_result)
    return parsed
