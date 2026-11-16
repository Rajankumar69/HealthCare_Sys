using System.Collections.Generic;

namespace GlobalSearchService.Models
{
    public class GlobalSearchResultModel
    {
        public long ExecutionTimeMs { get; set; }
        public int TotalHits { get; set; }
        public string? Message { get; set; }
        public List<GlobalSearchHitModel> Results { get; set; } = new List<GlobalSearchHitModel>();
    }

    public class GlobalSearchHitModel
    {
        public string RecordId { get; set; } = string.Empty;
        public string EntityType { get; set; } = "PatientMedicalChart";
        public string Title { get; set; } = string.Empty;
        public string PatientName { get; set; } = string.Empty;
        public string ContentSnippet { get; set; } = string.Empty;
        public string PdfUrl { get; set; } = string.Empty;
        public float RelevanceScore { get; set; }
    }

    public class IndexableDocument
    {
        public string RecordId { get; set; } = string.Empty;
        public string EntityType { get; set; } = "Document";
        public string Title { get; set; } = string.Empty;
        public string PatientName { get; set; } = string.Empty;
        public string ContactInfo { get; set; } = string.Empty;
        public string FullContent { get; set; } = string.Empty;
        public string PdfUrl { get; set; } = string.Empty;
    }

    public class AskRequestModel
    {
        public string Query { get; set; } = string.Empty;
    }

    public class AskResponseModel
    {
        public string Query { get; set; } = string.Empty;
        public string Answer { get; set; } = string.Empty;
        public string Category { get; set; } = "General";
        public long ExecutionTimeMs { get; set; }
        public List<object> Data { get; set; } = new List<object>();
    }
}
