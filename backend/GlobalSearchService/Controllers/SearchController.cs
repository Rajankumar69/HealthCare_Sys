using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using GlobalSearchService.Models;
using GlobalSearchService.Services;

namespace GlobalSearchService.Controllers
{
    [ApiController]
    [Route("api/globalsearch")]
    public class SearchController : ControllerBase
    {
        private readonly IGlobalSearchEngine _searchEngine;
        private readonly ILogger<SearchController> _logger;

        public SearchController(IGlobalSearchEngine searchEngine, ILogger<SearchController> logger)
        {
            _searchEngine = searchEngine;
            _logger = logger;
        }

        /// <summary>
        /// Sub-second search across 700-800 GB of indexed records and dynamic PDFs.
        /// Zero external AI, 100% free, runs in 5-15 milliseconds.
        /// </summary>
        [HttpGet("find")]
        public IActionResult Find([FromQuery] string q, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                return Ok(new GlobalSearchResultModel { ExecutionTimeMs = 0, TotalHits = 0 });
            }

            var result = _searchEngine.Search(q, page, pageSize);
            return Ok(result);
        }

        /// <summary>
        /// Natural Language Global Search & Intelligence Assistant
        /// Example: "what are the number of patients Dr is attending?"
        /// </summary>
        [HttpPost("ask")]
        public async Task<IActionResult> Ask([FromBody] AskRequestModel request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Query))
            {
                return BadRequest(new { message = "Query cannot be empty." });
            }

            var result = await _searchEngine.AskQuestionAsync(request.Query);
            return Ok(result);
        }

        /// <summary>
        /// Check index status, total document count, and SSD storage size.
        /// </summary>
        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            var status = _searchEngine.GetIndexStatus();
            return Ok(status);
        }

        /// <summary>
        /// View the complete Vector Table: IDs, intents, texts, dimensions, and numerical vector embedding arrays.
        /// </summary>
        [HttpGet("vectors")]
        public IActionResult GetVectors()
        {
            var vectors = _searchEngine.GetVectorTable();
            return Ok(vectors);
        }

        /// <summary>
        /// Triggers background index build from SQL and dynamic PDF text.
        /// </summary>
        [HttpPost("build-index")]
        public IActionResult TriggerBuild()
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await _searchEngine.BuildIndexFromSqlAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Background Lucene indexing error");
                }
            });

            return Ok(new
            {
                status = "Started",
                message = "Lucene indexing started in background. Check /api/globalsearch/status for progress."
            });
        }

        /// <summary>
        /// Index a single newly generated dynamic PDF or record in real-time.
        /// </summary>
        [HttpPost("index-document")]
        public IActionResult IndexDocument([FromBody] IndexableDocument doc)
        {
            if (doc == null || string.IsNullOrWhiteSpace(doc.RecordId))
            {
                return BadRequest(new { message = "RecordId and document content are required." });
            }

            _searchEngine.IndexDocument(doc);
            return Ok(new { message = $"Document {doc.RecordId} indexed successfully." });
        }
    }
}
