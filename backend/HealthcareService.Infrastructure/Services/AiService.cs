using System.ClientModel;
using System.Runtime.CompilerServices;
using System.Text;
using HealthcareService.Core.Interfaces;
using HealthcareService.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI;
using OpenAI.Chat;

namespace HealthcareService.Infrastructure.Services
{
    public class AiService : IAiService
    {
        private readonly IPatientRepository _patientRepository;
        private readonly IAppointmentRepository _appointmentRepository;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AiService> _logger;
        private readonly ChatClient _chatClient;

        public AiService(
            IPatientRepository patientRepository,
            IAppointmentRepository appointmentRepository,
            IConfiguration configuration,
            ILogger<AiService> logger)
        {
            _patientRepository = patientRepository;
            _appointmentRepository = appointmentRepository;
            _configuration = configuration;
            _logger = logger;

            string apiKey = _configuration["Groq:ApiKey"]
                ?? _configuration["GroqSettings:ApiKey"]
                ?? string.Empty;
            string model = _configuration["Groq:Model"]
                ?? _configuration["GroqSettings:Model"]
                ?? "openai/gpt-oss-120b";
            string baseUrl = _configuration["Groq:BaseUrl"]
                ?? "https://api.groq.com/openai/v1";

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("Groq API key is not configured in Groq:ApiKey or GroqSettings:ApiKey.");
            }

            var clientOptions = new OpenAIClientOptions
            {
                Endpoint = new Uri(baseUrl)
            };

            var openAiClient = new OpenAIClient(new ApiKeyCredential(apiKey), clientOptions);
            _chatClient = openAiClient.GetChatClient(model);
        }

