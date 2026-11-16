FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["GlobalSearchService/GlobalSearchService.csproj", "GlobalSearchService/"]
RUN dotnet restore "GlobalSearchService/GlobalSearchService.csproj"

COPY . .
WORKDIR "/src/GlobalSearchService"
RUN dotnet publish "GlobalSearchService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 5030
ENV ASPNETCORE_URLS=http://0.0.0.0:5030
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "GlobalSearchService.dll"]
