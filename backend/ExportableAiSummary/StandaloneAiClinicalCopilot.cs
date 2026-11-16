using System;
using System.ClientModel;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using OpenAI;
using OpenAI.Chat;

namespace StandaloneAiClinicalCopilot
{
    // =========================================================================================
    // 1. INPUT MODELS
    // =========================================================================================

    public class PatientChartData
    {
        public int PatientId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public int Age { get; set; }
        public string Gender { get; set; } = string.Empty;
        public string? ChiefComplaint { get; set; }
        public string? PastMedicalHistoryNotes { get; set; }
        public List<ChartCondition> DiagnosedConditions { get; set; } = new();
        public List<ChartVital> VitalsTimeline { get; set; } = new();
    }

    public class ChartCondition
    {
        public string Condition { get; set; } = string.Empty;
        public DateTime? DiagnosisDate { get; set; }
        public string? Treatment { get; set; }
        public string? Notes { get; set; }
    }

    public class ChartVital
    {
        public DateTime RecordedDate { get; set; }
        public string? BloodPressure { get; set; }
        public int? HeartRate { get; set; }
        public decimal? Temperature { get; set; }
        public decimal? Weight { get; set; }
        public string? RecordedBy { get; set; }
    }

    // =========================================================================================
    // 2. STANDALONE CLINICAL COPILOT (GROQ LPU / OPENAI COMPATIBLE)
    // =========================================================================================

    public class StandaloneClinicalCopilot
    {
        private readonly ChatClient _chatClient;

        public StandaloneClinicalCopilot(
            string apiKey,
            string model = "openai/gpt-oss-120b",
            string baseUrl = "https://api.groq.com/openai/v1")
        {
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new ArgumentException("API key cannot be empty.", nameof(apiKey));
            }

            var clientOptions = new OpenAIClientOptions
            {
                Endpoint = new Uri(baseUrl)
            };

            var openAiClient = new OpenAIClient(new ApiKeyCredential(apiKey), clientOptions);
            _chatClient = openAiClient.GetChatClient(model);
        }

        public async IAsyncEnumerable<string> StreamPatientSummaryAsync(
            PatientChartData chart,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var context = new StringBuilder();
            context.AppendLine("PATIENT DEMOGRAPHICS & CHIEF COMPLAINT:");
            context.AppendLine($"- Name: {chart.FullName}, Age: {chart.Age}, Gender: {chart.Gender}");
            context.AppendLine($"- Presenting Problem / Chief Complaint: {chart.ChiefComplaint ?? "None reported"}");
            context.AppendLine($"- General Medical History: {chart.PastMedicalHistoryNotes ?? "None recorded"}");

            context.AppendLine("\nRECORDED CONDITIONS & MEDICAL HISTORIES:");
            if (chart.DiagnosedConditions.Count > 0)
            {
                foreach (var c in chart.DiagnosedConditions)
                {
                    context.AppendLine($"- Condition: {c.Condition} | Diagnosed: {c.DiagnosisDate:yyyy-MM-dd} | Treatment: {c.Treatment} | Notes: {c.Notes}");
                }
            }
            else
            {
                context.AppendLine("No recorded chronic conditions.");
            }

            context.AppendLine("\nRECENT VITALS TIMELINE:");
            if (chart.VitalsTimeline.Count > 0)
            {
                foreach (var v in chart.VitalsTimeline)
                {
                    context.AppendLine($"- Date: {v.RecordedDate:yyyy-MM-dd HH:mm} | BP: {v.BloodPressure} | HR: {v.HeartRate} bpm | Temp: {v.Temperature}°F | Wt: {v.Weight} kg | By: {v.RecordedBy}");
                }
            }
            else
            {
                context.AppendLine("No recent vitals recorded.");
            }

            var systemPrompt = @"You are an expert Clinical AI Copilot assisting a doctor.
Analyze the provided patient data and generate an ultra clean, user-friendly clinical summary.

Follow these strict section formatting rules:
1. Do NOT use unnecessary markdown symbols like '---', hashes '###', or excessive bullet clutter.
2. Structure the summary into these 5 distinct sections with clear bold titles:
   1. Patient Demographics & Current Chief Complaint (Only demographic data and the current presenting problem)
   2. Past Medical History (A completely separate section strictly detailing past diagnosed conditions, surgeries, chronic diseases, or recorded past medical notes. If none, state 'No past medical history recorded.')
   3. Active Treatments & Ongoing Medications (Documented treatments, dosages, or self-directed medications)
   4. Vitals Trend Analysis (Always present in a table: Parameter, Value, Normal Range, Status/Flag)
   5. Key Clinical Recommendations & Action Items (Always present in a table: Priority, Recommended Action, Clinical Rationale)
3. ALWAYS keep Medical History strictly isolated from the Current Chief Complaint.";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage($"Patient Chart Information:\n\n{context}\n\nPlease generate the comprehensive Clinical Summary.")
            };

            var updates = _chatClient.CompleteChatStreamingAsync(messages, cancellationToken: cancellationToken);

            await foreach (var update in updates)
            {
                foreach (var part in update.ContentUpdate)
                {
                    if (!string.IsNullOrEmpty(part.Text))
                    {
                        yield return part.Text;
                    }
                }
            }
        }
    }
}
