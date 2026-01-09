"""
Deep Research Agent using LangGraph
Based on the open_deep_research project
"""

import os
import time
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from operator import itemgetter
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from tavily import TavilyClient

# Configure logger
logger = logging.getLogger(__name__)

# Timeout constants
SYNTHESIS_TIMEOUT = 300  # 5 minutes
REPORT_GENERATION_TIMEOUT = 300  # 5 minutes
HEARTBEAT_INTERVAL = 10  # 10 seconds


class ResearchAgent:
    """Agent for conducting deep research using LangGraph and LLMs"""

    def __init__(self):
        self.tavily_client = None
        if os.getenv("TAVILY_API_KEY"):
            self.tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

    def _get_llm(self, model: str):
        """Get LLM instance based on model name"""
        # OpenRouter models (via Cerebras)
        if model == "openai/gpt-oss-120b":
            # For OpenRouter - test without provider constraints first
            # OpenRouter will automatically route to available providers
            return ChatOpenAI(
                model=model,
                temperature=0.1,
                api_key=os.getenv("OPENROUTER_API_KEY"),
                base_url="https://openrouter.ai/api/v1"
            )
        elif model.startswith("gpt"):
            # GPT-5 models only support default temperature (1.0)
            if model.startswith("gpt-5"):
                return ChatOpenAI(
                    model=model,
                    api_key=os.getenv("OPENAI_API_KEY")
                )
            else:
                return ChatOpenAI(
                    model=model,
                    temperature=0.1,
                    api_key=os.getenv("OPENAI_API_KEY")
                )
        elif model.startswith("claude"):
            return ChatAnthropic(
                model=model,
                temperature=0.1,
                api_key=os.getenv("ANTHROPIC_API_KEY")
            )
        else:
            # Default to GPT-4
            return ChatOpenAI(
                model="gpt-4-turbo-preview",
                temperature=0.1,
                api_key=os.getenv("OPENAI_API_KEY")
            )

    async def _search(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """Perform web search using Tavily"""
        if not self.tavily_client:
            return [{
                "title": "Search Unavailable",
                "content": "Tavily API key not configured. Please add TAVILY_API_KEY to environment variables.",
                "url": ""
            }]

        try:
            response = self.tavily_client.search(
                query=query,
                max_results=max_results,
                include_answer=True,
                include_raw_content=False
            )

            return [
                {
                    "title": result.get("title", ""),
                    "content": result.get("content", ""),
                    "url": result.get("url", "")
                }
                for result in response.get("results", [])
            ]
        except Exception as e:
            print(f"Search error: {e}")
            return []

    async def _generate_search_queries(
        self,
        question: str,
        llm,
        num_queries: int = 3
    ) -> List[str]:
        """Generate multiple search queries from the research question"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a research assistant that generates effective web search queries.

Given a research question, generate {num_queries} diverse search queries that will help gather comprehensive information to answer the question.

Make the queries specific, varied in approach, and designed to capture different aspects of the topic.

Return ONLY the search queries, one per line, without numbering or additional text."""),
            ("human", "{question}")
        ])

        chain = prompt | llm

        response = await chain.ainvoke({
            "question": question,
            "num_queries": num_queries
        })

        # Parse the response to extract queries
        queries = [q.strip() for q in response.content.split('\n') if q.strip()]
        return queries[:num_queries]

    async def _synthesize_findings(
        self,
        question: str,
        search_results: List[Dict[str, Any]],
        llm
    ) -> str:
        """Synthesize search results into coherent findings"""

        # Format search results for the prompt
        formatted_results = "\n\n".join([
            f"Source: {result['title']}\nURL: {result['url']}\n{result['content']}"
            for result in search_results
        ])

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a research analyst synthesizing information from multiple sources.

Your task is to:
1. Analyze the provided search results
2. Extract key facts, insights, and data
3. Identify patterns and themes
4. Note any conflicting information
5. Synthesize a coherent summary

Be objective, factual, and cite sources where appropriate."""),
            ("human", """Research Question: {question}

Search Results:
{search_results}

Please provide a comprehensive synthesis of the findings.""")
        ])

        chain = prompt | llm

        response = await chain.ainvoke({
            "question": question,
            "search_results": formatted_results
        })

        return response.content

    async def _generate_report(
        self,
        question: str,
        synthesized_findings: str,
        llm,
        event_callback = None
    ) -> str:
        """Generate final research report with streaming support"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert research analyst creating a comprehensive research report.

Your report should:
1. Start with an executive summary
2. Provide detailed analysis organized by themes
3. Include specific data, facts, and examples
4. Present balanced perspectives
5. End with key takeaways and implications

