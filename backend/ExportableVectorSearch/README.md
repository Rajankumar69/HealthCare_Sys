# Standalone Semantic Vector Search Engine (.NET)

A **100% self-contained, single-file** Semantic Vector Search Engine for .NET applications (supports .NET Framework 4.8, .NET 6, .NET 8, and .NET 9).

---

## 🚀 Key Highlights

1. **Single File Drop-In**: Everything (Models, Semantic Chunker, 384-dimensional Embeddings, Vector Index, and kNN Search) is in **`StandaloneVectorSearchEngine.cs`**.
2. **Zero Third-Party AI Dependencies**: No external API keys (no OpenAI, no Groq required for embeddings), 100% free of cost, and works offline in-memory.
3. **Contextual Semantic Chunking**: Automatically builds contextual headers with sliding overlap windows for documents, patient charts, and medical histories.
4. **Hybrid Search**: Combines Cosine Similarity (384-dimensional normalized n-gram hashing) with lexical keyword boosting for millisecond response times.

---

## 📁 Installation

Just copy `StandaloneVectorSearchEngine.cs` into your project. **No external NuGet packages required!** Standard .NET libraries are sufficient.

---

## 💻 How to Use in C#

### 1. In-Memory or Service Registration
```csharp
using StandaloneVectorSearchEngine;

// Option A: Direct instance
var searchEngine = new StandaloneVectorSearchEngine.StandaloneVectorSearchEngine();

// Option B: Dependency Injection in ASP.NET Core Program.cs
builder.Services.AddSingleton<StandaloneVectorSearchEngine.StandaloneVectorSearchEngine>();
```

### 2. Indexing Records
```csharp
// Indexing Patient / Medical Record
searchEngine.IndexPatient(new PatientRecordInput
{
    PatientId = 11,
    Prefix = "Mr.",
    FirstName = "Raj",
    LastName = "Kushwaha",
    Age = 35,
    Gender = "Male",
    PhoneNumber = "9876543210",
    Email = "raj@example.com",
    Problem = "Chest pain and difficulty breathing during exertion",
    MedicalHistory = new List<MedicalHistoryItem>
    {
        new MedicalHistoryItem { Condition = "Hypertension", Treatment = "Amlodipine 5mg", Notes = "Follow up every 3 months" }
    },
    Vitals = new List<VitalItem>
    {
        new VitalItem { BloodPressure = "140/90", HeartRate = 88, Temperature = 98.6m, RecordedDate = DateTime.Now }
    }
});

// Or Indexing Any Generic Custom Document:
searchEngine.IndexCustomRecord(
    recordId: 101,
    entityType: "Document",
    title: "Discharge Summary Guidelines",
    fullContent: "Standard operating procedure for patient discharge and follow-up consultation..."
);
```

### 3. Searching in Milliseconds
```csharp
// Semantic search for symptoms or conditions
var response = searchEngine.Search("chest pain high bp", topK: 10);

Console.WriteLine($"Search Query: {response.Query}");
Console.WriteLine($"Execution Time: {response.ExecutionTimeMs} ms");
Console.WriteLine($"Total Matches: {response.TotalMatches}");

foreach (var match in response.Matches)
{
    Console.WriteLine($"[ID: {match.RecordId}] {match.Title} - Score: {match.SimilarityScore}");
    Console.WriteLine($"Snippet: {match.MatchedSnippet}");
}

// Or get matched Record IDs directly for SQL queries:
List<int> matchedIds = searchEngine.SearchRecordIds("hypertension");
```
