using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

#if NETSTANDARD2_0 || NET48
// Compatibility aliases for legacy .NET Framework 4.8 / .NET Standard
#endif

namespace StandaloneVectorSearchEngine
{
    // =========================================================================================
    // 1. DATA MODELS & DTOs
    // =========================================================================================

    public class ContextualChunk
    {
        public string ChunkId { get; set; } = string.Empty;
        public int ParentRecordId { get; set; }
        public string EntityType { get; set; } = "Record";
        public string Title { get; set; } = string.Empty;
        public string ContextHeader { get; set; } = string.Empty;
        public string RawChunkText { get; set; } = string.Empty;
        public string FullContextualText { get; set; } = string.Empty;
        public float[]? Vector { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class VectorSearchMatch
    {
        public int RecordId { get; set; }
        public float SimilarityScore { get; set; }
        public string MatchedSnippet { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
    }

    public class VectorSearchResponse
    {
        public string Query { get; set; } = string.Empty;
        public long ExecutionTimeMs { get; set; }
        public int TotalMatches { get; set; }
        public string SearchMethod { get; set; } = "VectorSemantic_Hybrid_kNN";
        public List<VectorSearchMatch> Matches { get; set; } = new List<VectorSearchMatch>();
    }

    public class VectorIndexStatus
    {
        public bool IsInitialized { get; set; }
        public int TotalIndexedChunks { get; set; }
        public int TotalIndexedRecords { get; set; }
        public DateTime? LastIndexedAt { get; set; }
        public string Provider { get; set; } = "In-Memory Dense Vector Engine (Zero External AI Dependency)";
        public string EmbeddingModel { get; set; } = "384-dim Normalized Semantic N-Gram Embeddings";
    }

    public class PatientRecordInput
    {
        public int PatientId { get; set; }
        public string Prefix { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public int Age { get; set; }
        public string Gender { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string AdharNumber { get; set; } = string.Empty;
        public string? Problem { get; set; }
        public string? AnyMedicalHistory { get; set; }
        public List<MedicalHistoryItem> MedicalHistory { get; set; } = new List<MedicalHistoryItem>();
        public List<VitalItem> Vitals { get; set; } = new List<VitalItem>();
    }

    public class MedicalHistoryItem
    {
        public string Condition { get; set; } = string.Empty;
        public DateTime? DiagnosisDate { get; set; }
        public string? Treatment { get; set; }
        public string? Notes { get; set; }
    }

    public class VitalItem
    {
        public DateTime RecordedDate { get; set; }
        public string? BloodPressure { get; set; }
        public int? HeartRate { get; set; }
        public decimal? Temperature { get; set; }
        public decimal? Weight { get; set; }
        public string? RecordedBy { get; set; }
    }

    // =========================================================================================
    // 2. CONTEXTUAL SEMANTIC CHUNKER
    // =========================================================================================

    public interface ISemanticChunker
    {
        List<ContextualChunk> ChunkPatient(PatientRecordInput patient);
        List<ContextualChunk> ChunkTextWithContext(int recordId, string entityType, string title, string bodyText, int maxWords = 200, int overlapWords = 35);
    }

    public class SemanticChunker : ISemanticChunker
    {
        private const int DefaultMaxWordsPerChunk = 200;
        private const int DefaultOverlapWords = 35;

        public List<ContextualChunk> ChunkPatient(PatientRecordInput patient)
        {
            var chunks = new List<ContextualChunk>();
            if (patient == null) return chunks;

            string fullName = $"{patient.Prefix} {patient.FirstName} {patient.LastName}".Trim();
            string contextHeader = $"[PATIENT: {fullName} | ID: {patient.PatientId} | Age: {patient.Age} | Phone: {patient.PhoneNumber} | Adhar: {patient.AdharNumber}]";

            // 1. Demographics & Chief Complaint Chunk
            var coreText = $"Patient Name: {fullName}. Age: {patient.Age}, Gender: {patient.Gender}. " +
                           $"Phone: {patient.PhoneNumber}, Email: {patient.Email}, Adhar: {patient.AdharNumber}. " +
                           $"Presenting Chief Complaint / Problem: {patient.Problem ?? "None reported"}. " +
                           $"General Medical History Notes: {patient.AnyMedicalHistory ?? "None recorded"}.";

            chunks.AddRange(ChunkTextWithContext(patient.PatientId, "Patient", fullName, coreText, DefaultMaxWordsPerChunk, DefaultOverlapWords));

            // 2. Recorded Conditions / Medical History Chunks
            if (patient.MedicalHistory != null && patient.MedicalHistory.Any())
            {
                var historyTexts = new List<string>();
                foreach (var h in patient.MedicalHistory)
                {
                    historyTexts.Add($"Condition: {h.Condition}. Diagnosed: {h.DiagnosisDate:yyyy-MM-dd}. Treatment: {h.Treatment}. Clinical Notes: {h.Notes}");
                }

                string combinedHistory = string.Join("; ", historyTexts);
                chunks.AddRange(ChunkTextWithContext(patient.PatientId, "MedicalHistory", $"{fullName} History", combinedHistory, DefaultMaxWordsPerChunk, DefaultOverlapWords));
            }

            // 3. Vitals Timeline Chunks
            if (patient.Vitals != null && patient.Vitals.Any())
            {
                var vitalsTexts = new List<string>();
                foreach (var v in patient.Vitals.OrderByDescending(x => x.RecordedDate).Take(15))
                {
                    vitalsTexts.Add($"Recorded: {v.RecordedDate:yyyy-MM-dd HH:mm}. BP: {v.BloodPressure}, HR: {v.HeartRate} bpm, Temp: {v.Temperature}°F, Weight: {v.Weight} kg. Recorded By: {v.RecordedBy}");
                }

                string combinedVitals = string.Join("; ", vitalsTexts);
                chunks.AddRange(ChunkTextWithContext(patient.PatientId, "Vitals", $"{fullName} Vitals", combinedVitals, DefaultMaxWordsPerChunk, DefaultOverlapWords));
            }

            return chunks;
        }

        public List<ContextualChunk> ChunkTextWithContext(
            int recordId,
            string entityType,
            string title,
            string bodyText,
            int maxWords = DefaultMaxWordsPerChunk,
            int overlapWords = DefaultOverlapWords)
        {
            var result = new List<ContextualChunk>();
            if (string.IsNullOrWhiteSpace(bodyText)) return result;

            string contextHeader = $"[{entityType.ToUpper()}: {title} | ID: {recordId}] -> ";
            var sentences = Regex.Split(bodyText, @"(?<=[.!?])\s+");

            var currentWords = new List<string>();
            int chunkIndex = 0;

            foreach (var sentence in sentences)
            {
                var words = sentence.Split(new[] { ' ', '\r', '\n', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                if (words.Length == 0) continue;

                if (currentWords.Count + words.Length > maxWords && currentWords.Count > 0)
                {
                    string rawText = string.Join(" ", currentWords);
                    result.Add(new ContextualChunk
                    {
                        ChunkId = $"{entityType.ToLower()}_{recordId}_chk_{chunkIndex++}",
                        ParentRecordId = recordId,
                        EntityType = entityType,
                        Title = title,
                        ContextHeader = contextHeader,
                        RawChunkText = rawText,
                        FullContextualText = contextHeader + rawText,
                        CreatedAt = DateTime.UtcNow
                    });

                    int overlap = Math.Min(overlapWords, currentWords.Count);
                    currentWords = currentWords.GetRange(currentWords.Count - overlap, overlap);
                }

                currentWords.AddRange(words);
            }

            if (currentWords.Count > 0)
            {
                string rawText = string.Join(" ", currentWords);
                result.Add(new ContextualChunk
                {
                    ChunkId = $"{entityType.ToLower()}_{recordId}_chk_{chunkIndex}",
                    ParentRecordId = recordId,
                    EntityType = entityType,
                    Title = title,
                    ContextHeader = contextHeader,
                    RawChunkText = rawText,
                    FullContextualText = contextHeader + rawText,
                    CreatedAt = DateTime.UtcNow
                });
            }

            return result;
        }
    }

    // =========================================================================================
    // 3. 384-DIMENSIONAL SEMANTIC VECTOR EMBEDDING ENGINE (ZERO-COST, IN-MEMORY)
    // =========================================================================================

    public interface IVectorEmbeddingService
    {
        float[] GenerateEmbedding(string text);
        float CalculateCosineSimilarity(float[] vectorA, float[] vectorB);
        int Dimensions { get; }
    }

    public class VectorEmbeddingService : IVectorEmbeddingService
    {
        public int Dimensions { get; } = 384;

        public float[] GenerateEmbedding(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return new float[Dimensions];

            return GenerateNormalizedSemanticVector(text, Dimensions);
        }

        public float CalculateCosineSimilarity(float[] vectorA, float[] vectorB)
        {
            if (vectorA == null || vectorB == null || vectorA.Length != vectorB.Length)
                return 0f;

            float dotProduct = 0f;
            float normA = 0f;
            float normB = 0f;

            for (int i = 0; i < vectorA.Length; i++)
            {
                dotProduct += vectorA[i] * vectorB[i];
                normA += vectorA[i] * vectorA[i];
                normB += vectorB[i] * vectorB[i];
            }

            if (normA <= 0f || normB <= 0f) return 0f;

            float similarity = dotProduct / (float)(Math.Sqrt(normA) * Math.Sqrt(normB));
            return (similarity + 1f) / 2f; // Normalized 0.0 to 1.0
        }

        private static float[] GenerateNormalizedSemanticVector(string text, int dimensions)
        {
            float[] vector = new float[dimensions];
            string clean = text.ToLowerInvariant().Trim();

            var words = clean.Split(new[] { ' ', ',', '.', ';', ':', '-', '!', '?' }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var word in words)
            {
                // Full word semantic hash
                AccumulateHash(word, vector, dimensions, 1.0f);

                // Character 3-grams for typo-tolerance and morphological roots
                if (word.Length >= 4)
                {
                    for (int i = 0; i <= word.Length - 3; i++)
                    {
                        string trigram = word.Substring(i, 3);
                        AccumulateHash(trigram, vector, dimensions, 0.45f);
                    }
                }
            }

            // L2-Normalize
            float sumSq = 0f;
            for (int i = 0; i < dimensions; i++)
            {
                sumSq += vector[i] * vector[i];
            }

            float magnitude = (float)Math.Sqrt(sumSq);
            if (magnitude > 1e-6f)
            {
                for (int i = 0; i < dimensions; i++)
                {
                    vector[i] /= magnitude;
                }
            }

            return vector;
        }

        private static void AccumulateHash(string token, float[] vector, int dimensions, float weight)
        {
            using (var sha = SHA256.Create())
            {
                byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(token));
                for (int i = 0; i < bytes.Length - 1; i += 2)
                {
                    int index = (bytes[i] | (bytes[i + 1] << 8)) % dimensions;
                    if (index < 0) index = -index;

                    float sign = (bytes[i] % 2 == 0) ? 1.0f : -1.0f;
                    vector[index] += sign * weight;
                }
            }
        }
    }

    // =========================================================================================
    // 4. STANDALONE VECTOR SEARCH ENGINE
    // =========================================================================================

    public class StandaloneVectorSearchEngine
    {
        private readonly ISemanticChunker _chunker;
        private readonly IVectorEmbeddingService _embeddingService;

        private readonly ConcurrentDictionary<string, ContextualChunk> _chunkIndex = new();
        private readonly ConcurrentDictionary<int, HashSet<string>> _recordChunkMap = new();
        private bool _isInitialized = false;
        private DateTime? _lastIndexedAt = null;

        public StandaloneVectorSearchEngine(ISemanticChunker? chunker = null, IVectorEmbeddingService? embeddingService = null)
        {
            _chunker = chunker ?? new SemanticChunker();
            _embeddingService = embeddingService ?? new VectorEmbeddingService();
        }

        public VectorIndexStatus GetStatus()
        {
            return new VectorIndexStatus
            {
                IsInitialized = _isInitialized,
                TotalIndexedChunks = _chunkIndex.Count,
                TotalIndexedRecords = _recordChunkMap.Count,
                LastIndexedAt = _lastIndexedAt
            };
        }

        public void IndexPatient(PatientRecordInput patient)
        {
            if (patient == null) return;

            var chunks = _chunker.ChunkPatient(patient);
            var chunkIds = new HashSet<string>();

            foreach (var chunk in chunks)
            {
                chunk.Vector = _embeddingService.GenerateEmbedding(chunk.FullContextualText);
                _chunkIndex[chunk.ChunkId] = chunk;
                chunkIds.Add(chunk.ChunkId);
            }

            if (_recordChunkMap.TryGetValue(patient.PatientId, out var existingChunkIds))
            {
                foreach (var oldId in existingChunkIds.Except(chunkIds))
                {
                    _chunkIndex.TryRemove(oldId, out _);
                }
            }

            _recordChunkMap[patient.PatientId] = chunkIds;
            _isInitialized = true;
            _lastIndexedAt = DateTime.UtcNow;
        }

        public void IndexCustomRecord(int recordId, string entityType, string title, string fullContent)
        {
            var chunks = _chunker.ChunkTextWithContext(recordId, entityType, title, fullContent);
            var chunkIds = new HashSet<string>();

            foreach (var chunk in chunks)
            {
                chunk.Vector = _embeddingService.GenerateEmbedding(chunk.FullContextualText);
                _chunkIndex[chunk.ChunkId] = chunk;
                chunkIds.Add(chunk.ChunkId);
            }

            if (_recordChunkMap.TryGetValue(recordId, out var existingChunkIds))
            {
                foreach (var oldId in existingChunkIds.Except(chunkIds))
                {
                    _chunkIndex.TryRemove(oldId, out _);
                }
            }

            _recordChunkMap[recordId] = chunkIds;
            _isInitialized = true;
            _lastIndexedAt = DateTime.UtcNow;
        }

        public void RemoveRecord(int recordId)
        {
            if (_recordChunkMap.TryRemove(recordId, out var chunkIds))
            {
                foreach (var id in chunkIds)
                {
                    _chunkIndex.TryRemove(id, out _);
                }
            }
        }

        public VectorSearchResponse Search(string query, int topK = 20, float minScore = 0.25f)
        {
            var sw = Stopwatch.StartNew();

            if (string.IsNullOrWhiteSpace(query))
            {
                return new VectorSearchResponse
                {
                    Query = query,
                    ExecutionTimeMs = 0,
                    TotalMatches = 0,
                    Matches = new List<VectorSearchMatch>()
                };
            }

            // 1. Generate query vector (< 1ms)
            float[] queryVector = _embeddingService.GenerateEmbedding(query);

            var queryTerms = query.ToLowerInvariant()
                .Split(new[] { ' ', ',', '-', '/', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(t => t.Length > 2)
                .ToList();

            // 2. High-speed parallel cosine similarity & lexical boost
            var candidateMatches = new ConcurrentBag<(ContextualChunk Chunk, float Score)>();

            Parallel.ForEach(_chunkIndex.Values, chunk =>
            {
                if (chunk.Vector == null) return;

                float cosineScore = _embeddingService.CalculateCosineSimilarity(queryVector, chunk.Vector);

                // Exact lexical boost for IDs, names, specific symptom words
                float lexicalBoost = 0f;
                string lowerFullText = chunk.FullContextualText.ToLowerInvariant();
                foreach (var term in queryTerms)
                {
                    if (lowerFullText.Contains(term))
                    {
                        lexicalBoost += 0.15f;
                    }
                }

                float finalScore = cosineScore + lexicalBoost;
                if (finalScore >= minScore)
                {
                    candidateMatches.Add((chunk, finalScore));
                }
            });

            // 3. Group by RecordId to return unique records with top matched snippet
            var topRecords = candidateMatches
                .GroupBy(m => m.Chunk.ParentRecordId)
                .Select(g =>
                {
                    var best = g.OrderByDescending(x => x.Score).First();
                    return new VectorSearchMatch
                    {
                        RecordId = best.Chunk.ParentRecordId,
                        SimilarityScore = (float)Math.Round(best.Score, 4),
                        MatchedSnippet = best.Chunk.RawChunkText,
                        EntityType = best.Chunk.EntityType,
                        Title = best.Chunk.Title
                    };
                })
                .OrderByDescending(p => p.SimilarityScore)
                .Take(topK)
                .ToList();

            sw.Stop();

            return new VectorSearchResponse
            {
                Query = query,
                ExecutionTimeMs = sw.ElapsedMilliseconds,
                TotalMatches = topRecords.Count,
                Matches = topRecords
            };
        }

        public List<int> SearchRecordIds(string query, int topK = 50)
        {
            var response = Search(query, topK);
            return response.Matches.Select(m => m.RecordId).ToList();
        }
    }
}