Use markdown formatting with proper headings, lists, and emphasis.
Be thorough, professional, and insightful."""),
            ("human", """Research Question: {question}

Synthesized Findings:
{findings}

Please generate a comprehensive research report.""")
        ])

        chain = prompt | llm

        # Use streaming to emit chunks as they're generated
        full_report = ""
        async for chunk in chain.astream({
            "question": question,
            "findings": synthesized_findings
        }):
            # Extract content from chunk
            content = chunk.content if hasattr(chunk, 'content') else str(chunk)
            full_report += content

            # Emit chunk event immediately for real-time streaming
            if event_callback and content:
                event_callback({
                    "type": "report_chunk",
                    "data": content
                })

        return full_report

    async def research(
        self,
        query: str,
        model: str = "gpt-4-turbo-preview",
        search_provider: str = "tavily",
        progress_callback = None,
        event_callback = None
    ) -> str:
        """
        Conduct deep research on a query

        Args:
            query: The research question
            model: LLM model to use
            search_provider: Search provider (currently only tavily)
            progress_callback: Optional callback function to report progress messages
            event_callback: Optional callback for structured events (step_started, query_added, source_found, etc.)

        Returns:
            Comprehensive research report in markdown format
        """

        # Performance tracking
        start_time = time.time()
        step_times = {}
        search_times = []
        performance_log = []

        def log_step(step_name: str, duration: float):
            performance_log.append({
                "step": step_name,
                "duration": round(duration, 2),
                "timestamp": datetime.now().isoformat()
            })
            logger.info(f"⏱️  {step_name}: {duration:.2f}s")

        # Get LLM instance
        llm = self._get_llm(model)

        # Step 1: Generate search queries
        step_start = time.time()
        logger.info("🔍 Step 1: Generating search queries...")

        if event_callback:
            event_callback({"type": "step_started", "step": "search", "phase": "Search"})

        message = f"Generating search queries for: {query}"
        print(message)
        if progress_callback:
            progress_callback(message)

        search_queries = await self._generate_search_queries(query, llm)

        query_gen_time = time.time() - step_start
        step_times['query_generation'] = query_gen_time
        log_step("Query Generation", query_gen_time)

        # Emit query events
        for query_text in search_queries:
            if event_callback:
                event_callback({"type": "query_added", "query": query_text})

        message = f"Generated {len(search_queries)} search queries"
        print(message)
        if progress_callback:
            progress_callback(message)

        # Step 2: Execute searches
        search_step_start = time.time()
        logger.info(f"🌐 Step 2: Executing {len(search_queries)} searches...")

        all_results = []
        for i, search_query in enumerate(search_queries, 1):
            search_start = time.time()
            logger.info(f"  Searching {i}/{len(search_queries)}: '{search_query}'")

            message = f"Searching ({i}/{len(search_queries)}): {search_query[:60]}..."
            print(message)
            if progress_callback:
                progress_callback(message)

            try:
                results = await self._search(search_query)
                search_time = time.time() - search_start
                search_times.append({
                    "query": search_query,
                    "duration": round(search_time, 2),
                    "results_count": len(results)
                })
                logger.info(f"  ✓ Search {i} completed in {search_time:.2f}s, found {len(results)} results")

                # Emit source events
                for result in results:
                    if event_callback:
                        # Extract domain from URL
                        from urllib.parse import urlparse
                        domain = urlparse(result.get('url', '')).netloc if result.get('url') else 'unknown'

                        event_callback({
                            "type": "source_found",
                            "source": {
                                "title": result.get('title', 'Untitled'),
                                "url": result.get('url', ''),
                                "domain": domain,
                                "snippet": result.get('content', '')[:200]  # First 200 chars
                            }
                        })

                all_results.extend(results)
            except Exception as e:
                search_time = time.time() - search_start
                search_times.append({
                    "query": search_query,
                    "duration": round(search_time, 2),
                    "error": str(e)
                })
                logger.error(f"  ✗ Search {i} failed after {search_time:.2f}s: {e}")

        search_total_time = time.time() - search_step_start
        step_times['search_total'] = search_total_time
        step_times['search_individual'] = search_times
        log_step("Search Execution (Total)", search_total_time)

        message = f"Collected {len(all_results)} search results"
        print(message)
        if progress_callback:
            progress_callback(message)

        # Step 3: Synthesize findings (shows as "Synthesis" in UI)
        synth_start = time.time()
        logger.info(f"🧠 Step 3: Synthesizing {len(all_results)} findings...")

        if event_callback:
            event_callback({"type": "step_started", "step": "synthesis", "phase": "Synthesis"})

        message = "Synthesizing findings from search results..."
        print(message)
        if progress_callback:
            progress_callback(message)

        # Add timeout and heartbeat for synthesis
        try:
            # Create heartbeat task
            async def heartbeat():
                while True:
                    await asyncio.sleep(HEARTBEAT_INTERVAL)
                    if progress_callback:
                        progress_callback("Still synthesizing findings...")

            heartbeat_task = asyncio.create_task(heartbeat())

            # Run synthesis with timeout
            synthesized = await asyncio.wait_for(
                self._synthesize_findings(query, all_results, llm),
                timeout=SYNTHESIS_TIMEOUT
            )

            # Cancel heartbeat
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass

        except asyncio.TimeoutError:
            logger.error(f"Synthesis timed out after {SYNTHESIS_TIMEOUT}s")
            raise Exception(f"Synthesis took longer than {SYNTHESIS_TIMEOUT/60:.1f} minutes and was cancelled. Please try with a shorter query or fewer sources.")

        synth_time = time.time() - synth_start
        step_times['synthesis'] = synth_time
        log_step("Synthesis", synth_time)

        message = "Synthesis complete. Generating final report..."
        print(message)
        if progress_callback:
            progress_callback(message)

        # Step 4: Generate report (part of "Synthesis" phase in UI)
        report_start = time.time()
        logger.info("📝 Step 4: Generating final report...")

        # Note: Not emitting step_started here as report generation is part of synthesis phase in UI
        # if event_callback:
        #     event_callback({"type": "step_started", "step": "synthesis", "phase": "Synthesis"})

        # Add timeout and heartbeat for report generation
        try:
            # Create heartbeat task
            async def heartbeat_report():
                while True:
                    await asyncio.sleep(HEARTBEAT_INTERVAL)
                    if progress_callback:
                        progress_callback("Generating comprehensive report...")

            heartbeat_task = asyncio.create_task(heartbeat_report())

            # Run report generation with timeout and event callback for streaming
            report = await asyncio.wait_for(
                self._generate_report(query, synthesized, llm, event_callback),
                timeout=REPORT_GENERATION_TIMEOUT
            )

            # Cancel heartbeat
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass

        except asyncio.TimeoutError:
            logger.error(f"Report generation timed out after {REPORT_GENERATION_TIMEOUT}s")
            raise Exception(f"Report generation took longer than {REPORT_GENERATION_TIMEOUT/60:.1f} minutes and was cancelled. Please try again with a simpler query.")

        report_time = time.time() - report_start
        step_times['report_generation'] = report_time
        log_step("Report Generation", report_time)

        message = "Research completed!"
        print(message)
        if progress_callback:
            progress_callback(message)

        # Calculate total time and generate summary
        total_time = time.time() - start_time
        step_times['total'] = total_time

        # Log performance summary
        logger.info("=" * 60)
        logger.info("📊 PERFORMANCE SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Query Generation:     {step_times.get('query_generation', 0):.2f}s ({step_times.get('query_generation', 0)/total_time*100:.1f}%)")
        logger.info(f"Search Execution:     {step_times.get('search_total', 0):.2f}s ({step_times.get('search_total', 0)/total_time*100:.1f}%)")
        for i, search_info in enumerate(search_times, 1):
            logger.info(f"  - Search {i}: {search_info['duration']}s ({search_info.get('results_count', 0)} results)")
        logger.info(f"Synthesis:            {step_times.get('synthesis', 0):.2f}s ({step_times.get('synthesis', 0)/total_time*100:.1f}%)")
        logger.info(f"Report Generation:    {step_times.get('report_generation', 0):.2f}s ({step_times.get('report_generation', 0)/total_time*100:.1f}%)")
        logger.info("-" * 60)
        logger.info(f"TOTAL TIME:           {total_time:.2f}s")
        logger.info("=" * 60)

        # Identify bottlenecks
        bottlenecks = sorted(
            [(k, v) for k, v in step_times.items() if k not in ['total', 'search_individual', 'search_total']],
            key=lambda x: x[1] if isinstance(x[1], (int, float)) else 0,
            reverse=True
        )[:2]
        logger.info("🔴 Top Bottlenecks:")
        for step, duration in bottlenecks:
            if isinstance(duration, (int, float)):
                logger.info(f"  - {step}: {duration:.2f}s ({duration/total_time*100:.1f}%)")
        logger.info("=" * 60)

        return report
