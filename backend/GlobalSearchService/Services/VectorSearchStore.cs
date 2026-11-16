using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GlobalSearchService.Services
{
    public class VectorRecord
    {
        public int VectorId { get; set; }
        public string EntityType { get; set; } = string.Empty;
        public string EntityId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Intent { get; set; } = string.Empty;
        public string AnchorText { get; set; } = string.Empty;
        public int Dimensions { get; set; } = 512;
        public float[] Vector { get; set; } = Array.Empty<float>();
        public DateTime UpdatedAt { get; set; }
    }

    public class VectorSearchResult
    {
        public VectorRecord Record { get; set; } = new();
        public float SimilarityScore { get; set; }
    }

    public interface IVectorSearchStore
    {
        Task EnsureLoadedAsync();
        List<VectorSearchResult> Search(string query, int topK = 3, float minScore = 0.18f);
        List<VectorRecord> GetAll();
    }

    public class VectorSearchStore : IVectorSearchStore
    {
        private const string TableName = "GlobalSearchVectors_Raj";
        private readonly string _connectionString;
        private readonly ILogger<VectorSearchStore> _logger;
        private readonly List<VectorRecord> _vectors = new();
        private bool _isLoaded = false;
        private readonly object _lock = new();

        public VectorSearchStore(IConfiguration configuration, ILogger<VectorSearchStore> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
            _logger = logger;
        }

        public async Task EnsureLoadedAsync()
        {
            if (_isLoaded && _vectors.Count > 0) return;

            try
            {
                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();

                string sql = $@"
                    SELECT VectorId, EntityType, EntityId, Title, Intent, AnchorText, Dimensions, EmbeddingJson, UpdatedAt
                    FROM [{TableName}]";

                using var cmd = new SqlCommand(sql, conn);
                using var reader = await cmd.ExecuteReaderAsync();

                var loaded = new List<VectorRecord>();
                while (await reader.ReadAsync())
                {
                    try
                    {
                        string json = reader.GetString(7);
                        var vec = JsonSerializer.Deserialize<float[]>(json);
                        if (vec != null && vec.Length == 512)
                        {
                            loaded.Add(new VectorRecord
                            {
                                VectorId = reader.GetInt32(0),
                                EntityType = reader.GetString(1),
                                EntityId = reader.IsDBNull(2) ? "" : reader.GetString(2),
                                Title = reader.GetString(3),
                                Intent = reader.IsDBNull(4) ? "" : reader.GetString(4),
                                AnchorText = reader.GetString(5),
                                Dimensions = reader.GetInt32(6),
                                Vector = vec,
                                UpdatedAt = reader.GetDateTime(8)
                            });
                        }
                    }
                    catch { }
                }

                lock (_lock)
                {
                    _vectors.Clear();
                    _vectors.AddRange(loaded);
                    _isLoaded = true;
                }

                _logger.LogInformation("Successfully loaded {Count} vectors from {Table} into memory.", loaded.Count, TableName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load vectors from {Table}", TableName);
            }
        }

        private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
        {
            "what", "when", "where", "which", "who", "whom", "this", "that", "these", "those",
            "have", "has", "had", "does", "done", "will", "would", "shall", "should", "could",
            "tell", "give", "find", "show", "please", "with", "from", "about", "into"
        };

        public List<VectorSearchResult> Search(string query, int topK = 8, float minScore = 0.05f)
        {
            if (string.IsNullOrWhiteSpace(query) || _vectors.Count == 0) return new List<VectorSearchResult>();

            float[] queryVector = LocalVectorEmbedder.Embed(query);
            var results = new List<VectorSearchResult>();

            string lowerQ = query.ToLowerInvariant();
            var qTerms = Regex.Split(lowerQ, @"[^a-z0-9]+")
                              .Where(w => w.Length >= 3 && !StopWords.Contains(w))
                              .ToList();

            if (qTerms.Count == 0)
            {
                qTerms = Regex.Split(lowerQ, @"[^a-z0-9]+").Where(w => w.Length >= 3).ToList();
            }

            lock (_lock)
            {
                foreach (var rec in _vectors)
                {
                    float sim = LocalVectorEmbedder.CosineSimilarity(queryVector, rec.Vector);

                    string lowerTitle = rec.Title.ToLowerInvariant();
                    string lowerAnchor = rec.AnchorText.ToLowerInvariant();

                    // Boost if query mentions words or medical stems present in title / anchor text
                    // (e.g. "sarah" -> "Dr. Sarah", "cardiologist" -> "cardiology", "neurologist" -> "neurology")
                    foreach (var term in qTerms)
                    {
                        string stem = term.Length > 5 ? term.Substring(0, 5) : term;
                        if (lowerTitle.Contains(term) || lowerTitle.Contains(stem))
                        {
                            sim += 0.25f;
                        }
                        else if (lowerAnchor.Contains(term) || lowerAnchor.Contains(stem))
                        {
                            sim += 0.15f;
                        }
                    }

                    // Boost for ID matches (e.g. "11", "#11")
                    if (!string.IsNullOrEmpty(rec.EntityId) && lowerQ.Contains(rec.EntityId.ToLowerInvariant()))
                    {
                        sim += 0.30f;
                    }

                    if (sim >= minScore)
                    {
                        results.Add(new VectorSearchResult
                        {
                            Record = rec,
                            SimilarityScore = MathF.Round(sim, 4)
                        });
                    }
                }
            }

            return results.OrderByDescending(r => r.SimilarityScore).Take(topK).ToList();
        }

        public List<VectorRecord> GetAll()
        {
            lock (_lock)
            {
                return _vectors.ToList();
            }
        }
    }

    public static class LocalVectorEmbedder
    {
        public const int Dimensions = 512;

        public static float[] Embed(string text)
        {
            var vec = new float[Dimensions];
            if (string.IsNullOrWhiteSpace(text)) return vec;

            var tokens = Regex.Replace(text.ToLowerInvariant(), @"[^a-z0-9\s]", " ")
                              .Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);

            for (int i = 0; i < tokens.Length; i++)
            {
                ApplyFeature(vec, tokens[i], 1.0f);
                if (i + 1 < tokens.Length) ApplyFeature(vec, $"{tokens[i]}_{tokens[i + 1]}", 1.5f);

                if (tokens[i].Length >= 4)
                {
                    for (int j = 0; j <= tokens[i].Length - 3; j++)
                        ApplyFeature(vec, tokens[i].Substring(j, 3), 0.4f);
                }
            }

            float sumSq = vec.Sum(v => v * v);
            if (sumSq > 0f)
            {
                float norm = MathF.Sqrt(sumSq);
                for (int i = 0; i < Dimensions; i++) vec[i] /= norm;
            }
            return vec;
        }

        public static float CosineSimilarity(float[] a, float[] b)
        {
            if (a.Length != Dimensions || b.Length != Dimensions) return 0f;
            float dot = 0f;
            for (int i = 0; i < Dimensions; i++) dot += a[i] * b[i];
            return dot;
        }

        private static void ApplyFeature(float[] vec, string feature, float weight)
        {
            uint hash = 2166136261;
            foreach (char c in feature) { hash ^= c; hash *= 16777619; }
            int idx = (int)(hash % (uint)Dimensions);
            vec[idx] += ((hash >> 16) & 1) == 0 ? weight : -weight;
        }
    }
}