        public async IAsyncEnumerable<string> StreamPatientSummaryAsync(
            int patientId,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var patientData = await _patientRepository.GetPatientFullDetailsUsingSpAsync(patientId);
            if (patientData == null || patientData.PatientDetails == null)
            {
                yield return "Patient records not found.";
                yield break;
            }

            var contextBuilder = new StringBuilder();
            var p = patientData.PatientDetails;
            contextBuilder.AppendLine("PATIENT DEMOGRAPHICS:");
            contextBuilder.AppendLine($"- Name: {p.Prefix} {p.FirstName} {p.LastName}");
            contextBuilder.AppendLine($"- Age: {p.Age}, Gender: {p.Gender}");
            contextBuilder.AppendLine($"- Presenting Problem: {p.Problem ?? "None reported"}");
            contextBuilder.AppendLine($"- Past Medical History Notes: {p.AnyMedicalHistory ?? "None recorded"}");

            contextBuilder.AppendLine("\nRECORDED CONDITIONS & MEDICAL HISTORIES:");
            if (patientData.PatientMedicalHistory != null && patientData.PatientMedicalHistory.Any())
            {
                foreach (var h in patientData.PatientMedicalHistory)
                {
                    contextBuilder.AppendLine($"- Condition: {h.Condition} | Diagnosed: {h.DiagnosisDate:yyyy-MM-dd} | Treatment: {h.Treatment} | Notes: {h.Notes}");
                }
            }
            else
            {
                contextBuilder.AppendLine("No recorded conditions.");
            }

            contextBuilder.AppendLine("\nRECENT VITALS TIMELINE:");
            if (patientData.PatientVitals != null && patientData.PatientVitals.Any())
            {
                foreach (var v in patientData.PatientVitals.OrderByDescending(x => x.RecordedDate).Take(10))
                {
                    contextBuilder.AppendLine($"- Date: {v.RecordedDate:yyyy-MM-dd HH:mm} | BP: {v.BloodPressure} | Heart Rate: {v.HeartRate} bpm | Temp: {v.Temperature}°F | Weight: {v.Weight} kg | Recorded By: {v.RecordedBy}");
                }
            }
            else
            {
                contextBuilder.AppendLine("No vitals recorded yet.");
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
3. ALWAYS keep Medical History strictly isolated from the Current Chief Complaint.
4. Keep the language direct, clear, professional, and easy to skim in 30 seconds.
5. Base all observations strictly on the patient dossier provided. Do not invent or assume undocumented conditions.";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage($"Here is the patient medical dossier:\n\n{contextBuilder}\n\nPlease generate the clinical briefing summary.")
            };

            AsyncCollectionResult<StreamingChatCompletionUpdate>? updates = null;
            string? initError = null;

            try
            {
                updates = _chatClient.CompleteChatStreamingAsync(messages, cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initiating streaming completion with Groq AI.");
                initError = $"AI Service Error: {ex.Message}";
            }

            if (initError != null)
            {
                yield return initError;
                yield break;
            }

            if (updates != null)
            {
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

        public async IAsyncEnumerable<string> StreamPatientChatAsync(
            int patientId,
            string userQuestion,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var patientData = await _patientRepository.GetPatientFullDetailsUsingSpAsync(patientId);
            if (patientData == null || patientData.PatientDetails == null)
            {
                yield return "Unable to retrieve patient data for context.";
                yield break;
            }

            var p = patientData.PatientDetails;
            var contextBuilder = new StringBuilder();
            contextBuilder.AppendLine($"PATIENT: {p.Prefix} {p.FirstName} {p.LastName}, Age: {p.Age}, Gender: {p.Gender}");
            contextBuilder.AppendLine($"PROBLEM: {p.Problem}");
            contextBuilder.AppendLine($"HISTORY: {p.AnyMedicalHistory}");

            if (patientData.PatientMedicalHistory?.Any() == true)
            {
                contextBuilder.AppendLine("CONDITIONS: " + string.Join("; ", patientData.PatientMedicalHistory.Select(h => $"{h.Condition} (Tx: {h.Treatment})")));
            }

            if (patientData.PatientVitals?.Any() == true)
            {
                var latest = patientData.PatientVitals.OrderByDescending(v => v.RecordedDate).First();
                contextBuilder.AppendLine($"LATEST VITALS ({latest.RecordedDate:yyyy-MM-dd}): BP {latest.BloodPressure}, HR {latest.HeartRate} bpm, Temp {latest.Temperature}°F, Wt {latest.Weight}kg");
            }

            var systemPrompt = $@"You are a helpful Healthcare AI Assistant. Answer questions strictly based on the following patient context:
---
{contextBuilder}
---
If the answer cannot be determined from the patient records, politely state that the information is not recorded in the patient chart. Do not speculate or invent medical details.";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userQuestion)
            };

            AsyncCollectionResult<StreamingChatCompletionUpdate>? updates = null;
            string? initError = null;

            try
            {
                updates = _chatClient.CompleteChatStreamingAsync(messages, cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in StreamPatientChatAsync");
                initError = $"AI Service Error: {ex.Message}";
            }

            if (initError != null)
            {
                yield return initError;
                yield break;
            }

            if (updates != null)
            {
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

        public async IAsyncEnumerable<string> StreamNurseShiftSummaryAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var requestedAppts = await _appointmentRepository.GetAppointmentsAsync(null, null, "Requested");
            var approvedAppts = await _appointmentRepository.GetAppointmentsAsync(null, null, "NurseApproved");
            var confirmedAppts = await _appointmentRepository.GetAppointmentsAsync(null, null, "DoctorConfirmed");
            var rescheduledAppts = await _appointmentRepository.GetAppointmentsAsync(null, null, "Rescheduled");

            var builder = new StringBuilder();
            builder.AppendLine("HOSPITAL WORK QUEUE METRICS:");
            builder.AppendLine($"- Pending Initial Nurse Review (Requested): {requestedAppts?.Count ?? 0}");
            builder.AppendLine($"- Forwarded to Doctors (Nurse Approved): {approvedAppts?.Count ?? 0}");
            builder.AppendLine($"- Confirmed / In-Progress Visits: {confirmedAppts?.Count ?? 0}");
            builder.AppendLine($"- Rescheduled / Shift Adjustments: {rescheduledAppts?.Count ?? 0}");

            builder.AppendLine("\nRECENT PENDING REQUESTS DETAILS:");
            if (requestedAppts != null && requestedAppts.Any())
            {
                foreach (var a in requestedAppts.Take(8))
                {
                    builder.AppendLine($"- Patient ID {a.PatientId} | Date: {a.AppointmentDate:yyyy-MM-dd} {a.AppointmentTime} | Reason: {a.Reason ?? "Not stated"}");
                }
            }
            else
            {
                builder.AppendLine("No pending incoming requests.");
            }

            builder.AppendLine("\nRECENT COMPLETED / NURSE FORWARDED WORK:");
            if (approvedAppts != null && approvedAppts.Any())
            {
                foreach (var a in approvedAppts.Take(8))
                {
                    builder.AppendLine($"- Patient ID {a.PatientId} | Approved For Doctor ID: {a.DoctorId} | Notes: {a.Notes ?? "Standard approval"}");
                }
            }

            var systemPrompt = @"You are an intelligent Nurse Station Shift Copilot.
Analyze the hospital ward appointments and triage queues, then generate a crystal-clear, structured shift report.

Follow these strict section formatting rules:
1. Do NOT use unnecessary markdown symbols like '---', hashes '###', or excessive bullet clutter.
2. Structure the summary into these 4 distinct bold sections:
   1. Shift Overview & Current Workload Status
   2. Work Done (Completed Triage & Forwarded to Doctors)
      Present in a structured table: Patient ID, Doctor Assigned, Appointment Slot, Nurse Action Taken
   3. Pending Work & Action Items Needing Immediate Attention
      Present in a structured table: Priority, Patient / Queue, Reason / Symptoms, Required Nursing Action
   4. Triage & Safety Alerts for Incoming Shift
3. Keep it crisp, factual, highly legible for a nursing handover in 30 seconds.";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage($"Here is the live nursing shift queue data:\n\n{builder}\n\nPlease generate the Nurse Shift Work Done & Pending Report.")
            };

            AsyncCollectionResult<StreamingChatCompletionUpdate>? updates = null;
            string? initError = null;

            try
            {
                updates = _chatClient.CompleteChatStreamingAsync(messages, cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in StreamNurseShiftSummaryAsync");
                initError = $"AI Service Error: {ex.Message}";
            }

            if (initError != null)
            {
                yield return initError;
                yield break;
            }

            if (updates != null)
            {
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
}
