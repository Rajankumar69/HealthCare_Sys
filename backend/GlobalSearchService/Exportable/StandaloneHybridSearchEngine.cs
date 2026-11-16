using System;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;

namespace ReusableVectorSearchEngine
{
    // =========================================================================================
    // 1. DATA MODELS
    // =========================================================================================

    public class SearchHitRecord
    {
        public string RecordId { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Snippet { get; set; } = string.Empty;
        public string? DocumentUrl { get; set; }
        public float RelevanceScore { get; set; }
        public string Source { get; set; } = "VectorCosineSimilarity";
    }

    public class SearchResponseModel
    {
        public string Query { get; set; } = string.Empty;
        public int TotalHits { get; set; }
        public long ExecutionTimeMs { get; set; }
        public List<SearchHitRecord> Results { get; set; } = new();
    }

    public class AskResponseModel
    {
        public string Query { get; set; } = string.Empty;
        public string Category { get; set; } = "General";
        public string Answer { get; set; } = string.Empty;
        public long ExecutionTimeMs { get; set; }
        public List<object> Data { get; set; } = new();
    }

    public class DocumentIndexData
    {
        public string RecordId { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string FullContent { get; set; } = string.Empty;
        public string? DocumentUrl { get; set; }
    }

    public class CachedVector
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public float[] Vector { get; set; } = Array.Empty<float>();
    }

    // =========================================================================================
    // 2. VECTOR EMBEDDING HELPER (Subword N-Gram Semantic Vectorizer)
    // =========================================================================================

    public static class FastTextEmbedder
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

            // Normalize vector to unit length (L2 norm)
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

    // =========================================================================================
    // 3. SQL VECTOR STORAGE (Persists Embeddings in SQL Server)
    // =========================================================================

    public class SqlVectorStore
    {
        private readonly string _connectionString;
        private readonly string _tableName;

        public SqlVectorStore(string connectionString, string tableName = "GlobalSearchVectors_Raj")
        {
            _connectionString = connectionString;
            _tableName = tableName;
        }

        public async Task EnsureTableAsync()
        {
            using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            string ddl = $@"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '{_tableName}')
                CREATE TABLE [{_tableName}] (
                    VectorId INT IDENTITY(1,1) PRIMARY KEY,
                    EntityType NVARCHAR(50) NOT NULL,
                    EntityId NVARCHAR(50) NULL,
                    Title NVARCHAR(200) NOT NULL,
                    Intent NVARCHAR(100) NULL,
                    AnchorText NVARCHAR(500) NOT NULL,
                    Dimensions INT NOT NULL DEFAULT 512,
                    SampleEmbedding NVARCHAR(200) NULL,
                    EmbeddingJson NVARCHAR(MAX) NOT NULL,
                    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
                );";
            using var cmd = new SqlCommand(ddl, conn);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task SaveVectorAsync(string type, string id, string title, string text, float[] vector)
        {
            using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            string json = JsonSerializer.Serialize(vector);
            string sample = string.Join(" | ", vector.Take(6).Select(v => MathF.Round(v, 4).ToString()));

            string sql = $@"
                IF EXISTS (SELECT 1 FROM [{_tableName}] WHERE EntityType = @Type AND EntityId = @Id)
                    UPDATE [{_tableName}] SET Title=@Title, AnchorText=@Text, SampleEmbedding=@Sample, EmbeddingJson=@Json, UpdatedAt=SYSUTCDATETIME() WHERE EntityType=@Type AND EntityId=@Id
                ELSE
                    INSERT INTO [{_tableName}] (EntityType, EntityId, Title, Intent, AnchorText, Dimensions, SampleEmbedding, EmbeddingJson, CreatedAt, UpdatedAt)
                    VALUES (@Type, @Id, @Title, 'VectorRecord', @Text, 512, @Sample, @Json, SYSUTCDATETIME(), SYSUTCDATETIME());";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Type", type);
            cmd.Parameters.AddWithValue("@Id", id);
            cmd.Parameters.AddWithValue("@Title", title);
            cmd.Parameters.AddWithValue("@Text", text.Length > 450 ? text.Substring(0, 450) + "..." : text);
            cmd.Parameters.AddWithValue("@Sample", sample);
            cmd.Parameters.AddWithValue("@Json", json);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task<List<CachedVector>> LoadAllAsync()
        {
            var list = new List<CachedVector>();
            using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            using var cmd = new SqlCommand($"SELECT EntityId, EntityType, Title, AnchorText, EmbeddingJson FROM [{_tableName}]", conn);
            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                try
                {
                    var vec = JsonSerializer.Deserialize<float[]>(reader.GetString(4));
                    if (vec?.Length == FastTextEmbedder.Dimensions)
                    {
                        list.Add(new CachedVector
                        {
                            Id = reader.IsDBNull(0) ? "" : reader.GetString(0),
                            Type = reader.GetString(1),
                            Title = reader.GetString(2),
                            Text = reader.GetString(3),
                            Vector = vec
                        });
                    }
                }
                catch { }
            }
            return list;
        }
    }

