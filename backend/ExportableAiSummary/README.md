# Standalone Clinical AI Copilot & Summary Engine (.NET)

A **100% self-contained, single-file** Clinical AI Copilot for streaming patient briefings and medical summaries via Groq LPU (`openai/gpt-oss-120b`).

---

## ⚙️ Nuget Packages Required

```bash
dotnet add package OpenAI --version 2.1.0
```

---

## 🚀 How to Use

```csharp
using StandaloneAiClinicalCopilot;

var copilot = new StandaloneClinicalCopilot(
    apiKey: "YOUR_GROQ_API_KEY",
    model: "openai/gpt-oss-120b"
);

var chart = new PatientChartData
{
    PatientId = 11,
    FullName = "Mr. Raj Kushwaha",
    Age = 35,
    Gender = "Male",
    ChiefComplaint = "Chest pain and breathlessness upon walking",
    PastMedicalHistoryNotes = "History of mild asthma",
    DiagnosedConditions = new List<ChartCondition>
    {
        new ChartCondition { Condition = "Asthma", Treatment = "Inhaler PRN" }
    },
    VitalsTimeline = new List<ChartVital>
    {
        new ChartVital { BloodPressure = "145/95", HeartRate = 92, Temperature = 98.4m, RecordedDate = DateTime.Now }
    }
};

// Stream tokens directly in console or SSE endpoint
await foreach (var token in copilot.StreamPatientSummaryAsync(chart))
{
    Console.Write(token);
}
```
