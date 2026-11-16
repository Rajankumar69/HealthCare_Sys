using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GlobalSearchService.Services
{
    public interface IGroqLlmService
    {
        Task<string?> AskGroqAsync(string userQuestion, string systemContext);
    }

    public class GroqLlmService : IGroqLlmService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GroqLlmService> _logger;
        private readonly string _apiKey;
        private readonly string _primaryModel;
        private readonly string _endpoint;

        public GroqLlmService(HttpClient httpClient, IConfiguration configuration, ILogger<GroqLlmService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;

            _apiKey = _configuration["GroqSettings:ApiKey"] ?? string.Empty;
            _primaryModel = _configuration["GroqSettings:Model"] ?? "openai/gpt-oss-120b";
            _endpoint = _configuration["GroqSettings:Endpoint"] ?? "https://api.groq.com/openai/v1/chat/completions";
        }

        public async Task<string?> AskGroqAsync(string userQuestion, string systemContext)
        {
            if (string.IsNullOrWhiteSpace(_apiKey))
            {
                _logger.LogWarning("Groq API key is not configured.");
                return null;
            }

            string systemPrompt = $@"You are the hospital search coordinator. Answer directly, naturally, and helpfully.
Rules:
- Never sound like an AI: avoid robotic intros ('Certainly', 'As an AI'), disclosures, and emoji spam.
- Match user's language (English or Hinglish naturally).
- When asked for a list or names of patients or doctors, list EVERY record provided in the context completely without skipping or summarizing.
- For patients, include their ID and [View Medical Chart PDF](/api/healthcare/patients/{{id}}/pdf).
- If unrelated or not found, simply state no matching hospital records were found.

Live Hospital Records:
{systemContext}";

            var modelsToTry = new[] { _primaryModel, "openai/gpt-oss-20b", "qwen/qwen3.8-27b" };

            foreach (var model in modelsToTry)
            {
                try
                {
                    var requestPayload = new
                    {
                        model = model,
                        messages = new[]
                        {
                            new { role = "system", content = systemPrompt },
                            new { role = "user", content = userQuestion }
                        },
                        temperature = 0.2,
                        max_tokens = 1500
                    };

                    using var request = new HttpRequestMessage(HttpMethod.Post, _endpoint);
                    request.Headers.Add("Authorization", $"Bearer {_apiKey}");
                    string jsonBody = JsonSerializer.Serialize(requestPayload);
                    request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

                    var response = await _httpClient.SendAsync(request);
                    if (response.IsSuccessStatusCode)
                    {
                        string responseJson = await response.Content.ReadAsStringAsync();
                        using var doc = JsonDocument.Parse(responseJson);
                        var content = doc.RootElement
                                         .GetProperty("choices")[0]
                                         .GetProperty("message")
                                         .GetProperty("content")
                                         .GetString();

                        if (!string.IsNullOrWhiteSpace(content))
                        {
                            return content.Trim();
                        }
                    }
                    else
                    {
                        string err = await response.Content.ReadAsStringAsync();
                        _logger.LogWarning("Groq API error with model {Model}: {Error}", model, err);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Exception calling Groq API with model {Model}", model);
                }
            }

            return null;
        }
    }
}