    // =========================================================================================
    // 4. STANDALONE PURE VECTOR SEARCH ENGINE (100% C# & SQL - ZERO LUCENE DEPENDENCY)
    // =========================================================================================

    public class StandaloneHybridSearchEngine
    {
        private readonly string _connectionString;
        private readonly SqlVectorStore _vectorStore;
        private readonly List<CachedVector> _vectors = new();

        public StandaloneHybridSearchEngine(
            string connectionString,
            string vectorTableName = "GlobalSearchVectors_Raj")
        {
            _connectionString = connectionString;
            _vectorStore = new SqlVectorStore(connectionString, vectorTableName);
        }

        public async Task InitializeAsync()
        {
            await _vectorStore.EnsureTableAsync();
            var loaded = await _vectorStore.LoadAllAsync();
            lock (_vectors)
            {
                _vectors.Clear();
                _vectors.AddRange(loaded);
            }
        }

        public async Task UpsertVectorAsync(string type, string id, string title, string text)
        {
            var vec = FastTextEmbedder.Embed(text);
            await _vectorStore.SaveVectorAsync(type, id, title, text, vec);
            lock (_vectors)
            {
                _vectors.RemoveAll(v => v.Type == type && v.Id == id);
                _vectors.Add(new CachedVector { Type = type, Id = id, Title = title, Text = text, Vector = vec });
            }
        }

        public SearchResponseModel Search(string query, int page = 1, int pageSize = 20, float minScore = 0.15f)
        {
            var sw = Stopwatch.StartNew();

            if (string.IsNullOrWhiteSpace(query))
            {
                sw.Stop();
                return new SearchResponseModel { Query = query, TotalHits = 0, ExecutionTimeMs = sw.ElapsedMilliseconds };
            }

            float[] qVec = FastTextEmbedder.Embed(query);
            string qLower = query.ToLowerInvariant();
            var matches = new List<(CachedVector V, float Score)>();

            lock (_vectors)
            {
                foreach (var v in _vectors)
                {
                    float sim = FastTextEmbedder.CosineSimilarity(qVec, v.Vector);
                    if (v.Title.ToLowerInvariant().Contains(qLower) || (!string.IsNullOrEmpty(v.Id) && qLower.Contains(v.Id.ToLowerInvariant())))
                    {
                        sim += 0.20f;
                    }

                    if (sim >= minScore)
                    {
                        matches.Add((v, sim));
                    }
                }
            }

            var ordered = matches.OrderByDescending(m => m.Score).ToList();
            var paged = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList();

            var results = paged.Select(m => new SearchHitRecord
            {
                RecordId = m.V.Id,
                EntityType = m.V.Type,
                Title = m.V.Title,
                Snippet = m.V.Text,
                RelevanceScore = MathF.Round(m.Score, 4)
            }).ToList();

            sw.Stop();
            return new SearchResponseModel
            {
                Query = query,
                TotalHits = ordered.Count,
                ExecutionTimeMs = sw.ElapsedMilliseconds,
                Results = results
            };
        }

        public AskResponseModel AskQuestion(string question)
        {
            var sw = Stopwatch.StartNew();
            var search = Search(question, page: 1, pageSize: 3, minScore: 0.18f);

            if (search.TotalHits == 0)
            {
                sw.Stop();
                return new AskResponseModel
                {
                    Query = question,
                    Category = "NoRecordsFound",
                    Answer = $"I couldn't find any matching hospital records or features for \"{question}\". Please search by patient name, ID, or clinical condition.",
                    ExecutionTimeMs = sw.ElapsedMilliseconds
                };
            }

            var sb = new System.Text.StringBuilder();
            sb.AppendLine($"Here are the matching records for **\"{question}\"**:\n");
            foreach (var h in search.Results)
            {
                sb.AppendLine($"• **{h.Title}** (ID: #{h.RecordId})");
                sb.AppendLine($"  {h.Snippet}\n");
            }

            sw.Stop();
            return new AskResponseModel
            {
                Query = question,
                Category = "VectorMatchFound",
                Answer = sb.ToString().TrimEnd(),
                ExecutionTimeMs = sw.ElapsedMilliseconds
            };
        }
    }
}
