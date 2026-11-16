using HealthcareService.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HealthcareService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AiController : ControllerBase
    {
        private readonly IAiService _aiService;
        private readonly ILogger<AiController> _logger;

        public AiController(IAiService aiService, ILogger<AiController> logger)
        {
            _aiService = aiService;
            _logger = logger;
        }

        /// <summary>
        /// Stream a structured clinical summary for a patient (SSE - Server-Sent Events)
        /// </summary>
        [HttpGet("patient-summary/{patientId}/stream")]
        public async Task StreamPatientSummary(int patientId, CancellationToken cancellationToken)
        {
            Response.Headers.Append("Content-Type", "text/event-stream");
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");
            Response.Headers.Append("X-Accel-Buffering", "no");

            try
            {
                await foreach (var token in _aiService.StreamPatientSummaryAsync(patientId, cancellationToken))
                {
                    // Format as SSE data line
                    var data = System.Text.Json.JsonSerializer.Serialize(new { chunk = token });
                    await Response.WriteAsync($"data: {data}\n\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }

                await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Streaming cancelled by client for patient {PatientId}", patientId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while streaming summary for patient {PatientId}", patientId);
                var err = System.Text.Json.JsonSerializer.Serialize(new { error = ex.Message });
                await Response.WriteAsync($"data: {err}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
        }

        public class AiChatRequest
        {
            public int PatientId { get; set; }
            public string Question { get; set; } = string.Empty;
        }

        /// <summary>
        /// Stream Q&A response for a patient
        /// </summary>
        [HttpPost("patient-chat/stream")]
        public async Task StreamPatientChat([FromBody] AiChatRequest request, CancellationToken cancellationToken)
        {
            Response.Headers.Append("Content-Type", "text/event-stream");
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");
            Response.Headers.Append("X-Accel-Buffering", "no");

            try
            {
                await foreach (var token in _aiService.StreamPatientChatAsync(request.PatientId, request.Question, cancellationToken))
                {
                    var data = System.Text.Json.JsonSerializer.Serialize(new { chunk = token });
                    await Response.WriteAsync($"data: {data}\n\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }

                await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Chat stream cancelled by client for patient {PatientId}", request.PatientId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while streaming chat for patient {PatientId}", request.PatientId);
                var err = System.Text.Json.JsonSerializer.Serialize(new { error = ex.Message });
                await Response.WriteAsync($"data: {err}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
        }

        /// <summary>
        /// Stream a live shift summary for nurses showing Work Done and Pending Work
        /// </summary>
        [HttpGet("nurse/shift-summary/stream")]
        public async Task StreamNurseShiftSummary(CancellationToken cancellationToken)
        {
            Response.Headers.Append("Content-Type", "text/event-stream");
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");
            Response.Headers.Append("X-Accel-Buffering", "no");

            try
            {
                await foreach (var token in _aiService.StreamNurseShiftSummaryAsync(cancellationToken))
                {
                    var data = System.Text.Json.JsonSerializer.Serialize(new { chunk = token });
                    await Response.WriteAsync($"data: {data}\n\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }

                await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Nurse shift stream cancelled by client");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while streaming nurse shift summary");
                var err = System.Text.Json.JsonSerializer.Serialize(new { error = ex.Message });
                await Response.WriteAsync($"data: {err}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
        }
    }
}
