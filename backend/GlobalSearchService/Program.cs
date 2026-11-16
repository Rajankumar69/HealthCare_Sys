using GlobalSearchService.Services;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});

// Configure GlobalSearchService Port 5030
var urls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "http://0.0.0.0:5030";
builder.WebHost.UseUrls(urls);

// 1. Register Services: Groq LLM, Vector Search Store (SQL GlobalSearchVectors_Raj), and Pure Vector Engine
builder.Services.AddHttpClient<IGroqLlmService, GroqLlmService>();
builder.Services.AddSingleton<IVectorSearchStore, VectorSearchStore>();
builder.Services.AddSingleton<IGlobalSearchEngine, GlobalVectorSearchEngine>();

// 2. CORS configuration for frontend and gateway
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// Auto-warmup vectors and index on service launch in background
_ = Task.Run(async () =>
{
    try
    {
        await Task.Delay(1000);
        var vectorStore = app.Services.GetRequiredService<IVectorSearchStore>();
        await vectorStore.EnsureLoadedAsync();

        var engine = app.Services.GetRequiredService<IGlobalSearchEngine>();
        await engine.BuildIndexFromSqlAsync();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[GlobalSearchService Startup] Note: {ex.Message}");
    }
});

app.UseCors("AllowAll");
app.MapControllers();

Console.WriteLine("=================================================");
Console.WriteLine("  GlobalSearchService is running on Port 5030");
Console.WriteLine("  Pure 512-dim Vector Engine: ACTIVE (Zero Lucene)");
Console.WriteLine("  SQL Table: GlobalSearchVectors_Raj");
Console.WriteLine("=================================================");

app.Run();
